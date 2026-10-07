import { prisma } from '@/lib/prisma';
import { getUserSession } from '@/lib/auth';
import { NextRequest, NextResponse } from 'next/server';
import { wardrobeAddSchema } from '@/lib/validation';

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

// POST add garment to user's digital wardrobe
export async function POST(request: NextRequest) {
  const user = await getUserSession();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const parsed = wardrobeAddSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
    }
    const { garmentId } = parsed.data;

    const item = await prisma.digitalWardrobe.upsert({
      where: {
        userId_garmentId: {
          userId: user.id,
          garmentId,
        },
      },
      update: {
        quantity: { increment: 1 },
      },
      create: {
        userId: user.id,
        garmentId,
        quantity: 1,
      },
      include: {
        garment: true,
      },
    });

    return NextResponse.json(item, { status: 201 });
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

  await prisma.digitalWardrobe.deleteMany({
    where: {
      userId: user.id,
      garmentId,
    },
  });

  return NextResponse.json({ success: true });
}
