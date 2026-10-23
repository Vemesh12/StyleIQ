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

/** Current state of a bucket without counting a hit. */
function memoryPeek(key: string, limit: number): RateLimitResult {
  const now = Date.now();
  const bucket = buckets.get(key);
  if (!bucket || bucket.resetAt <= now || bucket.count < limit) return { allowed: true, retryAfterSeconds: 0 };
  return { allowed: false, retryAfterSeconds: Math.ceil((bucket.resetAt - now) / 1000) };
}

/** Counts a hit unconditionally (no limit), starting the window if needed. */
function memoryRecord(key: string, windowMs: number) {
  const now = Date.now();
  cleanupExpiredBuckets(now);
  const bucket = buckets.get(key);
  if (!bucket || bucket.resetAt <= now) buckets.set(key, { count: 1, resetAt: now + windowMs });
  else bucket.count += 1;
}

// ---------------------------------------------------------------------------
// Upstash Redis backend
// ---------------------------------------------------------------------------

let redisWarned = false;

type RedisReply = { result?: number | string | null; error?: string };

/** Runs commands in one Upstash pipeline; null when Redis isn't configured or fails. */
async function redisPipeline(commands: string[][]): Promise<RedisReply[] | null> {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;

  try {
    const res = await fetch(`${url.replace(/\/$/, '')}/pipeline`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(commands),
      cache: 'no-store',
      signal: AbortSignal.timeout(1500),
    });
    if (!res.ok) throw new Error(`Upstash responded ${res.status}`);
    const replies = (await res.json()) as RedisReply[];
    if (!Array.isArray(replies)) throw new Error('Unexpected Upstash response');
    const failed = replies.find((r) => r?.error);
    if (failed) throw new Error(failed.error);
    return replies;
  } catch (error) {
    if (!redisWarned) {
      redisWarned = true;
      console.error('Rate limiter: Redis unavailable, falling back to in-memory limits.', error);
    }
    return null;
  }
}

const redisKey = (key: string) => `styleiq:rl:${key}`;
const ttlFrom = (reply: RedisReply | undefined, windowMs: number) =>
  typeof reply?.result === 'number' && reply.result > 0 ? reply.result : windowMs;

async function redisHit(key: string, limit: number, windowMs: number): Promise<RateLimitResult | null> {
  const k = redisKey(key);
  // INCR, start the window on first hit only (NX), then read the remaining TTL.
  const replies = await redisPipeline([
    ['INCR', k],
    ['PEXPIRE', k, String(windowMs), 'NX'],
    ['PTTL', k],
  ]);
  if (!replies) return null;
  const [incr, , pttl] = replies;
  if (typeof incr?.result !== 'number') return null;
  return incr.result <= limit
    ? { allowed: true, retryAfterSeconds: 0 }
    : { allowed: false, retryAfterSeconds: Math.ceil(ttlFrom(pttl, windowMs) / 1000) };
}

async function redisPeek(key: string, limit: number, windowMs: number): Promise<RateLimitResult | null> {
  const k = redisKey(key);
  const replies = await redisPipeline([
    ['GET', k],
    ['PTTL', k],
  ]);
  if (!replies) return null;
  const [get, pttl] = replies;
  const count = get?.result == null ? 0 : Number(get.result);
  if (!Number.isFinite(count)) return null;
  return count < limit
    ? { allowed: true, retryAfterSeconds: 0 }
    : { allowed: false, retryAfterSeconds: Math.ceil(ttlFrom(pttl, windowMs) / 1000) };
}

async function redisRecord(key: string, windowMs: number): Promise<boolean> {
  const k = redisKey(key);
  const replies = await redisPipeline([
    ['INCR', k],
    ['PEXPIRE', k, String(windowMs), 'NX'],
  ]);
  return replies !== null;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export async function checkRateLimit(key: string, limit = 5, windowMs = 15 * 60 * 1000): Promise<RateLimitResult> {
  return (await redisHit(key, limit, windowMs)) ?? memoryHit(key, limit, windowMs);
}

/**
 * Reads a bucket WITHOUT counting this request: not allowed once `limit`
 * hits were recorded in the current window. Pair with recordRateLimitHit for
 * buckets that only count some outcomes (e.g. failed logins).
 */
export async function peekRateLimit(key: string, limit: number, windowMs: number): Promise<RateLimitResult> {
  return (await redisPeek(key, limit, windowMs)) ?? memoryPeek(key, limit);
}

/** Counts one hit against a bucket (no limit check). */
export async function recordRateLimitHit(key: string, windowMs: number): Promise<void> {
  if (!(await redisRecord(key, windowMs))) memoryRecord(key, windowMs);
}

const tooMany = (message: string, retryAfterSeconds: number) =>
  NextResponse.json({ error: message }, { status: 429, headers: { 'Retry-After': String(retryAfterSeconds) } });

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
    if (!allowed) return tooMany(message, retryAfterSeconds);
  }
  return null;
}

// ---------------------------------------------------------------------------
// Login limits
// ---------------------------------------------------------------------------

export interface LoginLimits {
  /** Key prefix, e.g. 'login' or 'admin-login'. */
  scope: string;
  /** Every attempt from one IP, across all accounts (spraying). */
  ipLimit: number;
  /** Every attempt from one IP against one account (typos, single-source guessing). */
  ipAccountLimit: number;
  /** FAILED attempts against one account from anywhere (distributed guessing). */
  accountFailureLimit: number;
  windowMs: number;
}

/**
 * Rate limits for a login attempt. The per-account bucket counts only
 * failures, and an IP with no recent failures bypasses it, so an attacker
 * hammering an account (e.g. the admin's) can't lock its owner out: the
 * owner's clean IP still gets through, while every IP that has been failing
 * stays blocked from that account until the window passes.
 */
export async function enforceLoginRateLimits(
  limits: LoginLimits,
  ip: string,
  account: string,
  message = 'Too many login attempts. Please try again later.'
): Promise<NextResponse | null> {
  const { scope, windowMs } = limits;
  const counted = await enforceRateLimits(
    [
      { key: `${scope}:ip-acct:${ip}:${account}`, limit: limits.ipAccountLimit, windowMs },
      { key: `${scope}:ip:${ip}`, limit: limits.ipLimit, windowMs },
    ],
    message
  );
  if (counted) return counted;

  const accountFailures = await peekRateLimit(`${scope}:acct-fail:${account}`, limits.accountFailureLimit, windowMs);
  if (accountFailures.allowed) return null;
  const ipIsClean = (await peekRateLimit(`${scope}:ip-fail:${ip}`, 1, windowMs)).allowed;
  return ipIsClean ? null : tooMany(message, accountFailures.retryAfterSeconds);
}

/** Call after a failed login so the failure-only buckets see it. */
export async function recordLoginFailure(limits: LoginLimits, ip: string, account: string): Promise<void> {
  await Promise.all([
    recordRateLimitHit(`${limits.scope}:acct-fail:${account}`, limits.windowMs),
    recordRateLimitHit(`${limits.scope}:ip-fail:${ip}`, limits.windowMs),
  ]);
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
