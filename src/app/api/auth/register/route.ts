import { prisma } from '@/lib/prisma';
import { createUserToken, USER_COOKIE_NAME } from '@/lib/auth';
import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { registerSchema } from '@/lib/validation';
import { enforceRateLimits, getClientIp } from '@/lib/rate-limit';

export async function POST(request: NextRequest) {
  try {
    // Registration necessarily reveals whether an email is taken (there is no
    // email-verification flow to hide it behind), so the defence here is a
    // tight per-IP limit that makes bulk email probing slow.
    const limited = await enforceRateLimits(
      [{ key: `register:${getClientIp(request)}`, limit: 5, windowMs: 15 * 60 * 1000 }],
      'Too many registration attempts. Please try again later.'
    );
    if (limited) return limited;

    const body = await request.json();
    const parsed = registerSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
    }
    const { name, email, password } = parsed.data;

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return NextResponse.json({ error: 'An account with this email already exists. Try signing in instead.' }, { status: 409 });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const user = await prisma.user.create({
      data: {
        name: name || email.split('@')[0],
        email,
        password: hashedPassword,
      },
    });

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
    console.error('Registration error:', error);
    return NextResponse.json({ error: 'Failed to register' }, { status: 500 });
  }
}
