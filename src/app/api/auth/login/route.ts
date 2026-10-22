import { prisma } from '@/lib/prisma';
import { createUserToken, USER_COOKIE_NAME } from '@/lib/auth';
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
    // Per IP+account (normal typo protection), per account across all IPs
    // (distributed guessing of one password), and per IP across all accounts
    // (one IP spraying many accounts).
    const limited = await enforceRateLimits(
      [
        { key: `login:ip-acct:${ip}:${account}`, limit: 5, windowMs: WINDOW },
        { key: `login:acct:${account}`, limit: 15, windowMs: WINDOW },
        { key: `login:ip:${ip}`, limit: 30, windowMs: WINDOW },
      ],
      'Too many login attempts. Please try again later.'
    );
    if (limited) return limited;

    const user = await prisma.user.findUnique({ where: { email } });
    // Always runs a bcrypt comparison (against a dummy hash when the account
    // doesn't exist) so timing doesn't reveal which emails are registered.
    const valid = await verifyPassword(password, user?.password);
    if (!user || !valid) {
      return NextResponse.json({ error: 'Invalid email or password' }, { status: 401 });
    }

    const token = await createUserToken({
      id: user.id,
      email: user.email,
      name: user.name,
    });

    const response = NextResponse.json({ success: true, user: { id: user.id, name: user.name, email: user.email } });
    response.cookies.set(USER_COOKIE_NAME, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7, // 7 days
      path: '/',
    });

    return response;
  } catch (error) {
    console.error('Login error:', error);
    return NextResponse.json({ error: 'Failed to login' }, { status: 500 });
  }
}
