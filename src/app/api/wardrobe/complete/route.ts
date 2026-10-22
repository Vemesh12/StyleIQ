import { NextRequest, NextResponse } from 'next/server';
import { completeOutfitSchema } from '@/lib/validation';
import { enforceRateLimits, getClientIp } from '@/lib/rate-limit';
import { loadClosetContext } from '@/lib/closet-context';
import { findBestOutfits } from '@/lib/rule-engine/outfit-finder';
import { serializeOutfitPick } from '@/lib/rule-engine/serialize';

// "Complete my outfit": lock one or two pieces you want to wear and get the
// best outfits from the rest of your closet built around them.
export async function POST(request: NextRequest) {
  try {
    const limited = await enforceRateLimits([
      { key: `complete-outfit:${getClientIp(request)}`, limit: 15, windowMs: 60 * 1000 },
    ]);
    if (limited) return limited;

    const parsed = completeOutfitSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
    }
    const { lockedIds, ...input } = parsed.data;
    const closet = await loadClosetContext(input);

    const locked = closet.garments.filter((g) => lockedIds.includes(g.id));
    if (locked.length !== lockedIds.length) {
      return NextResponse.json({ error: 'One of the locked items is no longer in your closet.' }, { status: 400 });
    }
    const slots = locked.map((g) => (g.slot === 'accessory' ? g.typeSlug : g.slot));
    if (new Set(slots).size !== slots.length) {
      return NextResponse.json({ error: 'Lock pieces from different categories (e.g. a shirt and trousers).' }, { status: 400 });
    }

    const picks = findBestOutfits({
      garments: closet.garments,
      ctx: closet.ctx,
      lookups: closet.lookups,
      topN: 3,
      requiredIds: lockedIds,
      rankAdjust: closet.rankAdjust,
    });

    const missing = (['top', 'bottom', 'footwear'] as const).filter((slot) => !closet.garments.some((g) => g.slot === slot));
    return NextResponse.json({
      outfits: picks.map(serializeOutfitPick),
      message:
        picks.length > 0
          ? null
          : missing.length
            ? `Add ${missing.map((m) => (m === 'top' ? 'a top' : m === 'bottom' ? 'trousers' : 'shoes')).join(' and ')} to your closet first.`
            : 'No outfit could be built around those pieces.',
    });
  } catch (error) {
    console.error('Error completing outfit:', error);
    return NextResponse.json({ error: 'Failed to complete the outfit.' }, { status: 500 });
  }
}
