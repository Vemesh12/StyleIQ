import { prisma } from '@/lib/prisma';
import { scoreColorSetHarmony, buildColorRuleLookup, type ColorLike } from './picker-scoring';
import { SLOT_TYPES } from './slots';

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

export interface FinderGarment {
  id: string;
  name: string;
  slug: string;
  formalityLevel: number;
  typeSlug: string;
  colors: ColorLike[];
  occasionSuitability: number; // 1-5, neutral 3 when no occasion filter given
  seasonSuitability: number; // 1-5, neutral 3 when no season filter given
}

export interface OutfitPick {
  shirt: FinderGarment;
  trouser: FinderGarment;
  shoe: FinderGarment;
  score: number; // 0-100
}

/**
 * Searches real catalog (or wardrobe-restricted) garments for the
 * best-scoring complete outfit — the same underlying signal the item picker
 * uses (color harmony, curated compatibility ratings, occasion/season fit,
 * formality gating), but run as a combinatorial search instead of anchored
 * on one user-picked item. Powers "Quick Pick" (whole catalog) and the
 * wardrobe's "What do I wear today" (restricted to owned garment ids).
 */
export async function findBestOutfits(params: {
  garmentIds?: string[]; // restrict search to these ids (wardrobe mode); omit to search the whole catalog
  occasionId?: string;
  seasonId?: string;
  topN?: number;
}): Promise<OutfitPick[]> {
  const { garmentIds, occasionId, seasonId, topN = 3 } = params;

  const garments = await prisma.garment.findMany({
    where: garmentIds ? { id: { in: garmentIds } } : {},
    include: {
      garmentType: true,
      colors: { include: { color: true }, where: { isPrimary: true } },
      occasions: occasionId ? { where: { occasionId } } : false,
      seasons: seasonId ? { where: { seasonId } } : false,
    },
  });

  const tops = garments.filter((g) => SLOT_TYPES.top.includes(g.garmentType.slug));
  const bottoms = garments.filter((g) => SLOT_TYPES.bottom.includes(g.garmentType.slug));
  const shoes = garments.filter((g) => SLOT_TYPES.footwear.includes(g.garmentType.slug));

  if (tops.length === 0 || bottoms.length === 0 || shoes.length === 0) return [];

  const allColorSlugs = Array.from(new Set(garments.flatMap((g) => g.colors.map((gc) => gc.color.slug))));
  const colorRules = allColorSlugs.length
    ? await prisma.colorCompatibilityRule.findMany({
        where: { colorA: { slug: { in: allColorSlugs } }, colorB: { slug: { in: allColorSlugs } } },
        include: { colorA: true, colorB: true },
      })
    : [];
  const colorLookup = buildColorRuleLookup(colorRules);

  const allIds = garments.map((g) => g.id);
  const compatRules = await prisma.compatibilityRule.findMany({
    where: { garmentAId: { in: allIds }, garmentBId: { in: allIds } },
  });
  const compatLookup = new Map<string, number>();
  for (const r of compatRules) {
    compatLookup.set(`${r.garmentAId}|${r.garmentBId}`, r.rating);
    compatLookup.set(`${r.garmentBId}|${r.garmentAId}`, r.rating);
  }

  const toFinderGarment = (g: (typeof garments)[number]): FinderGarment => ({
    id: g.id,
    name: g.name,
    slug: g.slug,
    formalityLevel: g.formalityLevel,
    typeSlug: g.garmentType.slug,
    colors: g.colors.map((gc) => ({
      name: gc.color.name,
      hex: gc.color.hex,
      slug: gc.color.slug,
      isNeutral: gc.color.isNeutral,
    })),
    occasionSuitability: occasionId ? g.occasions[0]?.suitability ?? 3 : 3,
    seasonSuitability: seasonId ? g.seasons[0]?.suitability ?? 3 : 3,
  });

  const topsF = tops.map(toFinderGarment);
  const bottomsF = bottoms.map(toFinderGarment);
  const shoesF = shoes.map(toFinderGarment);

  const results: OutfitPick[] = [];

  for (const shirt of topsF) {
    for (const trouser of bottomsF) {
      const shirtTrouserHarmony = await scoreColorSetHarmony(shirt.colors, trouser.colors, colorLookup);
      const shirtTrouserCompat = compatLookup.get(`${shirt.id}|${trouser.id}`);

      for (const shoe of shoesF) {
        const trouserShoeHarmony = await scoreColorSetHarmony(trouser.colors, shoe.colors, colorLookup);
        const shirtShoeHarmony = await scoreColorSetHarmony(shirt.colors, shoe.colors, colorLookup);
        const avgColor = shirtTrouserHarmony.avgScore * 0.45 + trouserShoeHarmony.avgScore * 0.45 + shirtShoeHarmony.avgScore * 0.1; // 0-10

        const compatRatings: number[] = [];
        if (shirtTrouserCompat !== undefined) compatRatings.push(shirtTrouserCompat);
        const trouserShoeCompat = compatLookup.get(`${trouser.id}|${shoe.id}`);
        if (trouserShoeCompat !== undefined) compatRatings.push(trouserShoeCompat);
        const shirtShoeCompat = compatLookup.get(`${shirt.id}|${shoe.id}`);
        if (shirtShoeCompat !== undefined) compatRatings.push(shirtShoeCompat);
        const avgCompat = compatRatings.length ? compatRatings.reduce((a, b) => a + b, 0) / compatRatings.length : 3; // 1-5 neutral default

        const formalityGap = Math.max(
          Math.abs(shirt.formalityLevel - trouser.formalityLevel),
          Math.abs(trouser.formalityLevel - shoe.formalityLevel),
          Math.abs(shirt.formalityLevel - shoe.formalityLevel)
        );
        let gate = 1;
        if (formalityGap >= 3) gate = 0.6;
        else if (formalityGap === 2) gate = 0.85;

        // 3-Color Maximum Rule penalty: Avoid suggesting combinations with 3 distinct vibrant non-neutrals
        const nonNeutralSlugs = new Set(
          [...shirt.colors, ...trouser.colors, ...shoe.colors]
            .filter((c) => !c.isNeutral && c.slug)
            .map((c) => c.slug)
        );
        const threeColorPenalty = nonNeutralSlugs.size >= 3 ? 12 : 0;

        const occasionAvg = (shirt.occasionSuitability + trouser.occasionSuitability + shoe.occasionSuitability) / 3;
        const seasonAvg = (shirt.seasonSuitability + trouser.seasonSuitability + shoe.seasonSuitability) / 3;

        const rawScore = (avgColor / 10) * 40 + (avgCompat / 5) * 25 + (occasionAvg / 5) * 20 + (seasonAvg / 5) * 15 - threeColorPenalty;
        const score = Math.round(clamp(rawScore * gate, 0, 100));

        results.push({ shirt, trouser, shoe, score });
      }
    }
  }

  results.sort((a, b) => b.score - a.score);
  return results.slice(0, topN);
}
