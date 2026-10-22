import { prisma } from '@/lib/prisma';
import type { Prisma } from '@prisma/client';
import { getAdminSession } from '@/lib/auth';
import { NextRequest, NextResponse } from 'next/server';
import { adminGarmentCreateSchema, adminGarmentUpdateSchema } from '@/lib/validation';
import { occasionSuitability, seasonSuitability, type SeasonProfile } from '@/lib/rule-engine/suitability';
import { invalidateEngineCache } from '@/lib/rule-engine/catalog';
import { clientErrorResponse } from '@/lib/api-errors';
import { revalidatePublicContent } from '@/lib/revalidate';
import { slugify } from '@/lib/utils';

type Tx = Prisma.TransactionClient;

async function checkAdmin() {
  const session = await getAdminSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  return null;
}

const ERRORS = {
  unique: 'That slug is already used by another garment.',
  foreignKey: 'The selected garment type or one of the colors no longer exists.',
  notFound: 'Garment not found.',
};

/** First free slug of `base`, `base-2`, `base-3`… */
async function uniqueSlug(tx: Tx, base: string): Promise<string> {
  const taken = new Set(
    (await tx.garment.findMany({ where: { slug: { startsWith: base } }, select: { slug: true } })).map((g) => g.slug)
  );
  if (!taken.has(base)) return base;
  for (let n = 2; ; n++) if (!taken.has(`${base}-${n}`)) return `${base}-${n}`;
}

async function replaceSingleAttributes(
  tx: Tx,
  garmentId: string,
  attrs: { fitSlug?: string; materialSlug?: string; patternSlug?: string }
) {
  const { fitSlug, materialSlug, patternSlug } = attrs;
  if (fitSlug) {
    const fit = await tx.fit.findUnique({ where: { slug: fitSlug } });
    if (fit) {
      await tx.garmentFit.deleteMany({ where: { garmentId } });
      await tx.garmentFit.create({ data: { garmentId, fitId: fit.id, isPrimary: true } });
    }
  }
  if (materialSlug) {
    const material = await tx.material.findUnique({ where: { slug: materialSlug } });
    if (material) {
      await tx.garmentMaterial.deleteMany({ where: { garmentId } });
      await tx.garmentMaterial.create({ data: { garmentId, materialId: material.id, percentage: 100 } });
    }
  }
  if (patternSlug) {
    const pattern = await tx.pattern.findUnique({ where: { slug: patternSlug } });
    if (pattern) {
      await tx.garmentPattern.deleteMany({ where: { garmentId } });
      await tx.garmentPattern.create({ data: { garmentId, patternId: pattern.id, isPrimary: true } });
    }
  }
}

// Formality-derived occasion suitability (same formula as the catalog seed).
async function writeOccasionSuitability(tx: Tx, garmentId: string, formalityLevel: number) {
  const occasions = await tx.occasion.findMany();
  await tx.garmentOccasion.deleteMany({ where: { garmentId } });
  await tx.garmentOccasion.createMany({
    data: occasions.map((occ) => ({
      garmentId,
      occasionId: occ.id,
      suitability: occasionSuitability(formalityLevel, occ.formalityLevel),
    })),
  });
}

async function writeSeasonSuitability(tx: Tx, garmentId: string, profile: SeasonProfile) {
  const seasons = await tx.season.findMany();
  await tx.garmentSeason.deleteMany({ where: { garmentId } });
  await tx.garmentSeason.createMany({
    data: seasons.map((season) => ({ garmentId, seasonId: season.id, suitability: seasonSuitability(profile, season.slug) })),
  });
}

