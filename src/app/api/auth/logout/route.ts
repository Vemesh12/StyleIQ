import { USER_COOKIE_NAME } from '@/lib/auth';
import { NextResponse } from 'next/server';

export async function POST() {
  const response = NextResponse.json({ success: true });
  response.cookies.delete(USER_COOKIE_NAME);
  return response;
}
