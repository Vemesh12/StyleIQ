import { NextRequest, NextResponse } from 'next/server';
import { randomBytes } from 'crypto';
import { prisma } from '@/lib/prisma';
import { getUserSession } from '@/lib/auth';
import { customGarmentSchema, MAX_WARDROBE_ITEMS } from '@/lib/validation';
import { slugify } from '@/lib/utils';
import { occasionSuitability, seasonSuitability } from '@/lib/rule-engine/suitability';

// A user's own items ("my navy chinos") — garments with ownerId set. They are
// scored exactly like catalog items but are private: never listed in the
// catalog, encyclopedia, sitemap or exports.

const MAX_OWN_GARMENTS = 150;

const include = {
  garmentType: true,
  colors: { include: { color: true } },
  fits: { include: { fit: true } },
  materials: { include: { material: true } },
  patterns: { include: { pattern: true } },
} as const;

export async function GET() {
  const user = await getUserSession();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const garments = await prisma.garment.findMany({ where: { ownerId: user.id }, include, orderBy: { createdAt: 'desc' } });
  return NextResponse.json(garments);
}

export async function POST(request: NextRequest) {
  const user = await getUserSession();
  if (!user) return NextResponse.json({ error: 'Sign in to add your own items.' }, { status: 401 });

  const parsed = customGarmentSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }
  const { name, typeSlug, colorSlugs, formalityLevel, patternSlug, materialSlug, fitSlug, seasonProfile } = parsed.data;

  if ((await prisma.garment.count({ where: { ownerId: user.id } })) >= MAX_OWN_GARMENTS) {
    return NextResponse.json({ error: `You can add up to ${MAX_OWN_GARMENTS} of your own items.` }, { status: 400 });
  }
  // The new item also goes into the closet, which has its own cap.
  if ((await prisma.digitalWardrobe.count({ where: { userId: user.id } })) >= MAX_WARDROBE_ITEMS) {
    return NextResponse.json({ error: `Your closet can hold up to ${MAX_WARDROBE_ITEMS} items.` }, { status: 400 });
  }

  const [type, colors, pattern, material, fit, occasions, seasons] = await Promise.all([
    prisma.garmentType.findUnique({ where: { slug: typeSlug } }),
    prisma.color.findMany({ where: { slug: { in: colorSlugs } } }),
    patternSlug ? prisma.pattern.findUnique({ where: { slug: patternSlug } }) : null,
    materialSlug ? prisma.material.findUnique({ where: { slug: materialSlug } }) : null,
    fitSlug ? prisma.fit.findUnique({ where: { slug: fitSlug } }) : null,
    prisma.occasion.findMany(),
    prisma.season.findMany(),
  ]);
  if (!type) return NextResponse.json({ error: 'Unknown garment type.' }, { status: 400 });
  if (colors.length !== new Set(colorSlugs).size) return NextResponse.json({ error: 'Unknown color.' }, { status: 400 });
  const solid = pattern ?? (await prisma.pattern.findUnique({ where: { slug: 'solid' } }));
  const orderedColors = colorSlugs.map((s) => colors.find((c) => c.slug === s)!).filter(Boolean);

  // Private slug: never collides with catalog slugs, can't be guessed.
  const slug = `my-${slugify(name) || 'item'}-${randomBytes(4).toString('hex')}`;

  const garment = await prisma.$transaction(async (tx) => {
    const created = await tx.garment.create({
      data: {
        name,
        slug,
        ownerId: user.id,
        garmentTypeId: type.id,
        formalityLevel,
        description: '',
        colors: { create: orderedColors.map((c, i) => ({ colorId: c.id, isPrimary: i === 0 })) },
        patterns: solid ? { create: [{ patternId: solid.id, isPrimary: true }] } : undefined,
        materials: material ? { create: [{ materialId: material.id, percentage: 100 }] } : undefined,
        fits: fit ? { create: [{ fitId: fit.id, isPrimary: true }] } : undefined,
        occasions: {
          create: occasions.map((o) => ({ occasionId: o.id, suitability: occasionSuitability(formalityLevel, o.formalityLevel) })),
        },
        seasons: { create: seasons.map((s) => ({ seasonId: s.id, suitability: seasonSuitability(seasonProfile, s.slug) })) },
      },
      include,
    });
    // An item you added is, by definition, in your closet.
    await tx.digitalWardrobe.create({ data: { userId: user.id, garmentId: created.id } });
    return created;
  });

  return NextResponse.json(garment, { status: 201 });
}

export async function DELETE(request: NextRequest) {
  const user = await getUserSession();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const id = new URL(request.url).searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 });

  // Only the owner can delete; cascades remove it from the closet and outfits.
  const { count } = await prisma.garment.deleteMany({ where: { id, ownerId: user.id } });
  if (count === 0) return NextResponse.json({ error: 'Item not found' }, { status: 404 });
  return NextResponse.json({ success: true });
}
