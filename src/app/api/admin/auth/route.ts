import { createAdminToken, findAdminByEmail, ADMIN_COOKIE_NAME } from '@/lib/auth';
import { NextRequest, NextResponse } from 'next/server';
import { verifyPassword } from '@/lib/password';
import { loginSchema } from '@/lib/validation';
import { enforceLoginRateLimits, getClientIp, recordLoginFailure, type LoginLimits } from '@/lib/rate-limit';

const ADMIN_LOGIN_LIMITS: LoginLimits = {
  scope: 'admin-login',
  ipAccountLimit: 5,
  ipLimit: 15,
  accountFailureLimit: 10,
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

    // The per-account bucket only counts failures and is bypassed by IPs with
    // no recent failures, so nobody can lock the admin out by spamming logins.
    const ip = getClientIp(request);
    const limited = await enforceLoginRateLimits(ADMIN_LOGIN_LIMITS, ip, email);
    if (limited) return limited;

    const admin = await findAdminByEmail(email);

    // Constant-work check: unknown email and wrong password take the same time.
    const valid = await verifyPassword(password, admin?.password);
    if (!admin || !valid) {
      await recordLoginFailure(ADMIN_LOGIN_LIMITS, ip, email);
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
