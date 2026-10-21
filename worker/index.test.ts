import { describe, expect, it } from "vitest";
import worker, { type Env } from "./index";

// Only the bindings a route uses need to exist in a boundary double.
const env = {} as Env;

describe("Worker routing", () => {
  it.each([
    ["pt-BR,pt;q=0.9", "/pt/analise"], ["en-US", "/en/analysis"], ["fr", "/en/analysis"],
    [undefined, "/en/analysis"], ["en-US;q=0.5,pt-BR;q=0.9", "/pt/analise"],
    ["en-US,pt;q=0.9", "/en/analysis"], ["pt;q=0,en;q=0.8", "/en/analysis"], ["PT-pt", "/pt/analise"],
  ])("redirects Accept-Language %j and preserves queries", async (language, path) => {
    const headers = language ? { "Accept-Language": language } : {};
    const response = await worker.fetch(new Request("https://app/?ref=test", { headers }), env);
    expect(response.status).toBe(302);
    expect(response.headers.get("Location")).toBe(`https://app${path}?ref=test`);
    expect(response.headers.get("Vary")).toBe("Accept-Language");
  });
  it("rejects GET /api/tldr with Allow POST", async () => {
    const response = await worker.fetch(new Request("https://app/api/tldr"), env);
    expect(response.status).toBe(405);
    expect(response.headers.get("Allow")).toBe("POST");
  });
  it("rejects invalid POST payload before accessing any bindings", async () => {
    const response = await worker.fetch(new Request("https://app/api/tldr", { method: "POST", body: "{}" }), env);
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "invalid_payload" });
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(response.headers.get("Content-Type")).toBe("application/json");
  });
});
