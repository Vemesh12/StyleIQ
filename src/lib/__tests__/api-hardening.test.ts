import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  enforceLoginRateLimits,
  peekRateLimit,
  recordLoginFailure,
  recordRateLimitHit,
  type LoginLimits,
} from '../rate-limit';
import { cached } from '../ttl-cache';
import {
  completeOutfitSchema,
  dailySuggestionSchema,
  feedbackSchema,
  isCalendarDate,
  loginSchema,
  MAX_RECENTLY_WORN,
  MAX_WARDROBE_ITEMS,
  registerSchema,
  savedOutfitCreateSchema,
  wardrobeAddSchema,
  wearLogSchema,
} from '../validation';

const ids = (n: number) => Array.from({ length: n }, (_, i) => `g${i}`);

describe('peek / record rate-limit buckets', () => {
  it('peeking never counts; recording does', async () => {
    const key = `peek-${Math.random()}`;
    for (let i = 0; i < 5; i++) expect((await peekRateLimit(key, 2, 60_000)).allowed).toBe(true);
    await recordRateLimitHit(key, 60_000);
    expect((await peekRateLimit(key, 2, 60_000)).allowed).toBe(true);
    await recordRateLimitHit(key, 60_000);
    const blocked = await peekRateLimit(key, 2, 60_000);
    expect(blocked.allowed).toBe(false);
    expect(blocked.retryAfterSeconds).toBeGreaterThan(0);
  });

  describe('with Upstash Redis configured', () => {
    afterEach(() => {
      vi.unstubAllEnvs();
      vi.unstubAllGlobals();
    });

    it('reads with GET and records with INCR on the shared store', async () => {
      vi.stubEnv('UPSTASH_REDIS_REST_URL', 'https://redis.example');
      vi.stubEnv('UPSTASH_REDIS_REST_TOKEN', 'token');
      const counts = new Map<string, number>();
      const fetchMock = vi.fn(async (_url: string, init: RequestInit) => {
        const commands = JSON.parse(String(init.body)) as string[][];
        const replies = commands.map(([cmd, key]) => {
          if (cmd === 'INCR') {
            counts.set(key, (counts.get(key) ?? 0) + 1);
            return { result: counts.get(key)! };
          }
          if (cmd === 'GET') return { result: counts.has(key) ? String(counts.get(key)) : null };
          if (cmd === 'PTTL') return { result: 45_000 };
          return { result: 1 };
        });
        return new Response(JSON.stringify(replies));
      });
      vi.stubGlobal('fetch', fetchMock);

      const key = `redis-peek-${Math.random()}`;
      expect(await peekRateLimit(key, 1, 60_000)).toEqual({ allowed: true, retryAfterSeconds: 0 });
      await recordRateLimitHit(key, 60_000);
      expect(await peekRateLimit(key, 1, 60_000)).toEqual({ allowed: false, retryAfterSeconds: 45 });
      expect(counts.get(`styleiq:rl:${key}`)).toBe(1);
    });
  });
});

describe('login rate limits', () => {
  const limits = (): LoginLimits => ({
    scope: `test-login-${Math.random()}`,
    ipAccountLimit: 5,
    ipLimit: 100,
    accountFailureLimit: 3,
    windowMs: 60_000,
  });

  it('only failed attempts count against the account', async () => {
    const l = limits();
    // Many successful logins (no failure recorded) from different IPs.
    for (let i = 0; i < 10; i++) expect(await enforceLoginRateLimits(l, `10.0.0.${i}`, 'admin@x.com')).toBeNull();
  });

  it('blocks failing IPs once the account is under attack, but lets a clean IP through', async () => {
    const l = limits();
    const account = 'admin@styleiq.com';
    // An attacker spreads failures over three IPs.
    for (const ip of ['6.6.6.1', '6.6.6.2', '6.6.6.3']) {
      expect(await enforceLoginRateLimits(l, ip, account)).toBeNull();
      await recordLoginFailure(l, ip, account);
    }
    // Account bucket is now exhausted: every IP that has failed is blocked…
    const blocked = await enforceLoginRateLimits(l, '6.6.6.1', account);
    expect(blocked?.status).toBe(429);
    expect(blocked?.headers.get('Retry-After')).toBeTruthy();
    // …but the real admin, on an IP with no recent failures, still gets in.
    expect(await enforceLoginRateLimits(l, '192.168.1.10', account)).toBeNull();
    // A new IP gets at most one guess before it is no longer "clean".
    await recordLoginFailure(l, '6.6.6.9', account);
    expect((await enforceLoginRateLimits(l, '6.6.6.9', account))?.status).toBe(429);
    // Other accounts are unaffected.
    expect(await enforceLoginRateLimits(l, '6.6.6.1', 'someone-else@x.com')).toBeNull();
  });

  it('still limits every attempt per IP+account', async () => {
    const l = limits();
    for (let i = 0; i < 5; i++) expect(await enforceLoginRateLimits(l, '1.2.3.4', 'a@b.co')).toBeNull();
    expect((await enforceLoginRateLimits(l, '1.2.3.4', 'a@b.co'))?.status).toBe(429);
  });
});

