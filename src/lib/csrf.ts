import type { NextRequest } from 'next/server';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

/**
 * CSRF defence for the JSON API: a state-changing request carrying another
 * site's Origin is rejected. Session cookies are SameSite=Lax (which already
 * blocks most cross-site POSTs); this closes the remaining gaps, e.g. older
 * browsers or a sibling subdomain. Requests without an Origin header (curl,
 * server-to-server) can't carry a victim's cookies, so they pass.
 */
export function isCrossSiteWrite(request: NextRequest): boolean {
  if (SAFE_METHODS.has(request.method)) return false;
  if (request.headers.get('sec-fetch-site') === 'cross-site') return true;

  const origin = request.headers.get('origin');
  if (!origin) return false;
  let originHost: string;
  try {
    originHost = new URL(origin).host;
  } catch {
    return true; // "null" or garbage Origin on a write
  }

  const allowed = new Set([request.nextUrl.host]);
  const forwardedHost = request.headers.get('x-forwarded-host');
  if (forwardedHost) allowed.add(forwardedHost.split(',')[0].trim());
  if (process.env.NEXT_PUBLIC_APP_URL) {
    try {
      allowed.add(new URL(process.env.NEXT_PUBLIC_APP_URL).host);
    } catch {
      // validated at startup; ignore here
    }
  }
  return !allowed.has(originHost);
}
