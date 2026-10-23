import { prisma } from '@/lib/prisma';
import { createUserToken, findUserByEmail, USER_COOKIE_NAME } from '@/lib/auth';
import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { registerSchema } from '@/lib/validation';
import { enforceRateLimits, getClientIp } from '@/lib/rate-limit';
import { prismaErrorCode } from '@/lib/api-errors';

const EMAIL_TAKEN = 'An account with this email already exists. Try signing in instead.';

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

    const body = await request.json().catch(() => null);
    const parsed = registerSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
    }
    const { name, email, password } = parsed.data;

    const existing = await findUserByEmail(email);
    if (existing) {
      return NextResponse.json({ error: EMAIL_TAKEN }, { status: 409 });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    let user;
    try {
      user = await prisma.user.create({
        data: {
          name: name || email.split('@')[0],
          email,
          password: hashedPassword,
        },
      });
    } catch (error) {
      // Two sign-ups for the same email racing past the check above.
      if (prismaErrorCode(error) === 'P2002') return NextResponse.json({ error: EMAIL_TAKEN }, { status: 409 });
      throw error;
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
    console.error('Registration error:', error);
    return NextResponse.json({ error: 'Failed to register' }, { status: 500 });
  }
}
