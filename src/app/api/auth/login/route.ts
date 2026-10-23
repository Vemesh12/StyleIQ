import { createUserToken, findUserByEmail, USER_COOKIE_NAME } from '@/lib/auth';
import { NextRequest, NextResponse } from 'next/server';
import { verifyPassword } from '@/lib/password';
import { loginSchema } from '@/lib/validation';
import { enforceLoginRateLimits, getClientIp, recordLoginFailure, type LoginLimits } from '@/lib/rate-limit';

const LOGIN_LIMITS: LoginLimits = {
  scope: 'login',
  ipAccountLimit: 5,
  ipLimit: 30,
  accountFailureLimit: 15,
  windowMs: 15 * 60 * 1000,
};

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => null);
    const parsed = loginSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
    }
    const { email, password } = parsed.data;

    // Per IP+account (normal typo protection), per IP across all accounts
    // (one IP spraying many accounts), and failed attempts per account across
    // all IPs (distributed guessing) — which a clean IP bypasses, so attackers
    // can't lock the real owner out.
    const ip = getClientIp(request);
    const limited = await enforceLoginRateLimits(LOGIN_LIMITS, ip, email);
    if (limited) return limited;

    const user = await findUserByEmail(email);
    // Always runs a bcrypt comparison (against a dummy hash when the account
    // doesn't exist) so timing doesn't reveal which emails are registered.
    const valid = await verifyPassword(password, user?.password);
    if (!user || !valid) {
      await recordLoginFailure(LOGIN_LIMITS, ip, email);
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
