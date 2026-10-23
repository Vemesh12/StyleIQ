import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { pickerRecommendSchema } from '@/lib/validation';
import { enforceRateLimits, getClientIp } from '@/lib/rate-limit';
import { loadCatalog, loadRuleLookups, resolveOccasion, resolvePersonalization, resolveSeason } from '@/lib/rule-engine/catalog';
import { buildAnchorGarment, buildOutfitSets, scoreCandidates } from '@/lib/rule-engine/picker-scoring';
import type { ScoringContext, ScoringGarment } from '@/lib/rule-engine/core';

const colorsOut = (g: ScoringGarment) => g.colors.map((c) => ({ name: c.name, hex: c.hex, slug: c.slug }));

export async function POST(request: NextRequest) {
  try {
    const limited = await enforceRateLimits([
      { key: `picker:${getClientIp(request)}`, limit: 20, windowMs: 60 * 1000 },
    ]);
    if (limited) return limited;

    const parsed = pickerRecommendSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message || 'Invalid request.' }, { status: 400 });
    }
    const { category, itemType, colorSlugs, profile, occasionSlug, seasonSlug } = parsed.data;
    if (colorSlugs.length === 0) {
      return NextResponse.json({ error: 'At least one color is required.' }, { status: 400 });
    }
    const inputCategory = category.toLowerCase();

    const [pickedColors, occasion, season, personalization, catalog, lookups] = await Promise.all([
      prisma.color.findMany({ where: { slug: { in: colorSlugs } } }),
      resolveOccasion({ slug: occasionSlug }),
      resolveSeason({ slug: seasonSlug }),
      resolvePersonalization(profile),
      loadCatalog(),
      loadRuleLookups(),
    ]);
    if (pickedColors.length === 0) {
      return NextResponse.json({ error: 'Selected colors were not found.' }, { status: 400 });
    }

    // Keep the user's color order (first picked = main color).
    const orderedColors = colorSlugs
      .map((slug) => pickedColors.find((c) => c.slug === slug))
      .filter((c): c is (typeof pickedColors)[number] => !!c)
      .map((c) => ({ name: c.name, hex: c.hex, slug: c.slug, family: c.family, isNeutral: c.isNeutral }));

    const anchor = buildAnchorGarment({ category: inputCategory, itemType, colors: orderedColors });
    const ctx: ScoringContext = { occasion, season, personalization: personalization.context };

    const candidates = scoreCandidates(anchor, catalog, ctx, lookups);
    const byType: Record<string, unknown[]> = {};
    for (const { garment, score } of candidates) {
      (byType[garment.typeSlug] ??= []).push({
        id: garment.id,
        name: garment.name,
        slug: garment.slug,
        typeSlug: garment.typeSlug,
        formalityLevel: garment.formality,
        description: garment.description ?? '',
        colors: colorsOut(garment),
        score: score.totalScore,
        rating: score.rating,
        warnings: score.suggestions.slice(0, 3),
        colorHarmonyDetail: score.worstColorPair ? { harmony: score.worstColorPair.harmony, reason: score.worstColorPair.reason } : null,
      });
    }

    const sets = buildOutfitSets(anchor, catalog, ctx, lookups, 3);
    const titles = ['Best Overall Match', 'Smart Alternative', 'Third Option'];
    const outfitSets = sets.map((set, i) => ({
      id: `set-${i + 1}`,
      title: titles[i] ?? `Option ${i + 1}`,
      confidenceScore: set.score.totalScore,
      rating: set.score.rating,
      items: set.pieces
        .filter((g) => g !== anchor)
        .map((g) => ({
          slot: g.slot,
          typeSlug: g.typeSlug,
          name: g.name,
          colors: colorsOut(g),
          itemScore: candidates.find((c) => c.garment.id === g.id)?.score.totalScore ?? set.score.totalScore,
        })),
      warnings: set.score.suggestions.slice(0, 4),
      highlights: set.score.highlights,
    }));

    const best = sets[0];
    const psychologyAdvice = best
      ? `Built around ${anchor.name}: ${best.pieces
          .filter((g) => g !== anchor)
          .map((g) => g.name.toLowerCase())
          .join(', ')}. ${best.score.highlights[0] ?? best.score.worstColorPair?.reason ?? ''}`.trim()
      : 'Add a few more garments to the catalog to get outfit recommendations for this combination.';

    return NextResponse.json({
      inputSummary: {
        category: inputCategory,
        itemType,
        colors: orderedColors.map((c) => ({ name: c.name, hex: c.hex, slug: c.slug })),
        occasion: occasion?.name || null,
        season: season?.name || null,
      },
      personalization: { matchedOn: personalization.matchedOn, ignored: personalization.ignored },
      recommendation: {
        outfitSets,
        candidatesByType: byType,
        psychologyAdvice,
        colorWheelHarmony: best?.score.worstColorPair
          ? { harmony: best.score.worstColorPair.harmony, reason: best.score.worstColorPair.reason }
          : null,
      },
    });
  } catch (error) {
    console.error('Error in picker-recommend API:', error);
    return NextResponse.json({ error: 'Failed to generate item-based recommendation.' }, { status: 500 });
  }
}