describe('ttl cache failures', () => {
  it("a failed computation doesn't evict a newer entry for the same key", async () => {
    let rejectFirst!: (e: Error) => void;
    const first = cached('race:k', 1, () => new Promise<number>((_, reject) => (rejectFirst = reject)));
    await new Promise((r) => setTimeout(r, 5)); // let the 1ms entry expire
    const second = cached('race:k', 60_000, async () => 2);
    rejectFirst(new Error('boom'));
    await expect(first).rejects.toThrow('boom');
    let calls = 0;
    expect(await cached('race:k', 60_000, async () => ++calls)).toBe(2);
    expect(calls).toBe(0);
    expect(await second).toBe(2);
  });
});

describe('request validation', () => {
  it('normalizes emails to lowercase', () => {
    expect(registerSchema.parse({ email: '  Bob@Example.COM ', password: 'longenough' }).email).toBe('bob@example.com');
    expect(loginSchema.parse({ email: 'ADMIN@StyleIQ.com', password: 'x' }).email).toBe('admin@styleiq.com');
  });

  it('accepts only real calendar dates from 2000 on', () => {
    expect(isCalendarDate('2024-02-29')).toBe(true);
    expect(isCalendarDate('2024-02-31')).toBe(false);
    expect(isCalendarDate('2023-02-29')).toBe(false);
    expect(isCalendarDate('2024-13-01')).toBe(false);
    expect(wearLogSchema.safeParse({ garmentIds: ['a'], wornOn: '2024-02-31' }).success).toBe(false);
    expect(wearLogSchema.safeParse({ garmentIds: ['a'], wornOn: '1999-12-31' }).success).toBe(false);
    expect(wearLogSchema.safeParse({ garmentIds: ['a'], wornOn: '2024-06-30' }).success).toBe(true);
    expect(dailySuggestionSchema.safeParse({ garmentIds: ['a'], localDate: '2025-04-31' }).success).toBe(false);
  });

  it('de-duplicates ids before the minimum-length checks', () => {
    expect(feedbackSchema.safeParse({ garmentIds: ['a', 'a'], rating: 1 }).success).toBe(false);
    expect(feedbackSchema.parse({ garmentIds: ['a', 'b', 'a'], rating: 1 }).garmentIds).toEqual(['a', 'b']);
    expect(savedOutfitCreateSchema.safeParse({ garmentIds: ['x', 'x'] }).success).toBe(false);
  });

  it('accepts a full closet on every closet endpoint', () => {
    const full = ids(MAX_WARDROBE_ITEMS);
    expect(dailySuggestionSchema.safeParse({ garmentIds: full }).success).toBe(true);
    expect(completeOutfitSchema.safeParse({ garmentIds: full, lockedIds: ['g0'] }).success).toBe(true);
    expect(wardrobeAddSchema.safeParse({ garmentIds: full }).success).toBe(true);
    expect(dailySuggestionSchema.safeParse({ garmentIds: ids(MAX_WARDROBE_ITEMS + 1) }).success).toBe(false);
  });

  it("trims a guest's long wear history to the newest entries instead of rejecting it", () => {
    const worn = Array.from({ length: MAX_RECENTLY_WORN + 50 }, (_, i) => ({ garmentId: `g${i}`, wornOn: '2026-10-20' }));
    const parsed = dailySuggestionSchema.parse({ garmentIds: ['a'], recentlyWorn: worn });
    expect(parsed.recentlyWorn).toHaveLength(MAX_RECENTLY_WORN);
    expect(parsed.recentlyWorn?.at(-1)?.garmentId).toBe(`g${MAX_RECENTLY_WORN + 49}`);
    expect(dailySuggestionSchema.parse({ garmentIds: ['a'] }).recentlyWorn).toBeUndefined();
  });

  it('rounds coordinates to 2 decimals', () => {
    const parsed = dailySuggestionSchema.parse({ garmentIds: ['a'], lat: 12.345678, lon: -77.98765 });
    expect(parsed.lat).toBe(12.35);
    expect(parsed.lon).toBe(-77.99);
  });
});
