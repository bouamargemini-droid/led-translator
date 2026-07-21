import JSZip from "jszip";
import { XMLParser } from "fast-xml-parser";
import type { ParsedDocument, ParsedSegment } from "./types";

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
});

/**
 * Extraction basique des paragraphes DOCX.
 * On concatène tous les <w:t> d'un même <w:p> en un seul segment
 * (les runs seront regérés en Phase 3 pour la reconstruction).
 */
export async function parseDocx(buffer: Buffer): Promise<ParsedDocument> {
  const zip = await JSZip.loadAsync(buffer);
  const segments: ParsedSegment[] = [];
  let index = 0;

  for (const partName of TARGET_PARTS) {
    const file = zip.file(partName);
    if (!file) continue;

    const xml = await file.async("string");
    const tree = parser.parse(xml);

    let paraCounter = 0;
    const paragraphs = collectParagraphs(tree);
    for (const paraTexts of paragraphs) {
      const text = paraTexts.join("").trim();
      if (text.length === 0) {
        paraCounter++;
        continue;
      }
      segments.push({
        index: index++,
        text,
        kind: "docx_paragraph",
        ref: `${partName}:p[${paraCounter}]`,
      });
      paraCounter++;
    }
  }

  return { segments };
}

/**
 * Traverse le tree preserveOrder de fast-xml-parser et retourne
 * pour chaque <w:p> la liste des textes de ses <w:t>.
 */
type XmlNode = Record<string, unknown>;

function collectParagraphs(root: unknown): string[][] {
  const paragraphs: string[][] = [];
  walk(root, (node) => {
    if (nodeName(node) === "w:p") {
      const texts: string[] = [];
      collectTexts(node, texts);
      paragraphs.push(texts);
      return true; // stop descent for this branch (déjà collecté)
    }
    return false;
  });
  return paragraphs;
}

function collectTexts(node: unknown, acc: string[]): void {
  walk(node, (n) => {
    if (nodeName(n) === "w:t") {
      const value = extractInnerText(n);
      if (value) acc.push(value);
      return true;
    }
    return false;
  });
}

function walk(node: unknown, visit: (n: XmlNode) => boolean): void {
  if (Array.isArray(node)) {
    for (const child of node) walk(child, visit);
    return;
  }
  if (node && typeof node === "object") {
    const obj = node as XmlNode;
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
  const keys = Object.keys(node as XmlNode).filter(
    (k) => !k.startsWith("@_") && k !== "#text" && k !== ":@",
  );
  return keys[0] ?? null;
}

function extractInnerText(node: unknown): string {
  if (!node || typeof node !== "object") return "";
  const obj = node as XmlNode;
  const children = obj["w:t"];
  if (Array.isArray(children)) {
    let out = "";
    for (const child of children) {
      if (child && typeof child === "object") {
        const t = (child as XmlNode)["#text"];
        if (typeof t === "string") out += t;
      }
    }
    return out;
  }
  return "";
}
