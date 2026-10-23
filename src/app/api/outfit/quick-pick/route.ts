import { NextRequest, NextResponse } from 'next/server';
import { quickPickSchema as bodySchema } from '@/lib/validation';
import { enforceRateLimits, getClientIp } from '@/lib/rate-limit';
import { cached } from '@/lib/ttl-cache';
import { loadCatalog, loadRuleLookups, resolveOccasion, resolvePersonalization } from '@/lib/rule-engine/catalog';
import { findBestOutfits } from '@/lib/rule-engine/outfit-finder';
import { serializeOutfitPick } from '@/lib/rule-engine/serialize';
import { rankAdjustFor } from '@/lib/rule-engine/signals';
import { getUserSession } from '@/lib/auth';
import { loadUserSignals } from '@/lib/user-signals';

// Quick pick results depend only on the occasion, the catalog and (when
// given) the style profile, so each combination is computed once and reused.
// Catalog edits in the admin panel clear this cache.
const QUICK_PICK_TTL_MS = 5 * 60 * 1000;

// The zero-effort path for someone who "doesn't know what to wear": tap one
// occasion, get one confident outfit — no colors, no wizard, no vocabulary.
export async function POST(request: NextRequest) {
  try {
    const limited = await enforceRateLimits([
      { key: `quick-pick:${getClientIp(request)}`, limit: 20, windowMs: 60 * 1000 },
    ]);
    if (limited) return limited;

    const parsed = bodySchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
    }
    const { occasionSlug, localDate, profile } = parsed.data;

    const occasion = await resolveOccasion({ slug: occasionSlug });
    if (!occasion) {
      return NextResponse.json({ error: 'Unknown occasion.' }, { status: 400 });
    }

    const profileKey = JSON.stringify(profile ?? {});
    const picks = await cached(`quick-pick:${occasion.id}:${profileKey}`, QUICK_PICK_TTL_MS, async () => {
      const [garments, lookups, personalization] = await Promise.all([
        loadCatalog(),
        loadRuleLookups(),
        resolvePersonalization(profile),
      ]);
      // Ten diverse candidates, shared by everyone; each user's view is
      // re-ranked below by their own feedback.
      return findBestOutfits({ garments, ctx: { occasion, personalization: personalization.context }, lookups, topN: 10 });
    });

    const session = await getUserSession();
    const adjust = session
      ? rankAdjustFor(await loadUserSignals(session.id, localDate ?? new Date().toISOString().slice(0, 10)))
      : () => 0;
    const ranked = picks
      .map((pick) => ({ pick, rank: pick.score.totalScore + adjust([pick.top, pick.layer, pick.bottom, pick.shoe, pick.belt].filter((g) => !!g)) }))
      .sort((a, b) => b.rank - a.rank)
      .slice(0, 3)
      .map((r) => r.pick);

    return NextResponse.json({
      occasion: { name: occasion.name, slug: occasion.slug },
      outfits: ranked.map(serializeOutfitPick),
    });
  } catch (error) {
    console.error('Error computing quick pick:', error);
    return NextResponse.json({ error: 'Failed to find a quick outfit pick.' }, { status: 500 });
  }
}
