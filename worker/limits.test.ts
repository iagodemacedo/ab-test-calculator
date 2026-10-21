import { describe, expect, it } from "vitest";
import { consumeDailyLimit, DailyLimit, DAILY_WINDOW_MS, hashIp, type CounterStorage } from "./limits";

class MemoryStorage implements CounterStorage {
  values = new Map<string, { count: number; windowStart: number }>();
  alarmAt: number | null = null;
  private pending = Promise.resolve();
  async setAlarm(scheduledTime: number) { this.alarmAt = scheduledTime; }
  async deleteAll() { this.values.clear(); this.alarmAt = null; }
  async transaction<T>(callback: (txn: {
    get(key: string): Promise<{ count: number; windowStart: number } | undefined>;
    put(key: string, value: { count: number; windowStart: number }): Promise<void>;
  }) => Promise<T>): Promise<T> {
    const result = this.pending.then(() => callback({
      get: async key => this.values.get(key),
      put: async (key, value) => { this.values.set(key, value); },
    }));
    this.pending = result.then(() => undefined, () => undefined);
    return result;
  }
}

describe("daily quota", () => {
  it("allows 20, denies the 21st, and resets exactly after 24 hours", async () => {
    const storage = new MemoryStorage();
    const now = 1000;
    for (let i = 0; i < 20; i++) expect(await consumeDailyLimit(storage, 20, now)).toBe(true);
    expect(await consumeDailyLimit(storage, 20, now + DAILY_WINDOW_MS - 1)).toBe(false);
    expect([...storage.values.values()]).toEqual([{ count: 20, windowStart: now }]);
    expect(await consumeDailyLimit(storage, 20, now + DAILY_WINDOW_MS)).toBe(true);
    expect([...storage.values.values()]).toEqual([{ count: 1, windowStart: now + DAILY_WINDOW_MS }]);
  });
  it("atomically admits only 20 concurrent requests", async () => {
    const storage = new MemoryStorage();
    const results = await Promise.all(Array.from({ length: 30 }, () => consumeDailyLimit(storage, 20, 1000)));
    expect(results.filter(Boolean)).toHaveLength(20);
  });
  it("serves the counter through the Durable Object fetch boundary", async () => {
    const object = new DailyLimit({ storage: new MemoryStorage() });
    const request = () => new Request("https://daily-limit/consume?limit=2", { method: "POST" });
    expect((await object.fetch(request())).status).toBe(204);
    expect((await object.fetch(request())).status).toBe(204);
    expect((await object.fetch(request())).status).toBe(429);
    expect((await object.fetch(new Request("https://daily-limit/consume?limit=bad"))).status).toBe(400);
  });
  it("forgets the per-IP counter 24 hours after its window starts", async () => {
    const storage = new MemoryStorage();
    const object = new DailyLimit({ storage });
    const before = Date.now();
    await object.fetch(new Request("https://daily-limit/consume?limit=2", { method: "POST" }));
    const { windowStart } = [...storage.values.values()][0]!;
    expect(windowStart).toBeGreaterThanOrEqual(before);
    expect(storage.alarmAt).toBe(windowStart + DAILY_WINDOW_MS);
    await object.alarm();
    expect(storage.values.size).toBe(0);
  });
  it("hashes the IP into a stable SHA-256 key", async () => {
    const key = await hashIp("127.0.0.1");
    expect(key).toBe("12ca17b49af2289436f303e0166030a21e525d266e209267433801a8fd4071a0");
    expect(await hashIp("127.0.0.2")).not.toBe(key);
  });
});
