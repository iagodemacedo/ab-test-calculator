import { handleTldr } from "./handler";
export { DailyLimit } from "./limits";

export interface Env {
  ASSETS: Fetcher;
  AI: Ai;
  DAILY_LIMIT: DurableObjectNamespace;
  BURST_LIMIT: RateLimit;
  AI_MODEL: string;
  DAILY_TLDR_LIMIT: string;
  TURNSTILE_SECRET_KEY: string;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    if (request.method === "GET" && url.pathname === "/") {
      const languages = (request.headers.get("Accept-Language") || "").split(",")
        .map((entry, index) => {
          const [language = "", ...params] = entry.trim().split(";");
          const quality = params.find(param => param.trim().startsWith("q="));
          return { language, index, q: quality ? Number(quality.trim().slice(2)) : 1 };
        })
        .filter(entry => Number.isFinite(entry.q) && entry.q > 0 && entry.q <= 1)
        .sort((a, b) => b.q - a.q || a.index - b.index);
      const pt = /^pt(?:-|$)/i.test(languages[0]?.language || "");
      url.pathname = pt ? "/pt/analise" : "/en/analysis";
      return new Response(null, { status: 302, headers: { Location: url.toString(), Vary: "Accept-Language" } });
    }
    if (url.pathname === "/api/tldr") {
      if (request.method === "POST") return handleTldr(request, env);
      return new Response(null, { status: 405, headers: { Allow: "POST", "Cache-Control": "no-store" } });
    }
    return env.ASSETS.fetch(request);
  },
} satisfies ExportedHandler<Env>;
