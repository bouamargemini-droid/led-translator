import { callClaude } from "@/lib/anthropic";
import { buildSystemPrompt, buildUserPrompt, type GlossaryEntry } from "./prompt";

export type SegmentIn = { i: number; fr: string };
export type SegmentOut = {
  i: number;
  zh: string | null;
  tokensIn: number;
  tokensOut: number;
  error: string | null;
};

export async function translateBatch(params: {
  segments: SegmentIn[];
  glossary: GlossaryEntry[];
}): Promise<SegmentOut[]> {
  if (params.segments.length === 0) return [];

  const system = buildSystemPrompt(params.glossary);
  const user = buildUserPrompt(params.segments);

  try {
    const { text, usage } = await callClaude({
      system,
      user,
      maxTokens: 4096,
      temperature: 0,
    });

    const parsed = parseTranslations(text);
    const perSegmentIn = Math.floor(usage.input_tokens / params.segments.length);
    const perSegmentOut = Math.floor(usage.output_tokens / params.segments.length);

    return params.segments.map((seg) => {
      const match = parsed.find((p) => p.i === seg.i);
      return {
        i: seg.i,
        zh: match?.zh ?? null,
        tokensIn: perSegmentIn,
        tokensOut: perSegmentOut,
        error: match ? null : "missing translation in response",
      };
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return params.segments.map((seg) => ({
      i: seg.i,
      zh: null,
      tokensIn: 0,
      tokensOut: 0,
      error: msg,
    }));
  }
}

function parseTranslations(text: string): { i: number; zh: string }[] {
  const cleaned = text.trim().replace(/^```json\s*/i, "").replace(/```\s*$/i, "");
  try {
    const parsed = JSON.parse(cleaned) as { translations?: { i: number; zh: string }[] };
    if (!Array.isArray(parsed.translations)) return [];
    return parsed.translations
      .filter((t) => typeof t.i === "number" && typeof t.zh === "string")
      .map((t) => ({ i: t.i, zh: t.zh }));
  } catch (err) {
    console.error("[translateBatch] JSON parse failed", err, cleaned.slice(0, 400));
    return [];
  }
}
