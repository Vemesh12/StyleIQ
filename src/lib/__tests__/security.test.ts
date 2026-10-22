import { SignJWT } from 'jose';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { serializeJsonLd } from '../json-ld';
import { checkRateLimit, enforceRateLimits, getClientIp } from '../rate-limit';
import { signSessionToken, verifySessionToken } from '../session-token';

const payload = { id: 'u1', email: 'a@b.c', name: 'A' };
const secret = new TextEncoder().encode(process.env.JWT_SECRET);

describe('session tokens', () => {
  it('accepts a token only for the role it was issued for', async () => {
    const user = await signSessionToken(payload, 'user', '1h');
    const admin = await signSessionToken(payload, 'admin', '1h');
    expect((await verifySessionToken(user, 'user'))?.id).toBe('u1');
    expect(await verifySessionToken(user, 'admin')).toBeNull();
    expect((await verifySessionToken(admin, 'admin'))?.id).toBe('u1');
    expect(await verifySessionToken(admin, 'user')).toBeNull();
  });

  it('rejects old role-less tokens and tokens signed with another secret', async () => {
    const legacy = await new SignJWT({ ...payload }).setProtectedHeader({ alg: 'HS256' }).setExpirationTime('1h').sign(secret);
    expect(await verifySessionToken(legacy, 'admin')).toBeNull();
    const forged = await new SignJWT({ ...payload, role: 'admin' })
      .setProtectedHeader({ alg: 'HS256' })
      .setSubject('u1')
      .setIssuer('styleiq')
      .setAudience('admin')
      .setExpirationTime('1h')
      .sign(new TextEncoder().encode('some-other-secret-some-other-secret'));
    expect(await verifySessionToken(forged, 'admin')).toBeNull();
  });
});

describe('serializeJsonLd', () => {
  it('cannot break out of the script tag and still round-trips', () => {
    const out = serializeJsonLd({ headline: '</script><script>alert(1)</script>' + String.fromCharCode(0x2028) });
    expect(out).not.toContain('<');
    expect(out).not.toContain(String.fromCharCode(0x2028));
    expect(JSON.parse(out).headline.startsWith('</script>')).toBe(true);
  });
});

describe('rate limiting', () => {
  it('uses the proxy-appended (right-most) forwarded IP', () => {
    const req = (h: Record<string, string>) => new Request('http://x', { headers: h });
    expect(getClientIp(req({ 'x-forwarded-for': '6.6.6.6, 203.0.113.9' }))).toBe('203.0.113.9');
    expect(getClientIp(req({ 'x-real-ip': '198.51.100.2' }))).toBe('198.51.100.2');
  });

  it('blocks after the limit and reports Retry-After', async () => {
    const key = `test-${Math.random()}`;
    for (let i = 0; i < 3; i++) expect((await checkRateLimit(key, 3, 60_000)).allowed).toBe(true);
    const blocked = await checkRateLimit(key, 3, 60_000);
    expect(blocked.allowed).toBe(false);
    expect(blocked.retryAfterSeconds).toBeGreaterThan(0);
    const res = await enforceRateLimits([{ key, limit: 3, windowMs: 60_000 }]);
    expect(res?.status).toBe(429);
    expect(res?.headers.get('Retry-After')).toBeTruthy();
  });

  describe('with Upstash Redis configured', () => {
    afterEach(() => {
      vi.unstubAllEnvs();
      vi.unstubAllGlobals();
    });

    it('uses the shared Redis counter', async () => {
      vi.stubEnv('UPSTASH_REDIS_REST_URL', 'https://redis.example');
      vi.stubEnv('UPSTASH_REDIS_REST_TOKEN', 'token');
      let count = 0;
      const fetchMock = vi.fn(async () => new Response(JSON.stringify([{ result: ++count }, { result: 1 }, { result: 30_000 }])));
      vi.stubGlobal('fetch', fetchMock);
      const key = `redis-${Math.random()}`;
      expect((await checkRateLimit(key, 2, 60_000)).allowed).toBe(true);
      expect((await checkRateLimit(key, 2, 60_000)).allowed).toBe(true);
      const third = await checkRateLimit(key, 2, 60_000);
      expect(third).toEqual({ allowed: false, retryAfterSeconds: 30 });
      expect(fetchMock).toHaveBeenCalledWith('https://redis.example/pipeline', expect.objectContaining({ method: 'POST' }));
    });

    it('falls back to in-memory limits when Redis is down', async () => {
      vi.stubEnv('UPSTASH_REDIS_REST_URL', 'https://redis.example');
      vi.stubEnv('UPSTASH_REDIS_REST_TOKEN', 'token');
      vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('network down'); }));
      vi.spyOn(console, 'error').mockImplementation(() => {});
      const key = `fallback-${Math.random()}`;
      expect((await checkRateLimit(key, 1, 60_000)).allowed).toBe(true);
      expect((await checkRateLimit(key, 1, 60_000)).allowed).toBe(false);
    });
  });
});
