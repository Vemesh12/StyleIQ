import { prisma } from '@/lib/prisma';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);

  // Special: list occasions or seasons
  if (searchParams.get('listOccasions') === 'true') {
    const occasions = await prisma.occasion.findMany({
      orderBy: { formalityLevel: 'desc' },
    });
    return NextResponse.json(occasions);
  }

  if (searchParams.get('listSeasons') === 'true') {
    const seasons = await prisma.season.findMany({
      orderBy: { name: 'asc' },
    });
    return NextResponse.json(seasons);
  }

  // Garment filtering
  const type = searchParams.get('type');
  const color = searchParams.get('color');
  const occasion = searchParams.get('occasion');
  const season = searchParams.get('season');
  const page = Math.max(1, parseInt(searchParams.get('page') || '1') || 1);
  const limit = Math.min(500, Math.max(1, parseInt(searchParams.get('limit') || '50') || 50));

  const where: Record<string, unknown> = {};

  if (type) where.garmentType = { slug: type };
  if (color) where.colors = { some: { color: { slug: color } } };
  if (occasion)
    where.occasions = {
      some: { occasion: { slug: occasion }, suitability: { gte: 3 } },
    };
  if (season)
    where.seasons = {
      some: { season: { slug: season }, suitability: { gte: 3 } },
    };

  const garments = await prisma.garment.findMany({
    where,
    include: {
      garmentType: true,
      colors: { include: { color: true }, where: { isPrimary: true } },
    },
    orderBy: { name: 'asc' },
    skip: (page - 1) * limit,
    take: limit,
  });

  // Transform for the outfit builder
  const transformed = garments.map((g) => ({
    id: g.id,
    name: g.name,
    slug: g.slug,
    formalityLevel: g.formalityLevel,
    garmentType: g.garmentType.name,
    garmentTypeSlug: g.garmentType.slug,
    colors: g.colors.map((gc) => ({ name: gc.color.name, hex: gc.color.hex })),
  }));

  return NextResponse.json({ garments: transformed, total: transformed.length });
}
