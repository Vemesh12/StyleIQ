import { prisma } from '@/lib/prisma';
import { getUserSession } from '@/lib/auth';
import { NextRequest, NextResponse } from 'next/server';
import { savedOutfitCreateSchema } from '@/lib/validation';
import { clientErrorResponse } from '@/lib/api-errors';
import { loadGarments, loadRuleLookups, resolveOccasion, resolvePersonalization, resolveSeason } from '@/lib/rule-engine/catalog';
import { scoreOutfit, type Slot } from '@/lib/rule-engine/core';

const MAX_SAVED_OUTFITS = 200;
const WEAR_ORDER: Record<Slot, number> = { top: 0, layer: 1, bottom: 2, footwear: 3, accessory: 4 };

const outfitInclude = {
  items: {
    include: {
      garment: {
        include: {
          garmentType: true,
          colors: { include: { color: true }, where: { isPrimary: true } },
        },
      },
    },
    orderBy: { layerOrder: 'asc' as const },
  },
};

// GET all saved outfits for the logged-in user
export async function GET() {
  const user = await getUserSession();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const outfits = await prisma.savedOutfit.findMany({
    where: { userId: user.id },
    include: outfitInclude,
    orderBy: { createdAt: 'desc' },
  });

  return NextResponse.json(outfits);
}

// POST create a new saved outfit
export async function POST(request: NextRequest) {
  const user = await getUserSession();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const parsed = savedOutfitCreateSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
    }
    const { name, garmentIds, occasionId, occasionSlug, seasonId, profile } = parsed.data;

    const garments = await loadGarments(garmentIds, user.id);
    if (garments.length !== garmentIds.length) {
      return NextResponse.json(
        { error: 'Some of these garments are no longer in the catalog. Refresh and try again.' },
        { status: 400 }
      );
    }

    const existingCount = await prisma.savedOutfit.count({ where: { userId: user.id } });
    if (existingCount >= MAX_SAVED_OUTFITS) {
      return NextResponse.json(
        { error: `You can save up to ${MAX_SAVED_OUTFITS} outfits. Delete some to save new ones.` },
        { status: 400 }
      );
    }

    // Score server-side with the same engine and context the user was shown,
    // instead of trusting a number sent by the browser.
    const [lookups, occasion, season, personalization] = await Promise.all([
      loadRuleLookups(),
      resolveOccasion({ id: occasionId, slug: occasionSlug }),
      resolveSeason({ id: seasonId }),
      resolvePersonalization(profile),
    ]);
    const { totalScore } = scoreOutfit(garments, { occasion, season, personalization: personalization.context }, lookups);

    const ordered = [...garments].sort((a, b) => WEAR_ORDER[a.slot] - WEAR_ORDER[b.slot]);
    const outfit = await prisma.savedOutfit.create({
      data: {
        userId: user.id,
        name,
        outfitScore: totalScore,
        items: {
          create: ordered.map((g, index) => ({ garmentId: g.id, layerOrder: index + 1 })),
        },
      },
      include: outfitInclude,
    });

    return NextResponse.json(outfit, { status: 201 });
  } catch (error) {
    const clientError = clientErrorResponse(error, { foreignKey: 'One of these garments no longer exists.' });
    if (clientError) return clientError;
    console.error('Error saving outfit:', error);
    return NextResponse.json({ error: 'Failed to save outfit' }, { status: 500 });
  }
}

// DELETE a saved outfit
export async function DELETE(request: NextRequest) {
  const user = await getUserSession();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');

  if (!id) {
    return NextResponse.json({ error: 'Outfit ID is required' }, { status: 400 });
  }

  const { count } = await prisma.savedOutfit.deleteMany({
    where: {
      id,
      userId: user.id,
    },
  });
  if (count === 0) {
    return NextResponse.json({ error: 'Outfit not found' }, { status: 404 });
  }

  return NextResponse.json({ success: true });
}
