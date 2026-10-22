import { prisma } from '@/lib/prisma';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  const { searchParams } = new URL(request.url);
  const typeFilter = searchParams.get('type');

  const garment = await prisma.garment.findFirst({ where: { slug, ownerId: null } });
  if (!garment) {
    return NextResponse.json({ error: 'Garment not found' }, { status: 404 });
  }

  // Find compatibility rules where this garment is A or B
  const rules = await prisma.compatibilityRule.findMany({
    where: {
      OR: [{ garmentAId: garment.id }, { garmentBId: garment.id }],
    },
    include: {
      garmentA: {
        include: {
          garmentType: true,
          colors: { include: { color: true }, where: { isPrimary: true } },
        },
      },
      garmentB: {
        include: {
          garmentType: true,
          colors: { include: { color: true }, where: { isPrimary: true } },
        },
      },
    },
    orderBy: { rating: 'desc' },
  });

  const results = rules
    .map((rule) => {
      const other = rule.garmentAId === garment.id ? rule.garmentB : rule.garmentA;
      return {
        id: other.id,
        name: other.name,
        slug: other.slug,
        formalityLevel: other.formalityLevel,
        garmentType: other.garmentType.name,
        colors: other.colors.map((gc) => ({ name: gc.color.name, hex: gc.color.hex })),
        rating: rule.rating,
        reason: rule.reason,
        compatibilityType: rule.compatibilityType,
      };
    })
    .filter((item) => {
      if (typeFilter) return item.garmentType.toLowerCase() === typeFilter.toLowerCase();
      return true;
    });

  return NextResponse.json(results);
}
