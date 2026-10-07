import { prisma } from '@/lib/prisma';
import { getUserSession } from '@/lib/auth';
import { NextRequest, NextResponse } from 'next/server';
import { savedOutfitCreateSchema } from '@/lib/validation';

// GET all saved outfits for the logged-in user
export async function GET() {
  const user = await getUserSession();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const outfits = await prisma.savedOutfit.findMany({
    where: { userId: user.id },
    include: {
      items: {
        include: {
          garment: {
            include: {
              garmentType: true,
              colors: { include: { color: true }, where: { isPrimary: true } },
            },
          },
        },
        orderBy: { layerOrder: 'asc' },
      },
    },
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
    const body = await request.json();
    const parsed = savedOutfitCreateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
    }

    const { name, outfitScore, garmentIds } = parsed.data;

    // Verify all garments exist
    const garments = await prisma.garment.findMany({
      where: { id: { in: garmentIds } },
    });

    if (garments.length === 0) {
      return NextResponse.json({ error: 'No valid garments found' }, { status: 400 });
    }

    const outfit = await prisma.savedOutfit.create({
      data: {
        userId: user.id,
        name,
        outfitScore,
        items: {
          create: garmentIds.map((garmentId, index) => ({
            garmentId,
            layerOrder: index + 1,
          })),
        },
      },
      include: {
        items: {
          include: {
            garment: {
              include: {
                garmentType: true,
                colors: { include: { color: true }, where: { isPrimary: true } },
              },
            },
          },
        },
      },
    });

    return NextResponse.json(outfit, { status: 201 });
  } catch (error) {
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

  await prisma.savedOutfit.deleteMany({
    where: {
      id,
      userId: user.id,
    },
  });

  return NextResponse.json({ success: true });
}
