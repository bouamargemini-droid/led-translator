import { callClaude } from "@/lib/anthropic";

export type CandidateTerm = {
  term_fr: string;
  term_zh: string;
  frequency: number;
  reason: string;
};

const SYSTEM_PROMPT = `Tu es un expert en écrans LED grand format et en traduction technique français vers chinois simplifié (zh-CN).

Ta mission : identifier dans un lot de documents d'appel d'offres LED français les termes techniques qui NE FIGURENT PAS déjà dans le glossaire de base fourni, mais qui devraient l'être pour garantir la cohérence de la traduction.

Règles STRICTES :
1. Ignore les termes déjà présents dans le glossaire de base (fournis en input).
2. Concentre-toi sur : composants LED spécifiques, spécifications techniques, méthodes d'installation, standards secteur, terminologie contractuelle appel d'offres, références produit, unités techniques particulières.
3. Ne retourne PAS de termes génériques (le, la, écran, mètre, projet, société, etc.).
4. Ne retourne PAS de noms propres (villes, personnes, sociétés du client).
5. Pour chaque terme, propose une traduction ZH-CN professionnelle utilisée dans l'industrie chinoise.
6. Marque frequency = nombre approximatif d'occurrences dans le lot.
7. Marque reason = une phrase courte (max 12 mots) qui explique pourquoi ce terme est technique.

Réponds UNIQUEMENT avec un JSON strict (pas de markdown, pas de commentaire) :
{
  "candidates": [
    { "term_fr": "...", "term_zh": "...", "frequency": 3, "reason": "..." }
  ]
}`;

export async function extractGlossaryCandidates(params: {
  segments: string[];
  baseGlossaryFr: string[];
}): Promise<{ candidates: CandidateTerm[]; tokensIn: number; tokensOut: number }> {
  const sample = pickSample(params.segments, 8000);
  const basePreview = params.baseGlossaryFr.slice(0, 200).join(", ");

  const userPrompt = `Glossaire de base déjà couvert (à IGNORER) :
${basePreview}

Extraits du lot d'appel d'offres LED (analyse-les intégralement) :
---
${sample}
---

Retourne le JSON des termes candidats à ajouter au glossaire.`;

  const { text, usage } = await callClaude({
    system: SYSTEM_PROMPT,
    user: userPrompt,
    maxTokens: 4096,
    temperature: 0,
  });

  const candidates = parseCandidates(text);
  return {
    candidates,
    tokensIn: usage.input_tokens,
    tokensOut: usage.output_tokens,
  };
}

function pickSample(segments: string[], maxChars: number): string {
  const joined = segments.join("\n");
  if (joined.length <= maxChars) return joined;

  // Échantillonnage : début + milieu + fin pour couvrir toute la structure d'un CPS
  const third = Math.floor(maxChars / 3);
  const start = joined.slice(0, third);
  const middleStart = Math.floor(joined.length / 2 - third / 2);
  const middle = joined.slice(middleStart, middleStart + third);
  const end = joined.slice(-third);
  return `${start}\n---[extrait milieu]---\n${middle}\n---[extrait fin]---\n${end}`;
}

function parseCandidates(text: string): CandidateTerm[] {
  const cleaned = text.trim().replace(/^```json\s*/i, "").replace(/```\s*$/i, "");
  try {
    const parsed = JSON.parse(cleaned) as { candidates?: CandidateTerm[] };
    if (!Array.isArray(parsed.candidates)) return [];
    return parsed.candidates
      .filter(
        (c) =>
          typeof c.term_fr === "string" &&
          typeof c.term_zh === "string" &&
          c.term_fr.trim().length > 0 &&
          c.term_zh.trim().length > 0,
      )
      .map((c) => ({
        term_fr: c.term_fr.trim(),
        term_zh: c.term_zh.trim(),
        frequency: Number.isFinite(c.frequency) ? Number(c.frequency) : 1,
        reason: typeof c.reason === "string" ? c.reason : "",
      }));
  } catch (err) {
    console.error("[extractGlossaryCandidates] JSON parse failed", err, cleaned.slice(0, 400));
    return [];
  }
}
