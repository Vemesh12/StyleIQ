import { prisma } from '@/lib/prisma';
import { getAdminSession } from '@/lib/auth';
import { NextRequest, NextResponse } from 'next/server';
import { adminGarmentCreateSchema, adminGarmentUpdateSchema } from '@/lib/validation';
import { occasionSuitability, seasonSuitability } from '@/lib/rule-engine/suitability';

async function checkAdmin() {
  const session = await getAdminSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  return null;
}

// Applies the fit/material/pattern/season-profile fields from the admin form
// onto a garment: single-attribute upserts plus real formality/season-derived
// suitability across every Occasion/Season row (same formula the catalog
// seed uses), instead of leaving these tables empty or flat.
async function applyGarmentAttributes(
  garmentId: string,
  formalityLevel: number,
  attrs: { fitSlug?: string; materialSlug?: string; patternSlug?: string; seasonProfile?: 'light' | 'heavy' | 'all' }
) {
  const { fitSlug, materialSlug, patternSlug, seasonProfile } = attrs;

  if (fitSlug) {
    const fit = await prisma.fit.findUnique({ where: { slug: fitSlug } });
    if (fit) {
      await prisma.garmentFit.deleteMany({ where: { garmentId } });
      await prisma.garmentFit.create({ data: { garmentId, fitId: fit.id, isPrimary: true } });
    }
  }

  if (materialSlug) {
    const material = await prisma.material.findUnique({ where: { slug: materialSlug } });
    if (material) {
      await prisma.garmentMaterial.deleteMany({ where: { garmentId } });
      await prisma.garmentMaterial.create({ data: { garmentId, materialId: material.id, percentage: 100 } });
    }
  }

  if (patternSlug) {
    const pattern = await prisma.pattern.findUnique({ where: { slug: patternSlug } });
    if (pattern) {
      await prisma.garmentPattern.deleteMany({ where: { garmentId } });
      await prisma.garmentPattern.create({ data: { garmentId, patternId: pattern.id, isPrimary: true } });
    }
  }

  const occasions = await prisma.occasion.findMany();
  for (const occ of occasions) {
    await prisma.garmentOccasion.upsert({
      where: { garmentId_occasionId: { garmentId, occasionId: occ.id } },
      update: { suitability: occasionSuitability(formalityLevel, occ.formalityLevel) },
      create: { garmentId, occasionId: occ.id, suitability: occasionSuitability(formalityLevel, occ.formalityLevel) },
    });
  }

  if (seasonProfile) {
    const seasons = await prisma.season.findMany();
    for (const season of seasons) {
      await prisma.garmentSeason.upsert({
        where: { garmentId_seasonId: { garmentId, seasonId: season.id } },
        update: { suitability: seasonSuitability(seasonProfile, season.slug) },
        create: { garmentId, seasonId: season.id, suitability: seasonSuitability(seasonProfile, season.slug) },
      });
    }
  }
}

export async function GET() {
  const authError = await checkAdmin();
  if (authError) return authError;

  const garments = await prisma.garment.findMany({
    include: {
      garmentType: true,
      colors: { include: { color: true } },
      fits: { include: { fit: true } },
      materials: { include: { material: true } },
      patterns: { include: { pattern: true } },
    },
    orderBy: { createdAt: 'desc' },
  });

  return NextResponse.json(garments);
}

export async function POST(request: NextRequest) {
  const authError = await checkAdmin();
  if (authError) return authError;

  try {
    const body = await request.json();
    const parsed = adminGarmentCreateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
    }
    const { name, slug, garmentTypeId, description, formalityLevel, colorIds, fitSlug, materialSlug, patternSlug, seasonProfile } =
      parsed.data;
    const resolvedFormality = formalityLevel || 3;

    const garment = await prisma.garment.create({
      data: {
        name,
        slug: slug || name.toLowerCase().replace(/\s+/g, '-'),
        garmentTypeId,
        description: description || '',
        formalityLevel: resolvedFormality,
        colors: colorIds
          ? {
              create: colorIds.map((colorId: string, i: number) => ({
                colorId,
                isPrimary: i === 0,
              })),
            }
          : undefined,
      },
      include: {
        garmentType: true,
        colors: { include: { color: true } },
      },
    });

    await applyGarmentAttributes(garment.id, resolvedFormality, { fitSlug, materialSlug, patternSlug, seasonProfile });

    return NextResponse.json(garment, { status: 201 });
  } catch (error) {
    console.error('Error creating garment:', error);
    return NextResponse.json(
      { error: 'Failed to create garment' },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  const authError = await checkAdmin();
  if (authError) return authError;

  try {
    const body = await request.json();
    const parsed = adminGarmentUpdateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
    }
    const { id, name, slug, garmentTypeId, description, formalityLevel, colorIds, fitSlug, materialSlug, patternSlug, seasonProfile } =
      parsed.data;
    const resolvedFormality = formalityLevel || 3;

    if (colorIds) {
      await prisma.garmentColor.deleteMany({ where: { garmentId: id } });
      if (colorIds.length > 0) {
        await prisma.garmentColor.createMany({
          data: colorIds.map((colorId, i) => ({ garmentId: id, colorId, isPrimary: i === 0 })),
        });
      }
    }

    const garment = await prisma.garment.update({
      where: { id },
      data: {
        name,
        slug,
        garmentTypeId,
        description,
        formalityLevel: resolvedFormality,
      },
      include: {
        garmentType: true,
        colors: { include: { color: true } },
      },
    });

    await applyGarmentAttributes(garment.id, resolvedFormality, { fitSlug, materialSlug, patternSlug, seasonProfile });

    return NextResponse.json(garment);
  } catch (error) {
    console.error('Error updating garment:', error);
    return NextResponse.json(
      { error: 'Failed to update garment' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  const authError = await checkAdmin();
  if (authError) return authError;

  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');

  if (!id) {
    return NextResponse.json({ error: 'ID is required' }, { status: 400 });
  }

  await prisma.garment.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
