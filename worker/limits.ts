export const DAILY_WINDOW_MS = 24 * 60 * 60 * 1000;
type Counter = { count: number; windowStart: number };
export interface CounterStorage {
  transaction<T>(callback: (txn: {
    get(key: string): Promise<Counter | undefined>;
    put(key: string, value: Counter): Promise<void>;
  }) => Promise<T>): Promise<T>;
  setAlarm(scheduledTime: number): Promise<void>;
  deleteAll(): Promise<void>;
}

export async function consumeDailyLimit(storage: CounterStorage, limit: number, now = Date.now()): Promise<boolean> {
  return storage.transaction(async txn => {
    const previous = await txn.get("counter");
    const counter = !previous || now - previous.windowStart >= DAILY_WINDOW_MS
      ? { count: 0, windowStart: now } : previous;
    if (counter.count >= limit) return false;
    await txn.put("counter", { count: counter.count + 1, windowStart: counter.windowStart });
    return true;
  });
}

export class DailyLimit implements DurableObject {
  constructor(readonly ctx: { storage: CounterStorage }) {}
  async fetch(request: Request): Promise<Response> {
    const limit = Number(new URL(request.url).searchParams.get("limit"));
    if (!Number.isSafeInteger(limit) || limit < 1) return new Response(null, { status: 400 });
    const allowed = await consumeDailyLimit(this.ctx.storage, limit);
    // PRD section 11: the per-IP counter lives 24 hours, then the object forgets it entirely.
    const counter = await this.ctx.storage.transaction(txn => txn.get("counter"));
    if (counter) await this.ctx.storage.setAlarm(counter.windowStart + DAILY_WINDOW_MS);
    return new Response(null, { status: allowed ? 204 : 429 });
  }

  async alarm(): Promise<void> {
    await this.ctx.storage.deleteAll();
  }
}

export async function hashIp(ip: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(ip));
  return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, "0")).join("");
}
