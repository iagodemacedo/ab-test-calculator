import { afterEach, describe, expect, it, vi } from "vitest";
import worker, { type Env } from "./index";
import { hashIp } from "./limits";
import { TLDR_RESPONSE_SCHEMA } from "./response";
import { requestFixture } from "./test-fixture";

const modelOutput = { tldr: "A diferença é inconclusiva. Revise o SRM.", findings: [
  { source: "rule", ruleId: "srm", severity: "info", title: "SRM", explanation: "p = 0,0000018", action: "Revise a alocação." },
] };

function openRouterReply(content: unknown = JSON.stringify(modelOutput)) {
  return new Response(JSON.stringify({ choices: [{ message: { content } }] }));
}

function setup() {
  const siteverify = vi.fn().mockResolvedValue(new Response(JSON.stringify({ success: true })));
  const openrouter = vi.fn().mockImplementation(() => Promise.resolve(openRouterReply()));
  const externalFetch = vi.fn((url: string, init: RequestInit) => {
    if (url === "https://challenges.cloudflare.com/turnstile/v0/siteverify") return siteverify(url, init);
    if (url === "https://openrouter.ai/api/v1/chat/completions") return openrouter(url, init);
    throw new Error("Unexpected external request");
  });
  vi.stubGlobal("fetch", externalFetch);
  const burst = vi.fn().mockResolvedValue({ success: true });
  const daily = vi.fn().mockResolvedValue(new Response(null, { status: 204 }));
  const idFromName = vi.fn().mockReturnValue("object-id");
  const assets = vi.fn().mockResolvedValue(new Response("asset"));
  const env = {
    OPENROUTER_API_KEY: "test-openrouter-key", BURST_LIMIT: { limit: burst }, DAILY_LIMIT: { idFromName, get: () => ({ fetch: daily }) },
    ASSETS: { fetch: assets }, AI_MODEL: "configured-model", DAILY_TLDR_LIMIT: "20", TURNSTILE_SECRET_KEY: "test-secret",
  } as unknown as Env;
  const request = () => new Request("https://app/api/tldr", { method: "POST",
    headers: { "CF-Connecting-IP": "192.0.2.1" }, body: JSON.stringify(requestFixture()) });
  return { env, siteverify, openrouter, externalFetch, burst, daily, idFromName, assets, request };
}

afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers(); });

async function expectError(response: Response, status: number, code: string) {
  expect(response.status).toBe(status);
  expect(await response.json()).toEqual({ error: code });
  expect(response.headers.get("Content-Type")).toBe("application/json");
  expect(response.headers.get("Cache-Control")).toBe("no-store");
}