export async function GET() {
  const authError = await checkAdmin();
  if (authError) return authError;

  // The admin manages the shared catalog; users' own items aren't listed.
  const garments = await prisma.garment.findMany({
    where: { ownerId: null },
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
    const parsed = adminGarmentCreateSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
    }
    const { name, slug, garmentTypeId, description, formalityLevel, colorIds, fitSlug, materialSlug, patternSlug, seasonProfile } =
      parsed.data;
    const formality = formalityLevel ?? 3;

    const requestedSlug = slugify(slug || '');
    const baseSlug = requestedSlug || slugify(name);
    if (!baseSlug) {
      return NextResponse.json({ error: 'Name must contain at least one letter or digit.' }, { status: 400 });
    }

    // Everything in one transaction: a failure part-way can't leave a
    // half-created garment behind.
    const garment = await prisma.$transaction(async (tx) => {
      // An explicitly typed slug must be free; an auto-generated one gets a suffix.
      const finalSlug = requestedSlug ? requestedSlug : await uniqueSlug(tx, baseSlug);
      const created = await tx.garment.create({
        data: {
          name,
          slug: finalSlug,
          garmentTypeId,
          description: description || '',
          formalityLevel: formality,
          colors: colorIds?.length
            ? { create: [...new Set(colorIds)].map((colorId, i) => ({ colorId, isPrimary: i === 0 })) }
            : undefined,
        },
        include: { garmentType: true, colors: { include: { color: true } } },
      });
      await replaceSingleAttributes(tx, created.id, { fitSlug, materialSlug, patternSlug });
      await writeOccasionSuitability(tx, created.id, formality);
      await writeSeasonSuitability(tx, created.id, seasonProfile ?? 'all');
      return created;
    });

    invalidateEngineCache();
    revalidatePublicContent('garments');
    return NextResponse.json(garment, { status: 201 });
  } catch (error) {
    const clientError = clientErrorResponse(error, ERRORS);
    if (clientError) return clientError;
    console.error('Error creating garment:', error);
    return NextResponse.json({ error: 'Failed to create garment' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  const authError = await checkAdmin();
  if (authError) return authError;

  try {
    const parsed = adminGarmentUpdateSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
    }
    const { id, name, slug, garmentTypeId, description, formalityLevel, colorIds, fitSlug, materialSlug, patternSlug, seasonProfile } =
      parsed.data;

    const finalSlug = slugify(slug);
    if (!finalSlug) {
      return NextResponse.json({ error: 'Slug must contain at least one letter or digit.' }, { status: 400 });
    }

    const garment = await prisma.$transaction(async (tx) => {
      const existing = await tx.garment.findUnique({ where: { id }, select: { formalityLevel: true, ownerId: true } });
      if (!existing || existing.ownerId) return null; // not a catalog garment
      const formality = formalityLevel ?? existing.formalityLevel;

      if (colorIds) {
        await tx.garmentColor.deleteMany({ where: { garmentId: id } });
        if (colorIds.length > 0) {
          await tx.garmentColor.createMany({
            data: [...new Set(colorIds)].map((colorId, i) => ({ garmentId: id, colorId, isPrimary: i === 0 })),
          });
        }
      }

      const updated = await tx.garment.update({
        where: { id },
        data: { name, slug: finalSlug, garmentTypeId, description, formalityLevel: formality },
        include: { garmentType: true, colors: { include: { color: true } } },
      });

      await replaceSingleAttributes(tx, id, { fitSlug, materialSlug, patternSlug });
      // Only recompute derived suitability when its inputs changed, so
      // curated/seeded values survive an unrelated edit (e.g. a name fix).
      if (formality !== existing.formalityLevel) await writeOccasionSuitability(tx, id, formality);
      if (seasonProfile) await writeSeasonSuitability(tx, id, seasonProfile);
      return updated;
    });

    if (!garment) return NextResponse.json({ error: ERRORS.notFound }, { status: 404 });
    invalidateEngineCache();
    revalidatePublicContent('garments');
    return NextResponse.json(garment);
  } catch (error) {
    const clientError = clientErrorResponse(error, ERRORS);
    if (clientError) return clientError;
    console.error('Error updating garment:', error);
    return NextResponse.json({ error: 'Failed to update garment' }, { status: 500 });
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

  const { count } = await prisma.garment.deleteMany({ where: { id, ownerId: null } });
  if (count === 0) return NextResponse.json({ error: ERRORS.notFound }, { status: 404 });
  invalidateEngineCache();
  revalidatePublicContent('garments');
  return NextResponse.json({ success: true });
}
