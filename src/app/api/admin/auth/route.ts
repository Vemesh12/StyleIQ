import { prisma } from '@/lib/prisma';
import { createAdminToken, ADMIN_COOKIE_NAME } from '@/lib/auth';
import { NextRequest, NextResponse } from 'next/server';
import { verifyPassword } from '@/lib/password';
import { loginSchema } from '@/lib/validation';
import { enforceRateLimits, getClientIp } from '@/lib/rate-limit';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = loginSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
    }
    const { email, password } = parsed.data;

    const ip = getClientIp(request);
    const account = email.toLowerCase();
    const WINDOW = 15 * 60 * 1000;
    const limited = await enforceRateLimits(
      [
        { key: `admin-login:ip-acct:${ip}:${account}`, limit: 5, windowMs: WINDOW },
        { key: `admin-login:acct:${account}`, limit: 10, windowMs: WINDOW },
        { key: `admin-login:ip:${ip}`, limit: 15, windowMs: WINDOW },
      ],
      'Too many login attempts. Please try again later.'
    );
    if (limited) return limited;

    const admin = await prisma.adminUser.findUnique({
      where: { email },
    });

    // Constant-work check: unknown email and wrong password take the same time.
    const valid = await verifyPassword(password, admin?.password);
    if (!admin || !valid) {
      return NextResponse.json(
        { error: 'Invalid credentials' },
        { status: 401 }
      );
    }

    const token = await createAdminToken({
      id: admin.id,
      email: admin.email,
      name: admin.name,
    });

    const response = NextResponse.json({ success: true, name: admin.name });
    response.cookies.set(ADMIN_COOKIE_NAME, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24, // 24 hours
      path: '/',
    });

    return response;
  } catch (error) {
    console.error('Login error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function DELETE() {
  const response = NextResponse.json({ success: true });
  response.cookies.delete(ADMIN_COOKIE_NAME);
  return response;
}
