import { prisma } from '@/lib/prisma';
import { getUserSession } from '@/lib/auth';
import { NextRequest, NextResponse } from 'next/server';
import { wardrobeAddSchema } from '@/lib/validation';

const MAX_WARDROBE_ITEMS = 500;

// GET user's digital wardrobe items
export async function GET() {
  const user = await getUserSession();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const wardrobe = await prisma.digitalWardrobe.findMany({
    where: { userId: user.id },
    include: {
      garment: {
        include: {
          garmentType: true,
          colors: { include: { color: true }, where: { isPrimary: true } },
        },
      },
    },
    orderBy: { addedAt: 'desc' },
  });

  return NextResponse.json(wardrobe);
}

/**
 * POST add garment(s) to the user's wardrobe. Idempotent: adding something
 * you already own is a no-op (it used to silently bump a hidden quantity,
 * e.g. every time a guest closet was re-synced). Accepts `garmentId` or a
 * `garmentIds` batch, which the login flow uses to move a guest closet over.
 */
export async function POST(request: NextRequest) {
  const user = await getUserSession();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const parsed = wardrobeAddSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
    }
    const requestedIds = parsed.data;

    // Catalog items, or the user's own items — never someone else's.
    const existing = await prisma.garment.findMany({
      where: { id: { in: requestedIds }, OR: [{ ownerId: null }, { ownerId: user.id }] },
      select: { id: true },
    });
    const validIds = existing.map((g) => g.id);
    if (validIds.length === 0) {
      return NextResponse.json({ error: 'Garment not found' }, { status: 404 });
    }

    const owned = await prisma.digitalWardrobe.count({ where: { userId: user.id } });
    if (owned + validIds.length > MAX_WARDROBE_ITEMS) {
      return NextResponse.json({ error: `Your closet can hold up to ${MAX_WARDROBE_ITEMS} items.` }, { status: 400 });
    }

    const { count } = await prisma.digitalWardrobe.createMany({
      data: validIds.map((garmentId) => ({ userId: user.id, garmentId })),
      skipDuplicates: true,
    });

    return NextResponse.json(
      {
        added: count,
        alreadyOwned: validIds.length - count,
        unknownIds: requestedIds.filter((id) => !validIds.includes(id)),
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('Error adding to wardrobe:', error);
    return NextResponse.json({ error: 'Failed to add item' }, { status: 500 });
  }
}

// DELETE remove garment from wardrobe
export async function DELETE(request: NextRequest) {
  const user = await getUserSession();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const garmentId = searchParams.get('garmentId');

  if (!garmentId) {
    return NextResponse.json({ error: 'garmentId is required' }, { status: 400 });
  }

  const { count } = await prisma.digitalWardrobe.deleteMany({
    where: {
      userId: user.id,
      garmentId,
    },
  });
  if (count === 0) {
    return NextResponse.json({ error: 'That item is not in your closet' }, { status: 404 });
  }

  return NextResponse.json({ success: true });
}
