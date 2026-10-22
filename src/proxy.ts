import { NextResponse, type NextRequest } from 'next/server';
import { verifySessionToken, ADMIN_COOKIE_NAME } from '@/lib/session-token';
import { isCrossSiteWrite } from '@/lib/csrf';

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (pathname.startsWith('/api/')) {
    if (isCrossSiteWrite(request)) {
      return NextResponse.json({ error: 'Cross-site request blocked.' }, { status: 403 });
    }
    return NextResponse.next();
  }

  // Optimistic gate in front of the admin panel: bounce anyone without a
  // valid admin-role token to the login page before any admin page renders.
  // NOT the authorization boundary — src/app/admin/(panel)/layout.tsx and
  // every /api/admin route re-check the session against the database.
  //
  // The login page must stay reachable even with a signature-valid token,
  // otherwise a token for a since-deleted admin would bounce between here and
  // the panel layout's DB check forever.
  if (pathname === '/admin/login') return NextResponse.next();

  const token = request.cookies.get(ADMIN_COOKIE_NAME)?.value;
  const session = token ? await verifySessionToken(token, 'admin') : null;
  if (!session) {
    return NextResponse.redirect(new URL('/admin/login', request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/admin', '/admin/:path*', '/api/:path*'],
};
