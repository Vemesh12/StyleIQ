import { NextRequest, NextResponse } from 'next/server';
import { dailySuggestionSchema as bodySchema } from '@/lib/validation';
import { enforceRateLimits, getClientIp } from '@/lib/rate-limit';
import { loadClosetContext } from '@/lib/closet-context';
import { findBestOutfits } from '@/lib/rule-engine/outfit-finder';
import { serializeOutfitPick } from '@/lib/rule-engine/serialize';

// "What do I wear today" — the best-coordinated outfit from garments the user
// owns, using today's weather (temperature, rain, local season), rotating
// day to day, steering away from pieces worn in the last week and from
// outfits they disliked. Works for signed-in users and guests.
export async function POST(request: NextRequest) {
  try {
    const limited = await enforceRateLimits([
      { key: `daily-suggestion:${getClientIp(request)}`, limit: 10, windowMs: 60 * 1000 },
    ]);
    if (limited) return limited;

    const parsed = bodySchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
    }
    const { variant, ...input } = parsed.data;
    const closet = await loadClosetContext(input);

    const picks = findBestOutfits({
      garments: closet.garments,
      ctx: closet.ctx,
      lookups: closet.lookups,
      // "Try Another" walks through distinct alternatives, wrapping around.
      topN: Math.min(variant + 1, 10),
      rotationSeed: closet.today,
      rankAdjust: closet.rankAdjust,
    });

    if (picks.length === 0) {
      return NextResponse.json({
        weather: closet.weather,
        outfit: null,
        message: 'Add a shirt (or t-shirt/polo), trousers, and shoes to your closet to get a daily suggestion.',
      });
    }

    const pick = picks[variant % picks.length];
    return NextResponse.json({ weather: closet.weather, outfit: serializeOutfitPick(pick), message: null });
  } catch (error) {
    console.error('Error computing daily suggestion:', error);
    return NextResponse.json({ error: 'Failed to compute a daily outfit suggestion.' }, { status: 500 });
  }
}
