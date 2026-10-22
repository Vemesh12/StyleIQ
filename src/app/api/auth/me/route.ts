import { getUserSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { NextResponse } from 'next/server';

export async function GET() {
  const session = await getUserSession();
  if (!session) return NextResponse.json({ user: null, styleProfile: null });

  // The saved style profile comes along so the browser can personalize
  // straight away after sign-in on a new device.
  const row = await prisma.user.findUnique({ where: { id: session.id }, select: { styleProfile: true } });
  return NextResponse.json({ user: session, styleProfile: row?.styleProfile ?? null });
}
