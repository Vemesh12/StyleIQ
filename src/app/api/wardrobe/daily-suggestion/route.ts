import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getWeatherForCoords } from '@/lib/weather';
import { findBestOutfits } from '@/lib/rule-engine/outfit-finder';
import { dailySuggestionSchema as bodySchema } from '@/lib/validation';

// "What do I wear today" — picks the best-coordinated outfit from garments
// the user actually owns (their Digital Wardrobe), weighted toward whatever
// today's weather calls for. Works for both logged-in users (real wardrobe
// ids) and guests (garmentIds sourced from localStorage on the client).
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = bodySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
    }
    const { garmentIds, lat, lon } = parsed.data;

    const weather = lat !== undefined && lon !== undefined ? await getWeatherForCoords(lat, lon) : null;

    let seasonId: string | undefined;
    if (weather) {
      const targetSlug = weather.seasonProfile === 'light' ? 'summer' : weather.seasonProfile === 'heavy' ? 'winter' : undefined;
      if (targetSlug) {
        const season = await prisma.season.findUnique({ where: { slug: targetSlug } });
        seasonId = season?.id;
      }
    }

    const picks = await findBestOutfits({ garmentIds, seasonId, topN: 1 });

    if (picks.length === 0) {
      return NextResponse.json({
        weather,
        outfit: null,
        message: 'Add a shirt (or t-shirt/polo), trousers, and shoes to your closet to get a daily suggestion.',
      });
    }

    const [pick] = picks;
    return NextResponse.json({
      weather,
      outfit: {
        score: pick.score,
        shirt: { id: pick.shirt.id, name: pick.shirt.name, slug: pick.shirt.slug, colors: pick.shirt.colors },
        trouser: { id: pick.trouser.id, name: pick.trouser.name, slug: pick.trouser.slug, colors: pick.trouser.colors },
        shoe: { id: pick.shoe.id, name: pick.shoe.name, slug: pick.shoe.slug, colors: pick.shoe.colors },
      },
      message: null,
    });
  } catch (error) {
    console.error('Error computing daily suggestion:', error);
    return NextResponse.json({ error: 'Failed to compute a daily outfit suggestion.' }, { status: 500 });
  }
}
