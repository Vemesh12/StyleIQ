import { PrismaClient } from '@prisma/client';
import { signSessionToken } from '../../src/lib/session-token';

export const BASE = process.env.E2E_BASE_URL || 'http://localhost:3000';
export const prisma = new PrismaClient();
export const TAG = `e2e${Date.now().toString(36)}`;

/** A browser-like client: keeps its session cookie and sends a same-site Origin. */
export class Client {
  cookie = '';

  async request(method: string, path: string, body?: unknown, headers: Record<string, string> = {}) {
    const res = await fetch(BASE + path, {
      method,
      redirect: 'manual',
      headers: {
        ...(body !== undefined ? { 'content-type': 'application/json' } : {}),
        ...(method !== 'GET' ? { origin: BASE } : {}),
        ...(this.cookie ? { cookie: this.cookie } : {}),
        ...headers,
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const setCookie = res.headers.get('set-cookie');
    if (setCookie) this.cookie = setCookie.split(';')[0];
    const text = await res.text();
    let data: unknown = text;
    try {
      data = JSON.parse(text);
    } catch {
      // HTML/plain responses stay as text
    }
    return { status: res.status, data: data as any, headers: res.headers }; // eslint-disable-line @typescript-eslint/no-explicit-any
  }

  get = (path: string) => this.request('GET', path);
  post = (path: string, body: unknown, headers?: Record<string, string>) => this.request('POST', path, body, headers);
  put = (path: string, body: unknown) => this.request('PUT', path, body);
  del = (path: string) => this.request('DELETE', path);
}

/**
 * A fresh user (tagged for cleanup) with a signed-in client. Created directly
 * in the database rather than via /api/auth/register so repeated runs don't
 * hit the registration rate limit.
 */
export async function newUser(label: string): Promise<{ client: Client; id: string; email: string }> {
  const email = `${TAG}-${label}@example.com`;
  const user = await prisma.user.create({ data: { email, name: `E2E ${label}`, password: 'not-used-in-e2e' } });
  const client = new Client();
  client.cookie = `styleiq-user-token=${await signSessionToken({ id: user.id, email, name: user.name }, 'user', '1h')}`;
  return { client, id: user.id, email };
}

/** A client carrying a valid admin session for the first admin account. */
export async function adminClient(): Promise<Client> {
  const admin = await prisma.adminUser.findFirst();
  if (!admin) throw new Error('No admin user in the database — run the seed first.');
  const client = new Client();
  client.cookie = `styleiq-admin-token=${await signSessionToken({ id: admin.id, email: admin.email, name: admin.name }, 'admin', '1h')}`;
  return client;
}

/** Removes everything the suite created. */
export async function cleanup() {
  await prisma.user.deleteMany({ where: { email: { startsWith: `${TAG}-` } } }); // cascades own items, logs, feedback
  await prisma.garment.deleteMany({ where: { slug: { startsWith: `${TAG}-` } } });
  await prisma.$disconnect();
}
