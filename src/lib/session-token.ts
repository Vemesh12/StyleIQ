import { SignJWT, jwtVerify } from 'jose';

// Signing/verification only — no DB or next/headers imports, so this module is
// safe to use from proxy.ts as well as route handlers.

if (!process.env.JWT_SECRET) {
  throw new Error(
    'JWT_SECRET environment variable must be set. See .env.example for required configuration.'
  );
}
if (process.env.JWT_SECRET.length < 32) {
  console.warn('JWT_SECRET is shorter than 32 characters — generate a stronger one with `openssl rand -base64 32`.');
}

const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET);
const ISSUER = 'styleiq';

export const ADMIN_COOKIE_NAME = 'styleiq-admin-token';
export const USER_COOKIE_NAME = 'styleiq-user-token';

// The role is bound into both a `role` claim and the JWT audience, so a user
// token can never be accepted where an admin token is required (and vice
// versa), even though both are signed with the same secret.
export type SessionRole = 'admin' | 'user';

export interface SessionPayload {
  id: string;
  email: string;
  name: string;
}

export async function signSessionToken(
  payload: SessionPayload,
  role: SessionRole,
  expiresIn: string
): Promise<string> {
  return new SignJWT({ email: payload.email, name: payload.name, role })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(payload.id)
    .setIssuer(ISSUER)
    .setAudience(role)
    .setIssuedAt()
    .setExpirationTime(expiresIn)
    .sign(JWT_SECRET);
}

/**
 * Verifies signature, expiry, issuer, audience and role. Does NOT check that
 * the account still exists — use getAdminSession/getUserSession in
 * src/lib/auth.ts for that. Proxy uses this alone as an optimistic check.
 */
export async function verifySessionToken(token: string, role: SessionRole): Promise<SessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET, {
      algorithms: ['HS256'],
      issuer: ISSUER,
      audience: role,
    });
    if (payload.role !== role || typeof payload.sub !== 'string') return null;
    return {
      id: payload.sub,
      email: typeof payload.email === 'string' ? payload.email : '',
      name: typeof payload.name === 'string' ? payload.name : '',
    };
  } catch {
    return null;
  }
}
