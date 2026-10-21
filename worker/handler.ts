import type { TldrError, TldrErrorCode, TldrResponse } from "../src/shared/tldr-contract";
import type { Env } from "./index";
import { hashIp } from "./limits";
import { isRecord, readTldrRequest } from "./payload";
import { buildMessages } from "./prompt";
import { parseModelOutput, TLDR_RESPONSE_SCHEMA } from "./response";

function json(body: TldrError | TldrResponse, status: number): Response {
  return new Response(JSON.stringify(body), { status, headers: {
    "Content-Type": "application/json", "Cache-Control": "no-store",
  } });
}

function error(code: TldrErrorCode, status: number): Response { return json({ error: code }, status); }

async function verifyTurnstile(token: string, ip: string, secret: string): Promise<boolean> {
  try {
    const response = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST", body: new URLSearchParams({ secret, response: token, remoteip: ip }),
    });
    if (!response.ok) return false;
    const result: unknown = await response.json();
    return isRecord(result) && result.success === true;
  } catch { return false; }
}

export async function handleTldr(request: Request, env: Env): Promise<Response> {
  const parsed = await readTldrRequest(request);
  if (!parsed.ok) return error("invalid_payload", 400);
  const req = parsed.value;
  const ip = request.headers.get("CF-Connecting-IP") || "127.0.0.1";
  if (!await verifyTurnstile(req.turnstileToken, ip, env.TURNSTILE_SECRET_KEY)) return error("turnstile_failed", 403);
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const key = await hashIp(ip);
    if (!(await env.BURST_LIMIT.limit({ key })).success) return error("burst_limit", 429);
    const counter = env.DAILY_LIMIT.get(env.DAILY_LIMIT.idFromName(key));
    const daily = await counter.fetch(`https://daily-limit/consume?limit=${encodeURIComponent(env.DAILY_TLDR_LIMIT)}`, { method: "POST" });
    if (daily.status === 429) return error("daily_limit", 429);
    if (!daily.ok) return error("ai_failed", 502);
    const messages = buildMessages(req);
    const timeout = Symbol("ai-timeout");
    const deadline = new Promise<typeof timeout>(resolve => { timer = setTimeout(() => resolve(timeout), 20_000); });
    for (let attempt = 0; attempt < 2; attempt++) {
      const output = await Promise.race([
        env.AI.run(env.AI_MODEL, { messages, response_format: { type: "json_schema", json_schema: TLDR_RESPONSE_SCHEMA }, max_tokens: 1200 }),
        deadline,
      ]);
      if (output === timeout) return error("ai_timeout", 504);
      const raw = isRecord(output) && "response" in output ? output.response : output;
      const response = parseModelOutput(raw, req);
      if (response) return json({ ...response, model: env.AI_MODEL }, 200);
    }
    return error("ai_failed", 502);
  } catch { return error("ai_failed", 502); }
  finally { if (timer !== undefined) clearTimeout(timer); }
}
