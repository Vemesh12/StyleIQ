import { NextResponse } from 'next/server';

// Fixed-window rate limiter with two backends:
//
//  - Upstash Redis (when UPSTASH_REDIS_REST_URL / _TOKEN are set): shared by
//    every server instance, so limits hold on serverless / multi-instance
//    deployments. Talks to Upstash's REST API with fetch — no extra package.
//  - In-memory (default, and fallback if Redis is unreachable): per process,
//    resets on restart. Fine for a single instance and local development.

export interface RateLimitResult {
  allowed: boolean;
  retryAfterSeconds: number;
}

// ---------------------------------------------------------------------------
// In-memory backend
// ---------------------------------------------------------------------------

interface Bucket {
  count: number;
  resetAt: number;
}

const buckets = new Map<string, Bucket>();

// Keys include user input (emails), so the map is bounded: expired buckets
// are swept first, then the oldest are dropped past the cap.
const MAX_BUCKETS = 10_000;

function cleanupExpiredBuckets(now: number) {
  if (buckets.size <= 1000) return;
  for (const [key, bucket] of buckets.entries()) {
    if (bucket.resetAt <= now) buckets.delete(key);
  }
  for (const key of buckets.keys()) {
    if (buckets.size <= MAX_BUCKETS) break;
    buckets.delete(key);
  }
}

function memoryHit(key: string, limit: number, windowMs: number): RateLimitResult {
  const now = Date.now();
  cleanupExpiredBuckets(now);

  const bucket = buckets.get(key);
  if (!bucket || bucket.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, retryAfterSeconds: 0 };
  }
  if (bucket.count >= limit) {
    return { allowed: false, retryAfterSeconds: Math.ceil((bucket.resetAt - now) / 1000) };
  }
  bucket.count += 1;
  return { allowed: true, retryAfterSeconds: 0 };
}

// ---------------------------------------------------------------------------
// Upstash Redis backend
// ---------------------------------------------------------------------------

let redisWarned = false;

async function redisHit(key: string, limit: number, windowMs: number): Promise<RateLimitResult | null> {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;

  try {
    const redisKey = `styleiq:rl:${key}`;
    const res = await fetch(`${url.replace(/\/$/, '')}/pipeline`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      // INCR, start the window on first hit only (NX), then read the remaining TTL.
      body: JSON.stringify([
        ['INCR', redisKey],
        ['PEXPIRE', redisKey, String(windowMs), 'NX'],
        ['PTTL', redisKey],
      ]),
      cache: 'no-store',
      signal: AbortSignal.timeout(1500),
    });
    if (!res.ok) throw new Error(`Upstash responded ${res.status}`);
    const [incr, , pttl] = (await res.json()) as { result?: number; error?: string }[];
    if (typeof incr?.result !== 'number') throw new Error(incr?.error || 'Unexpected Upstash response');
    const ttlMs = typeof pttl?.result === 'number' && pttl.result > 0 ? pttl.result : windowMs;
    return incr.result <= limit
      ? { allowed: true, retryAfterSeconds: 0 }
      : { allowed: false, retryAfterSeconds: Math.ceil(ttlMs / 1000) };
  } catch (error) {
    if (!redisWarned) {
      redisWarned = true;
      console.error('Rate limiter: Redis unavailable, falling back to in-memory limits.', error);
    }
    return null;
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export async function checkRateLimit(key: string, limit = 5, windowMs = 15 * 60 * 1000): Promise<RateLimitResult> {
  return (await redisHit(key, limit, windowMs)) ?? memoryHit(key, limit, windowMs);
}

/**
 * Checks several buckets at once (e.g. per-IP, per-account, per-IP+account)
 * and returns a ready 429 response if any of them is exhausted, else null.
 */
export async function enforceRateLimits(
  checks: { key: string; limit: number; windowMs: number }[],
  message = 'Too many requests. Please try again later.'
): Promise<NextResponse | null> {
  for (const { key, limit, windowMs } of checks) {
    const { allowed, retryAfterSeconds } = await checkRateLimit(key, limit, windowMs);
    if (!allowed) {
      return NextResponse.json(
        { error: message },
        { status: 429, headers: { 'Retry-After': String(retryAfterSeconds) } }
      );
    }
  }
  return null;
}

/**
 * Best-effort client IP for rate-limit keys.
 *
 * The LEFT-most X-Forwarded-For entries are whatever the client sent and can
 * be forged freely; only entries appended by our own reverse proxies are
 * trustworthy. So we count TRUSTED_PROXY_HOPS entries in from the RIGHT
 * (default 1 = a single proxy/load balancer in front of the app, e.g. Vercel,
 * nginx). Next.js only fills X-Forwarded-For from the socket when the header
 * is absent, so without any reverse proxy a client can still pick its own
 * value — production deployments must sit behind a proxy that appends it.
 */
export function getClientIp(request: Request): string {
  const hops = Math.max(1, Number.parseInt(process.env.TRUSTED_PROXY_HOPS ?? '1', 10) || 1);

  const forwarded = request.headers
    .get('x-forwarded-for')
    ?.split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  if (forwarded && forwarded.length > 0) {
    return forwarded[Math.max(0, forwarded.length - hops)];
  }

  return request.headers.get('x-real-ip')?.trim() || 'unknown';
}
