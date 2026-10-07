import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { pickerRecommendSchema } from '@/lib/validation';
import {
  scoreCandidateAgainstAnchor,
  estimateFormalityFromItemType,
  isPatternedItemType,
  ratingFromScore,
  buildColorRuleLookup,
  type CandidateGarment,
  type ColorLike,
  type CandidateScore,
} from '@/lib/rule-engine/picker-scoring';
import { getPersonalizationRuleForSkinTone } from '@/lib/rule-engine/personalization';
import { SLOT_TYPES, EXCLUSIVE_SLOTS, slotForType } from '@/lib/rule-engine/slots';

interface ScoredCandidate {
  id: string;
  name: string;
  slug: string;
  typeSlug: string;
  formalityLevel: number;
  description: string;
  colors: { name: string; hex: string; slug: string }[];
  score: number;
  rating: CandidateScore['rating'];
  warnings: string[];
  colorHarmonyDetail: CandidateScore['colorHarmonyDetail'];
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = pickerRecommendSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || 'category, itemType, and at least one color are required.' },
        { status: 400 }
      );
    }
    const { category, itemType, colorSlugs, skinTone, underTone, occasionSlug, seasonSlug } = parsed.data;
    if (colorSlugs.length === 0) {
      return NextResponse.json({ error: 'At least one color is required.' }, { status: 400 });
    }

    const inputCategory = category.toLowerCase();

    const [pickedColors, occasion, season, personalizationRule] = await Promise.all([
      prisma.color.findMany({ where: { slug: { in: colorSlugs } } }),
      occasionSlug ? prisma.occasion.findFirst({ where: { slug: occasionSlug } }) : Promise.resolve(null),
      seasonSlug ? prisma.season.findFirst({ where: { slug: seasonSlug } }) : Promise.resolve(null),
      skinTone ? getPersonalizationRuleForSkinTone(skinTone, underTone) : Promise.resolve(null),
    ]);

    if (pickedColors.length === 0) {
      return NextResponse.json({ error: 'Selected colors were not found.' }, { status: 400 });
    }

    const anchorColors: ColorLike[] = pickedColors.map((c) => ({
      name: c.name,
      hex: c.hex,
      slug: c.slug,
      isNeutral: c.isNeutral,
    }));
    const anchorFormality = estimateFormalityFromItemType(itemType, inputCategory);
    const anchorIsPatterned = isPatternedItemType(itemType);
    const anchorSlot = slotForType(inputCategory);

    const allGarments = await prisma.garment.findMany({
      include: {
        garmentType: true,
        colors: { include: { color: true } },
        patterns: { include: { pattern: true } },
        occasions: true,
        seasons: true,
      },
    });

    // Never recommend more of the exact same item type. For "one at a time"
    // slots (top/bottom/footwear/layer), also exclude the anchor's whole slot
    // — a t-shirt isn't a "match" for a shirt anchor, it's an alternative to it.
    const candidates = allGarments.filter((g) => {
      if (g.garmentType.slug === inputCategory) return false;
      if (EXCLUSIVE_SLOTS.has(anchorSlot) && slotForType(g.garmentType.slug) === anchorSlot) return false;
      return true;
    });

    // Batch-fetch every color-compatibility rule this request could possibly
    // need in one query, instead of one query per candidate scored.
    const allColorSlugs = Array.from(
      new Set([...anchorColors.map((c) => c.slug), ...candidates.flatMap((g) => g.colors.map((gc) => gc.color.slug))])
    ).filter(Boolean) as string[];
    const colorRules = allColorSlugs.length
      ? await prisma.colorCompatibilityRule.findMany({
          where: {
            colorA: { slug: { in: allColorSlugs } },
            colorB: { slug: { in: allColorSlugs } },
          },
          include: { colorA: true, colorB: true },
        })
      : [];
    const colorRuleLookup = buildColorRuleLookup(colorRules);

    const scoreCtx = {
      anchorColors,
      anchorFormality,
      anchorIsPatterned,
      occasionId: occasion?.id,
      occasionFormalityLevel: occasion?.formalityLevel,
      seasonId: season?.id,
      skinTone,
      personalizationRule,
      colorRuleLookup,
    };

    const scored = await Promise.all(
      candidates.map(async (g: CandidateGarment) => {
        const score = await scoreCandidateAgainstAnchor(g, scoreCtx);
        const formatted: ScoredCandidate = {
          id: g.id,
          name: g.name,
          slug: g.slug,
          typeSlug: g.garmentType.slug,
          formalityLevel: g.formalityLevel,
          description: g.description,
          colors: g.colors.map((gc) => ({ name: gc.color.name, hex: gc.color.hex, slug: gc.color.slug })),
          score: score.total,
          rating: score.rating,
          warnings: score.warnings,
          colorHarmonyDetail: score.colorHarmonyDetail,
        };
        return formatted;
      })
    );

    const byType: Record<string, ScoredCandidate[]> = {};
    for (const c of scored) {
      if (!byType[c.typeSlug]) byType[c.typeSlug] = [];
      byType[c.typeSlug].push(c);
    }
    for (const typeSlug of Object.keys(byType)) {
      byType[typeSlug].sort((a, b) => b.score - a.score);
    }

    // Assemble up to 3 complete, coordinated outfit sets around the anchor —
    // rotating through alternates per slot so the user gets real variety, not
    // the same top pick repeated.
    const slotCandidates: Record<string, ScoredCandidate[]> = { top: [], bottom: [], footwear: [], layer: [], accessory: [] };
    for (const [slot, types] of Object.entries(SLOT_TYPES)) {
      if (EXCLUSIVE_SLOTS.has(anchorSlot) && slot === anchorSlot) continue;
      const usableTypes = slot === 'accessory' ? types.filter((t) => t !== inputCategory) : types;
      slotCandidates[slot] = usableTypes.flatMap((t) => byType[t] || []).sort((a, b) => b.score - a.score);
    }

    const NUM_SETS = 3;
    const picksPerSet: { slot: string; candidate: ScoredCandidate }[][] = [];
    for (let i = 0; i < NUM_SETS; i++) {
      const picks: { slot: string; candidate: ScoredCandidate }[] = [];
      for (const slot of ['top', 'bottom', 'footwear', 'layer', 'accessory']) {
        if (EXCLUSIVE_SLOTS.has(anchorSlot) && slot === anchorSlot) continue;
        const list = slotCandidates[slot];
        if (list.length === 0) continue;
        picks.push({ slot, candidate: list[i % list.length] });
      }
      if (picks.length > 0) picksPerSet.push(picks);
    }

    // Batch-fetch curated compatibility ratings for every pair of picks across
    // all 3 sets in one query, instead of one query per pair.
    const allPickIds = Array.from(new Set(picksPerSet.flat().map((p) => p.candidate.id)));
    const compatRules = allPickIds.length
      ? await prisma.compatibilityRule.findMany({
          where: {
            garmentAId: { in: allPickIds },
            garmentBId: { in: allPickIds },
          },
        })
      : [];
    const compatLookup = new Map<string, number>();
    for (const r of compatRules) {
      compatLookup.set(`${r.garmentAId}|${r.garmentBId}`, r.rating);
      compatLookup.set(`${r.garmentBId}|${r.garmentAId}`, r.rating);
    }

    const outfitSets = picksPerSet.map((picks, i) => {
      const baseAvg = picks.reduce((sum, p) => sum + p.candidate.score, 0) / picks.length;
      const pairRatings: number[] = [];
      for (let a = 0; a < picks.length; a++) {
        for (let b = a + 1; b < picks.length; b++) {
          const rating = compatLookup.get(`${picks[a].candidate.id}|${picks[b].candidate.id}`);
          if (rating !== undefined) pairRatings.push(rating);
        }
      }
      const confidenceScore =
        pairRatings.length > 0
          ? Math.round(0.65 * baseAvg + 0.35 * ((pairRatings.reduce((s, r) => s + r, 0) / pairRatings.length / 5) * 100))
          : Math.round(baseAvg);

      const allWarnings = Array.from(new Set(picks.flatMap((p) => p.candidate.warnings)));
      const clampedConfidence = Math.min(100, Math.max(0, confidenceScore));

      return {
        id: `set-${i + 1}`,
        title: i === 0 ? 'Best Overall Match' : i === 1 ? 'Smart Alternative' : 'Third Option',
        confidenceScore: clampedConfidence,
        rating: ratingFromScore(clampedConfidence),
        items: picks.map((p) => ({
          slot: p.slot,
          typeSlug: p.candidate.typeSlug,
          name: p.candidate.name,
          colors: p.candidate.colors,
          itemScore: p.candidate.score,
        })),
        warnings: allWarnings,
      };
    });

    const topOverall = scored.slice().sort((a, b) => b.score - a.score)[0] || null;
    const psychologyAdvice = topOverall
      ? anchorIsPatterned
        ? `Since your ${itemType} has a pattern, pair it with solid pieces — like the ${topOverall.name.toLowerCase()} — to keep the look balanced.`
        : `Your selection pairs best with the ${topOverall.name.toLowerCase()} (${topOverall.rating} match). ${
            topOverall.colorHarmonyDetail?.reason || ''
          }`
      : 'Add a few more garments to the catalog to get outfit recommendations for this combination.';

    return NextResponse.json({
      inputSummary: {
        category: inputCategory,
        itemType,
        colors: pickedColors.map((c) => ({ name: c.name, hex: c.hex, slug: c.slug })),
        occasion: occasion?.name || null,
        season: season?.name || null,
      },
      recommendation: {
        outfitSets,
        candidatesByType: byType,
        psychologyAdvice,
        colorWheelHarmony: topOverall?.colorHarmonyDetail || null,
      },
    });
  } catch (error) {
    console.error('Error in picker-recommend API:', error);
    return NextResponse.json(
      { error: 'Failed to generate item-based recommendation.' },
      { status: 500 }
    );
  }
}
