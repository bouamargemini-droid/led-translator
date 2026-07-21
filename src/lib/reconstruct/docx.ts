import fs from "node:fs/promises";
import JSZip from "jszip";
import { XMLParser, XMLBuilder } from "fast-xml-parser";

const TARGET_PARTS = [
  "word/document.xml",
  "word/header1.xml",
  "word/header2.xml",
  "word/header3.xml",
  "word/footer1.xml",
  "word/footer2.xml",
  "word/footer3.xml",
];

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
  preserveOrder: true,
  trimValues: false,
});

const builder = new XMLBuilder({
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
  preserveOrder: true,
  suppressEmptyNode: false,
  format: false,
});

type Node = Record<string, unknown>;

/**
 * Reconstruction DOCX in-place :
 * - Recharge le DOCX source
 * - Parcourt chaque part cible et remplace le texte de chaque <w:p>
 * - Stratégie : concatène toutes les traductions du paragraphe dans le PREMIER <w:t>,
 *   vide les <w:t> suivants (préserve le style de la première run).
 *
 * translationsByRef : Map "word/document.xml:p[12]" -> traduction ZH complète
 */
export async function reconstructDocx(params: {
  pathIn: string;
  pathOut: string;
  translationsByRef: Map<string, string>;
}): Promise<void> {
  const buffer = await fs.readFile(params.pathIn);
  const zip = await JSZip.loadAsync(buffer);

  for (const partName of TARGET_PARTS) {
    const file = zip.file(partName);
    if (!file) continue;

    const xml = await file.async("string");
    const tree = parser.parse(xml) as Node[];
    const paraCounter = { count: 0 };
    replaceInPart(tree, partName, paraCounter, params.translationsByRef);
    const rebuilt = builder.build(tree) as string;
    zip.file(partName, rebuilt);
  }

  const out = await zip.generateAsync({ type: "nodebuffer" });
  await fs.writeFile(params.pathOut, out);
}

function replaceInPart(
  root: unknown,
  partName: string,
  counter: { count: number },
  map: Map<string, string>,
): void {
  walk(root, (node) => {
    if (nodeName(node) === "w:p") {
      const ref = `${partName}:p[${counter.count}]`;
      counter.count++;
      const translation = map.get(ref);
      if (translation != null) {
        replaceParagraphText(node, translation);
      }
      return true; // stop descent — déjà traité
    }
    return false;
  });
}

function replaceParagraphText(paragraph: unknown, translation: string): void {
  const wtNodes: Node[] = [];
  walk(paragraph, (node) => {
    if (nodeName(node) === "w:t") {
      wtNodes.push(node as Node);
      return true;
    }
    return false;
  });

  if (wtNodes.length === 0) return;

  // Premier w:t reçoit toute la traduction, avec xml:space="preserve"
  const first = wtNodes[0];
  setTextNode(first, translation);

  // Les autres w:t sont vidés
  for (let i = 1; i < wtNodes.length; i++) {
    setTextNode(wtNodes[i], "");
  }
}

function setTextNode(wtNode: Node, text: string): void {
  const children = wtNode["w:t"];
  if (Array.isArray(children) && children.length > 0) {
    // preserveOrder = true : [{ "#text": "..." }]
    children.splice(0, children.length, { "#text": text } as Node);
  } else {
    wtNode["w:t"] = [{ "#text": text } as Node];
  }
  // Force xml:space=preserve pour ne pas trim les espaces
  wtNode[":@"] = { ...(wtNode[":@"] as Node), "@_xml:space": "preserve" };
}

function walk(node: unknown, visit: (n: Node) => boolean): void {
  if (Array.isArray(node)) {
    for (const child of node) walk(child, visit);
    return;
  }
  if (node && typeof node === "object") {
    const obj = node as Node;
    const handled = visit(obj);
    if (handled) return;
    for (const key of Object.keys(obj)) {
      if (key.startsWith("@_") || key === "#text" || key === ":@") continue;
      walk(obj[key], visit);
    }
  }
}

function nodeName(node: unknown): string | null {
  if (!node || typeof node !== "object" || Array.isArray(node)) return null;
  const keys = Object.keys(node as Node).filter(
    (k) => !k.startsWith("@_") && k !== "#text" && k !== ":@",
  );
  return keys[0] ?? null;
}
