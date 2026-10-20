export interface Env {
  ASSETS: Fetcher;
}

export default {
  async fetch(request, env): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname === "/api/tldr") {
      return new Response("Method Not Allowed", { status: 405, headers: { Allow: "POST" } });
    }
    return env.ASSETS.fetch(request);
  },
} satisfies ExportedHandler<Env>;

export class DailyLimit implements DurableObject {
  constructor(readonly ctx: DurableObjectState) {}
  async fetch(): Promise<Response> {
    return new Response(null, { status: 501 });
  }
}
