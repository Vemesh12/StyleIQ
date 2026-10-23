import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getUserSession } from '@/lib/auth';
import { wearLogSchema } from '@/lib/validation';
import { toDateOnly } from '@/lib/user-signals';
import { clientErrorResponse } from '@/lib/api-errors';

// "I wore this" history — the outfit calendar. Recent entries also keep the
// daily suggestion from repeating the same pieces day after day.

const MAX_ENTRIES_PER_DAY = 5;
// Nearly three years of daily logging; older entries are pruned on write.
const MAX_ENTRIES_PER_USER = 1000;

export async function GET(request: NextRequest) {
  const user = await getUserSession();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const days = Math.min(365, Math.max(1, parseInt(new URL(request.url).searchParams.get('days') || '60') || 60));
  const since = new Date(Date.now() - days * 86_400_000);
  const logs = await prisma.wearLog.findMany({
    where: { userId: user.id, wornOn: { gte: since } },
    orderBy: [{ wornOn: 'desc' }, { createdAt: 'desc' }],
  });

  // Resolve garment names/colors in one query. History keeps ids even if a
  // garment was later deleted; those show as "Removed item".
  const ids = [...new Set(logs.flatMap((l) => l.garmentIds))];
  const garments = await prisma.garment.findMany({
    where: { id: { in: ids }, OR: [{ ownerId: null }, { ownerId: user.id }] },
    include: { garmentType: true, colors: { where: { isPrimary: true }, include: { color: true } } },
  });
  const byId = new Map(garments.map((g) => [g.id, g]));

  return NextResponse.json(
    logs.map((l) => ({
      id: l.id,
      wornOn: l.wornOn.toISOString().slice(0, 10),
      outfitScore: l.outfitScore,
      items: l.garmentIds.map((gid) => {
        const g = byId.get(gid);
        return g
          ? { id: g.id, name: g.name, slug: g.ownerId ? undefined : g.slug, typeSlug: g.garmentType.slug, colors: g.colors.map((c) => ({ name: c.color.name, hex: c.color.hex })) }
          : { id: gid, name: 'Removed item', typeSlug: 'shirt', colors: [] };
      }),
    }))
  );
}

export async function POST(request: NextRequest) {
  const user = await getUserSession();
  if (!user) return NextResponse.json({ error: 'Sign in to keep a wear history.' }, { status: 401 });

  const parsed = wearLogSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }
  const { garmentIds, wornOn, outfitScore } = parsed.data;
  const date = toDateOnly(wornOn);
  if (date.getTime() > Date.now() + 2 * 86_400_000) {
    return NextResponse.json({ error: "You can't log an outfit for a future date." }, { status: 400 });
  }

  try {
    const known = await prisma.garment.count({ where: { id: { in: garmentIds }, OR: [{ ownerId: null }, { ownerId: user.id }] } });
    if (known !== garmentIds.length) return NextResponse.json({ error: 'Unknown garment.' }, { status: 400 });
    if ((await prisma.wearLog.count({ where: { userId: user.id, wornOn: date } })) >= MAX_ENTRIES_PER_DAY) {
      return NextResponse.json({ error: `Up to ${MAX_ENTRIES_PER_DAY} outfits per day.` }, { status: 400 });
    }

    const entry = await prisma.wearLog.create({ data: { userId: user.id, wornOn: date, garmentIds, outfitScore } });

    // Bounded history: drop the oldest entries past the cap.
    const stale = await prisma.wearLog.findMany({
      where: { userId: user.id },
      orderBy: [{ wornOn: 'desc' }, { createdAt: 'desc' }],
      skip: MAX_ENTRIES_PER_USER,
      select: { id: true },
    });
    if (stale.length) await prisma.wearLog.deleteMany({ where: { id: { in: stale.map((r) => r.id) } } });

    return NextResponse.json({ id: entry.id, wornOn }, { status: 201 });
  } catch (error) {
    const clientError = clientErrorResponse(error);
    if (clientError) return clientError;
    console.error('Error saving wear log:', error);
    return NextResponse.json({ error: 'Failed to save your wear history.' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  const user = await getUserSession();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const id = new URL(request.url).searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 });
  const { count } = await prisma.wearLog.deleteMany({ where: { id, userId: user.id } });
  if (count === 0) return NextResponse.json({ error: 'Entry not found' }, { status: 404 });
  return NextResponse.json({ success: true });
}