describe("POST /api/tldr production boundaries", () => {
  it("validates Turnstile, hashes the IP for both quotas, and sends only sanitized data to AI", async () => {
    const t = setup();
    const response = await worker.fetch(t.request(), t.env);
    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(await response.json()).toMatchObject({ model: "configured-model", tldr: modelOutput.tldr,
      findings: [{ source: "rule", ruleId: "srm", severity: "critical" }] });
    const [url, init] = t.siteverify.mock.calls[0] ?? [];
    expect(url).toBe("https://challenges.cloudflare.com/turnstile/v0/siteverify");
    expect(init.method).toBe("POST");
    expect(Object.fromEntries(init.body)).toEqual({ secret: "test-secret", response: "XXXX.DUMMY.TOKEN.XXXX", remoteip: "192.0.2.1" });
    const key = await hashIp("192.0.2.1");
    expect(t.burst).toHaveBeenCalledWith({ key });
    expect(t.idFromName).toHaveBeenCalledWith(key);
    expect(t.daily.mock.calls[0]?.[0]).toBe("https://daily-limit/consume?limit=20");
    const [modelUrl, modelInit] = t.openrouter.mock.calls[0] ?? [];
    expect(modelUrl).toBe("https://openrouter.ai/api/v1/chat/completions");
    expect(modelInit.method).toBe("POST");
    expect(modelInit.headers).toEqual({
      Authorization: "Bearer test-openrouter-key", "Content-Type": "application/json",
      "HTTP-Referer": "https://ab-test.iago.wtf", "X-Title": "AB Test Calculator",
    });
    const input = JSON.parse(modelInit.body);
    expect(input).toEqual({
      model: "configured-model", messages: expect.any(Array), max_tokens: 1200,
      response_format: { type: "json_schema", json_schema: { name: "tldr", strict: true, schema: TLDR_RESPONSE_SCHEMA } },
      reasoning: { enabled: false }, provider: { data_collection: "deny", require_parameters: true },
    });
    expect(input.messages[0].content).toContain("pt-BR");
    const user = JSON.parse(input.messages[1].content);
    expect(user.findings).toEqual([{ rule: "srm", pValue: 0.0000018 }]);
    expect(user.turnstileToken).toBeUndefined();
    expect(user.groups).toEqual(requestFixture().groups);
    expect(JSON.stringify(modelInit)).not.toContain("192.0.2.1");
    expect(JSON.stringify(modelInit)).not.toContain("test-secret");
    expect(JSON.stringify(init)).not.toContain("Controle");
    expect(JSON.stringify(init)).not.toContain("test-openrouter-key");
    expect(t.externalFetch).toHaveBeenCalledTimes(2);
    expect(t.daily).toHaveBeenCalledTimes(1);
    expect(t.siteverify.mock.invocationCallOrder[0]).toBeLessThan(t.burst.mock.invocationCallOrder[0]!);
    expect(t.burst.mock.invocationCallOrder[0]).toBeLessThan(t.daily.mock.invocationCallOrder[0]!);
    expect(t.daily.mock.invocationCallOrder[0]).toBeLessThan(t.openrouter.mock.invocationCallOrder[0]!);
    expect(t.openrouter).toHaveBeenCalledTimes(1);
  });

  it("does not verify tokens or consume quotas for an invalid payload", async () => {
    const t = setup();
    await expectError(await worker.fetch(new Request("https://app/api/tldr", { method: "POST", body: "{}" }), t.env), 400, "invalid_payload");
    expect(t.siteverify).not.toHaveBeenCalled();
    expect(t.burst).not.toHaveBeenCalled();
    expect(t.daily).not.toHaveBeenCalled();
    expect(t.openrouter).not.toHaveBeenCalled();
  });

  it.each(["rejected", "http-error", "invalid-json", "network-error"])("stops on Turnstile %s before quotas", async failure => {
    const t = setup();
    if (failure === "network-error") t.siteverify.mockRejectedValue(new Error("offline"));
    else t.siteverify.mockResolvedValue(new Response(failure === "invalid-json" ? "{" : JSON.stringify({ success: false }),
      { status: failure === "http-error" ? 502 : 200 }));
    await expectError(await worker.fetch(t.request(), t.env), 403, "turnstile_failed");
    expect(t.burst).not.toHaveBeenCalled();
    expect(t.daily).not.toHaveBeenCalled();
    expect(t.openrouter).not.toHaveBeenCalled();
  });

  it("does not consume a daily request when the burst quota is exhausted", async () => {
    const t = setup();
    t.burst.mockResolvedValue({ success: false });
    await expectError(await worker.fetch(t.request(), t.env), 429, "burst_limit");
    expect(t.daily).not.toHaveBeenCalled();
    expect(t.openrouter).not.toHaveBeenCalled();
  });

  it("does not call AI when the daily quota is exhausted", async () => {
    const t = setup();
    t.daily.mockResolvedValue(new Response(null, { status: 429 }));
    await expectError(await worker.fetch(t.request(), t.env), 429, "daily_limit");
    expect(t.openrouter).not.toHaveBeenCalled();
  });

  it("does not call OpenRouter when the daily counter fails", async () => {
    const t = setup();
    t.daily.mockResolvedValue(new Response(null, { status: 503 }));
    await expectError(await worker.fetch(t.request(), t.env), 502, "ai_failed");
    expect(t.openrouter).not.toHaveBeenCalled();
  });

  it("retries invalid JSON once while consuming only one daily request", async () => {
    const t = setup();
    t.openrouter.mockResolvedValueOnce(openRouterReply("{"));
    expect((await worker.fetch(t.request(), t.env)).status).toBe(200);
    expect(t.openrouter).toHaveBeenCalledTimes(2);
    expect(t.daily).toHaveBeenCalledTimes(1);
  });

  it("returns ai_failed after two invalid outputs", async () => {
    const t = setup();
    t.openrouter.mockImplementation(() => Promise.resolve(openRouterReply("{}")));
    await expectError(await worker.fetch(t.request(), t.env), 502, "ai_failed");
    expect(t.openrouter).toHaveBeenCalledTimes(2);
    expect(t.daily).toHaveBeenCalledTimes(1);
  });

  it("returns ai_failed without retrying service errors", async () => {
    const t = setup();
    t.openrouter.mockRejectedValue(new Error("unavailable"));
    await expectError(await worker.fetch(t.request(), t.env), 502, "ai_failed");
    expect(t.openrouter).toHaveBeenCalledTimes(1);
    expect(t.daily).toHaveBeenCalledTimes(1);
  });

  it.each([401, 402, 429, 500, 502, 503])("returns ai_failed on OpenRouter HTTP %s without exposing the body", async status => {
    const t = setup();
    t.openrouter.mockResolvedValue(new Response("private provider error", { status }));
    await expectError(await worker.fetch(t.request(), t.env), 502, "ai_failed");
    expect(t.openrouter).toHaveBeenCalledTimes(1);
    expect(t.daily).toHaveBeenCalledTimes(1);
  });

  it.each([{}, { choices: [] }, { choices: [null] }, { choices: [{ message: {} }] },
    { choices: [{ message: { content: null } }] }, { choices: [{ message: { content: modelOutput } }] },
  ])("rejects an invalid OpenRouter envelope %j", async output => {
    const t = setup();
    t.openrouter.mockResolvedValue(new Response(JSON.stringify(output)));
    await expectError(await worker.fetch(t.request(), t.env), 502, "ai_failed");
    expect(t.openrouter).toHaveBeenCalledTimes(1);
    expect(t.daily).toHaveBeenCalledTimes(1);
  });

  it("rejects a non-JSON OpenRouter response", async () => {
    const t = setup();
    t.openrouter.mockResolvedValue(new Response("{"));
    await expectError(await worker.fetch(t.request(), t.env), 502, "ai_failed");
    expect(t.openrouter).toHaveBeenCalledTimes(1);
  });

  it("aborts a pending OpenRouter fetch at the deadline", async () => {
    vi.useFakeTimers();
    const t = setup();
    t.openrouter.mockImplementation((_url: string, init: RequestInit) => new Promise((_resolve, reject) => {
      init.signal?.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError")));
    }));
    const pending = worker.fetch(t.request(), t.env);
    await vi.waitFor(() => expect(t.openrouter).toHaveBeenCalledTimes(1));
    await vi.advanceTimersByTimeAsync(20_000);
    await expectError(await pending, 504, "ai_timeout");
    expect(t.openrouter.mock.calls[0]?.[1].signal.aborted).toBe(true);
    expect(t.daily).toHaveBeenCalledTimes(1);
  });

  it("times out after 20 seconds, including time spent on the first invalid result", async () => {
    vi.useFakeTimers();
    const t = setup();
    t.openrouter.mockImplementationOnce(() => new Promise(resolve => setTimeout(() => resolve(openRouterReply("{")), 15_000)))
      .mockImplementationOnce(() => new Promise(() => {}));
    const pending = worker.fetch(t.request(), t.env);
    await vi.waitFor(() => expect(t.openrouter).toHaveBeenCalledTimes(1));
    await vi.advanceTimersByTimeAsync(15_000);
    expect(t.openrouter).toHaveBeenCalledTimes(2);
    await vi.advanceTimersByTimeAsync(5_000);
    await expectError(await pending, 504, "ai_timeout");
    expect(t.openrouter.mock.calls[1]?.[1].signal.aborted).toBe(true);
    expect(t.daily).toHaveBeenCalledTimes(1);
  });

  it("delegates other routes to static assets", async () => {
    const t = setup();
    const request = new Request("https://app/en/analysis");
    expect(await (await worker.fetch(request, t.env)).text()).toBe("asset");
    expect(t.assets).toHaveBeenCalledWith(request);
  });
});
