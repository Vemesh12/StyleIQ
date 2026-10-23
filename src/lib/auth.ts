import { cookies } from 'next/headers';
import { prisma } from '@/lib/prisma';
import {
  signSessionToken,
  verifySessionToken,
  ADMIN_COOKIE_NAME,
  USER_COOKIE_NAME,
  type SessionPayload,
} from '@/lib/session-token';

export type AdminSession = SessionPayload;
export type UserSession = SessionPayload;

export async function createAdminToken(payload: AdminSession): Promise<string> {
  return signSessionToken(payload, 'admin', '24h');
}

export async function createUserToken(payload: UserSession): Promise<string> {
  return signSessionToken(payload, 'user', '7d');
}

// Sessions are re-checked against the database on every call, so deleting an
// admin/user account revokes their outstanding tokens immediately instead of
// leaving them valid until expiry. Returned name/email are the current DB
// values, not whatever was frozen into the token.
export async function getAdminSession(): Promise<AdminSession | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(ADMIN_COOKIE_NAME)?.value;
  if (!token) return null;

  const claims = await verifySessionToken(token, 'admin');
  if (!claims) return null;

  return prisma.adminUser.findUnique({
    where: { id: claims.id },
    select: { id: true, email: true, name: true },
  });
}

export async function getUserSession(): Promise<UserSession | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(USER_COOKIE_NAME)?.value;
  if (!token) return null;

  const claims = await verifySessionToken(token, 'user');
  if (!claims) return null;

  return prisma.user.findUnique({
    where: { id: claims.id },
    select: { id: true, email: true, name: true },
  });
}

// Emails are stored lowercased (see the lowercase_emails migration), so an
// exact match on the normalized email is the normal path. The case-insensitive
// fallback covers any legacy mixed-case row the migration had to leave alone
// because a lowercase twin already existed.
export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export async function findUserByEmail(email: string) {
  const normalized = normalizeEmail(email);
  return (
    (await prisma.user.findUnique({ where: { email: normalized } })) ??
    (await prisma.user.findFirst({
      where: { email: { equals: normalized, mode: 'insensitive' } },
      orderBy: { createdAt: 'asc' },
    }))
  );
}

export async function findAdminByEmail(email: string) {
  const normalized = normalizeEmail(email);
  return (
    (await prisma.adminUser.findUnique({ where: { email: normalized } })) ??
    (await prisma.adminUser.findFirst({
      where: { email: { equals: normalized, mode: 'insensitive' } },
      orderBy: { createdAt: 'asc' },
    }))
  );
}

export { ADMIN_COOKIE_NAME, USER_COOKIE_NAME };
