import { SignJWT, jwtVerify } from 'jose';
import { cookies } from 'next/headers';

if (!process.env.JWT_SECRET) {
  throw new Error(
    'JWT_SECRET environment variable must be set. See .env.example for required configuration.'
  );
}

const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET);

const ADMIN_COOKIE_NAME = 'styleiq-admin-token';
const USER_COOKIE_NAME = 'styleiq-user-token';

export interface AdminSession {
  id: string;
  email: string;
  name: string;
}

export type UserSession = AdminSession;

async function signSession(payload: AdminSession, expiresIn: string): Promise<string> {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(expiresIn)
    .sign(JWT_SECRET);
}

async function verifySession(token: string): Promise<AdminSession | null> {
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET);
    return payload as unknown as AdminSession;
  } catch {
    return null;
  }
}

export async function createAdminToken(payload: AdminSession): Promise<string> {
  return signSession(payload, '24h');
}

export async function verifyAdminToken(token: string): Promise<AdminSession | null> {
  return verifySession(token);
}

export async function getAdminSession(): Promise<AdminSession | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(ADMIN_COOKIE_NAME)?.value;
  if (!token) return null;
  return verifySession(token);
}

export async function createUserToken(payload: UserSession): Promise<string> {
  return signSession(payload, '7d');
}

export async function verifyUserToken(token: string): Promise<UserSession | null> {
  return verifySession(token);
}

export async function getUserSession(): Promise<UserSession | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(USER_COOKIE_NAME)?.value;
  if (!token) return null;
  return verifySession(token);
}

export { ADMIN_COOKIE_NAME, USER_COOKIE_NAME };
