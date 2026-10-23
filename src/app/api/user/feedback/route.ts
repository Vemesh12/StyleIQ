import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getUserSession } from '@/lib/auth';
import { feedbackSchema } from '@/lib/validation';
import { outfitKey } from '@/lib/user-signals';
import { clientErrorResponse } from '@/lib/api-errors';

// Votes kept per user; older ones are pruned. Matches what the ranking reads.
const MAX_FEEDBACK_PER_USER = 500;

// Thumbs up / down on a suggested outfit. Re-ranks this user's future daily
// suggestions, quick picks and "complete my outfit" results.

export async function GET() {
  const user = await getUserSession();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const rows = await prisma.outfitFeedback.findMany({
    where: { userId: user.id },
    select: { outfitKey: true, rating: true },
    orderBy: { updatedAt: 'desc' },
    take: MAX_FEEDBACK_PER_USER,
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

  try {
    if (rating === 0) {
      await prisma.outfitFeedback.deleteMany({ where: { userId: user.id, outfitKey: key } });
      return NextResponse.json({ outfitKey: key, rating: 0 });
    }

    // Only rate garments that exist and this user can see (catalog or own).
    const known = await prisma.garment.count({
      where: { id: { in: garmentIds }, OR: [{ ownerId: null }, { ownerId: user.id }] },
    });
    if (known !== garmentIds.length) return NextResponse.json({ error: 'Unknown garment.' }, { status: 400 });

    await prisma.outfitFeedback.upsert({
      where: { userId_outfitKey: { userId: user.id, outfitKey: key } },
      update: { rating },
      create: { userId: user.id, outfitKey: key, garmentIds: key.split('|'), rating },
    });

    // Keep only the most recent votes (the same window the ranking reads).
    const stale = await prisma.outfitFeedback.findMany({
      where: { userId: user.id },
      orderBy: { updatedAt: 'desc' },
      skip: MAX_FEEDBACK_PER_USER,
      select: { id: true },
    });
    if (stale.length) await prisma.outfitFeedback.deleteMany({ where: { id: { in: stale.map((r) => r.id) } } });

    return NextResponse.json({ outfitKey: key, rating });
  } catch (error) {
    const clientError = clientErrorResponse(error, { unique: 'That vote was just saved — try again.' });
    if (clientError) return clientError;
    console.error('Error saving outfit feedback:', error);
    return NextResponse.json({ error: 'Failed to save your vote.' }, { status: 500 });
  }
}
