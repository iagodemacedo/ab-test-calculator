import type { Env } from "./index";
import { isRecord } from "./payload";
import type { buildMessages } from "./prompt";
import { TLDR_RESPONSE_SCHEMA } from "./response";

export async function requestOpenRouter(
  env: Pick<Env, "AI_MODEL" | "OPENROUTER_API_KEY">,
  messages: ReturnType<typeof buildMessages>,
  signal: AbortSignal,
): Promise<string> {
  const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    signal,
    headers: {
      Authorization: `Bearer ${env.OPENROUTER_API_KEY}`,
      "Content-Type": "application/json",
      "HTTP-Referer": "https://ab-test.iago.wtf",
      "X-Title": "AB Test Calculator",
    },
    body: JSON.stringify({
      model: env.AI_MODEL,
      messages,
      max_tokens: 1200,
      response_format: { type: "json_schema", json_schema: { name: "tldr", strict: true, schema: TLDR_RESPONSE_SCHEMA } },
      reasoning: { enabled: false },
      provider: { data_collection: "deny", require_parameters: true },
    }),
  });
  if (!response.ok) throw new Error("OpenRouter request failed");
  const output: unknown = await response.json();
  const choice = isRecord(output) && Array.isArray(output.choices) ? output.choices[0] : undefined;
  if (!isRecord(choice) || !isRecord(choice.message) || typeof choice.message.content !== "string") {
    throw new Error("Invalid OpenRouter response");
  }
  return choice.message.content;
}
