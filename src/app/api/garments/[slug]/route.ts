import { prisma } from '@/lib/prisma';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;

  const garment = await prisma.garment.findFirst({
    where: { slug, ownerId: null },
    include: {
      garmentType: true,
      colors: { include: { color: true } },
      fits: { include: { fit: true } },
      materials: { include: { material: true } },
      patterns: { include: { pattern: true } },
      occasions: { include: { occasion: true } },
      seasons: { include: { season: true } },
    },
  });

  if (!garment) {
    return NextResponse.json({ error: 'Garment not found' }, { status: 404 });
  }

  return NextResponse.json(garment);
}
