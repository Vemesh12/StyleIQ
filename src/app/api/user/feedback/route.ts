import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getUserSession } from '@/lib/auth';
import { feedbackSchema } from '@/lib/validation';
import { outfitKey } from '@/lib/user-signals';

// Thumbs up / down on a suggested outfit. Re-ranks this user's future daily
// suggestions, quick picks and "complete my outfit" results.

export async function GET() {
  const user = await getUserSession();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const rows = await prisma.outfitFeedback.findMany({
    where: { userId: user.id },
    select: { outfitKey: true, rating: true },
    orderBy: { updatedAt: 'desc' },
    take: 500,
  });
  return NextResponse.json(Object.fromEntries(rows.map((r) => [r.outfitKey, r.rating])));
}

export async function POST(request: NextRequest) {
  const user = await getUserSession();
  if (!user) return NextResponse.json({ error: 'Sign in to rate outfits.' }, { status: 401 });

  const parsed = feedbackSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }
  const { garmentIds, rating } = parsed.data;
  const key = outfitKey(garmentIds);

  if (rating === 0) {
    await prisma.outfitFeedback.deleteMany({ where: { userId: user.id, outfitKey: key } });
    return NextResponse.json({ outfitKey: key, rating: 0 });
  }
  await prisma.outfitFeedback.upsert({
    where: { userId_outfitKey: { userId: user.id, outfitKey: key } },
    update: { rating },
    create: { userId: user.id, outfitKey: key, garmentIds: key.split('|'), rating },
  });
  return NextResponse.json({ outfitKey: key, rating });
}
