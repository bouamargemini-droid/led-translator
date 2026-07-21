import Anthropic from "@anthropic-ai/sdk";

export const CLAUDE_MODEL = "claude-sonnet-4-6";

const apiKey = process.env.ANTHROPIC_API_KEY;
if (!apiKey && process.env.NODE_ENV !== "test") {
  console.warn("[anthropic] ANTHROPIC_API_KEY missing — API calls will fail.");
}

export const anthropic = new Anthropic({
  apiKey: apiKey ?? "",
});

export type UsageMeta = { input_tokens: number; output_tokens: number };

const MAX_RETRIES = 3;
const BASE_DELAY_MS = 800;

export async function callClaude(params: {
  system: string;
  user: string;
  maxTokens?: number;
  temperature?: number;
}): Promise<{ text: string; usage: UsageMeta }> {
  let attempt = 0;
  let lastError: unknown = null;

  while (attempt < MAX_RETRIES) {
    try {
      const res = await anthropic.messages.create({
        model: CLAUDE_MODEL,
        max_tokens: params.maxTokens ?? 4096,
        temperature: params.temperature ?? 0,
        system: params.system,
        messages: [{ role: "user", content: params.user }],
      });

      const text = res.content
        .filter((block): block is Anthropic.TextBlock => block.type === "text")
        .map((block) => block.text)
        .join("");

      return {
        text,
        usage: {
          input_tokens: res.usage.input_tokens,
          output_tokens: res.usage.output_tokens,
        },
      };
    } catch (err) {
      lastError = err;
      const status = (err as { status?: number })?.status ?? 0;
      const retryable = status === 429 || status >= 500;
      if (!retryable || attempt === MAX_RETRIES - 1) break;
      const delay = BASE_DELAY_MS * Math.pow(2, attempt);
      await new Promise((r) => setTimeout(r, delay));
      attempt++;
    }
  }

  throw lastError;
}
