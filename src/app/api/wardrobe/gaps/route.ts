import { NextRequest, NextResponse } from 'next/server';
import { gapsSchema } from '@/lib/validation';
import { enforceRateLimits, getClientIp } from '@/lib/rate-limit';
import { getUserSession } from '@/lib/auth';
import { cached } from '@/lib/ttl-cache';
import { loadCatalog, loadGarments, loadRuleLookups, resolveOccasion, resolvePersonalization, ENGINE_CACHE_PREFIX } from '@/lib/rule-engine/catalog';
import { findWardrobeGaps } from '@/lib/rule-engine/gaps';

// "What should I buy next?" — catalog items that would unlock the most new
// good outfits with what's already in the closet.
export async function POST(request: NextRequest) {
  try {
    const limited = await enforceRateLimits([
      { key: `wardrobe-gaps:${getClientIp(request)}`, limit: 6, windowMs: 60 * 1000 },
    ]);
    if (limited) return limited;

    const parsed = gapsSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
    }
    const { garmentIds, occasionSlug, profile } = parsed.data;
    const session = await getUserSession();

    // Same closet + context => same answer; cache it for a few minutes.
    const key = `${ENGINE_CACHE_PREFIX}gaps:${session?.id ?? 'guest'}:${[...garmentIds].sort().join(',')}:${occasionSlug ?? ''}:${JSON.stringify(profile ?? {})}`;
    const result = await cached(key, 5 * 60 * 1000, async () => {
      const [owned, catalog, lookups, occasion, personalization] = await Promise.all([
        loadGarments(garmentIds, session?.id),
        loadCatalog(),
        loadRuleLookups(),
        resolveOccasion({ slug: occasionSlug }),
        resolvePersonalization(profile),
      ]);
      return findWardrobeGaps({ owned, candidates: catalog, ctx: { occasion, personalization: personalization.context }, lookups });
    });

    return NextResponse.json({
      currentGoodOutfits: result.currentGoodOutfits,
      suggestions: result.suggestions.map((s) => ({
        id: s.garment.id,
        name: s.garment.name,
        slug: s.garment.slug,
        typeSlug: s.garment.typeSlug,
        colors: s.garment.colors.map((c) => ({ name: c.name, hex: c.hex })),
        newOutfits: s.newOutfits,
        goodPairs: s.goodPairs,
        pairsWith: s.pairsWith,
      })),
    });
  } catch (error) {
    console.error('Error computing wardrobe gaps:', error);
    return NextResponse.json({ error: 'Failed to analyse your closet.' }, { status: 500 });
  }
}
