import { prisma } from '@/lib/prisma';
import type { Prisma } from '@prisma/client';
import { NextRequest, NextResponse } from 'next/server';

const MAX_PAGE_SIZE = 200;

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);

  // Special: list occasions or seasons
  if (searchParams.get('listOccasions') === 'true') {
    const occasions = await prisma.occasion.findMany({
      orderBy: { formalityLevel: 'desc' },
    });
    return NextResponse.json(occasions);
  }

  // Option lists for the "add your own item" form.
  if (searchParams.get('listTypes') === 'true') {
    return NextResponse.json(await prisma.garmentType.findMany({ orderBy: { name: 'asc' } }));
  }

  if (searchParams.get('listAttributes') === 'true') {
    const [fits, materials, patterns] = await Promise.all([
      prisma.fit.findMany({ orderBy: { name: 'asc' } }),
      prisma.material.findMany({ orderBy: { name: 'asc' } }),
      prisma.pattern.findMany({ orderBy: { name: 'asc' } }),
    ]);
    return NextResponse.json({ fits, materials, patterns });
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
  const limit = Math.min(MAX_PAGE_SIZE, Math.max(1, parseInt(searchParams.get('limit') || '50') || 50));

  // Catalog only — users' own items are private.
  const where: Prisma.GarmentWhereInput = { ownerId: null };
  if (type) where.garmentType = { slug: type };
  if (color) where.colors = { some: { color: { slug: color } } };
  if (occasion) where.occasions = { some: { occasion: { slug: occasion }, suitability: { gte: 3 } } };
  if (season) where.seasons = { some: { season: { slug: season }, suitability: { gte: 3 } } };

  const [total, garments] = await Promise.all([
    prisma.garment.count({ where }),
    prisma.garment.findMany({
      where,
      include: {
        garmentType: true,
        colors: { include: { color: true }, where: { isPrimary: true } },
      },
      orderBy: [{ name: 'asc' }, { id: 'asc' }],
      skip: (page - 1) * limit,
      take: limit,
    }),
  ]);

  const transformed = garments.map((g) => ({
    id: g.id,
    name: g.name,
    slug: g.slug,
    formalityLevel: g.formalityLevel,
    garmentType: g.garmentType.name,
    garmentTypeSlug: g.garmentType.slug,
    colors: g.colors.map((gc) => ({ name: gc.color.name, hex: gc.color.hex })),
  }));

  // `total` is the full match count across all pages (it used to be the size
  // of this page only, which broke any pagination built on it).
  return NextResponse.json({
    garments: transformed,
    total,
    page,
    limit,
    hasMore: page * limit < total,
  });
}
