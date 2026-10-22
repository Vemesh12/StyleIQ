import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getUserSession } from '@/lib/auth';
import { profileUpdateSchema } from '@/lib/validation';

// The Style Advisor profile, stored on the account so personalization follows
// the person across devices (the browser keeps a copy for guests and offline).

export async function GET() {
  const user = await getUserSession();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const row = await prisma.user.findUnique({ where: { id: user.id }, select: { styleProfile: true } });
  return NextResponse.json({ profile: row?.styleProfile ?? null });
}

export async function PUT(request: NextRequest) {
  const user = await getUserSession();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const parsed = profileUpdateSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }
  // Drop empty fields so the stored profile only holds what was chosen.
  const profile = Object.fromEntries(Object.entries(parsed.data.profile).filter(([, v]) => v));
  await prisma.user.update({ where: { id: user.id }, data: { styleProfile: profile } });
  return NextResponse.json({ profile });
}
