import { getUserSession } from '@/lib/auth';
import { getWeatherForCoords, type WeatherInfo } from '@/lib/weather';
import { loadUserSignals } from '@/lib/user-signals';
import { loadGarments, loadRuleLookups, resolveOccasion, resolvePersonalization, resolveSeason } from '@/lib/rule-engine/catalog';
import type { RuleLookups, ScoringContext, ScoringGarment } from '@/lib/rule-engine/core';
import type { StyleProfile } from '@/lib/rule-engine/personalization';
import { rankAdjustFor } from '@/lib/rule-engine/signals';

// Shared setup for the closet features (daily suggestion, complete my
// outfit): the closet's garments (catalog items plus the signed-in user's own
// items), today's weather and season, personalization, and a ranking nudge
// from the person's wear history and outfit feedback.

export interface ClosetContext {
  userId: string | null;
  garments: ScoringGarment[];
  ctx: ScoringContext;
  lookups: RuleLookups;
  weather: WeatherInfo | null;
  rankAdjust: (pieces: ScoringGarment[]) => number;
  today: string;
}

export async function loadClosetContext(input: {
  garmentIds: string[];
  lat?: number;
  lon?: number;
  localDate?: string;
  occasionSlug?: string;
  profile?: StyleProfile;
  recentlyWorn?: { garmentId: string; wornOn: string }[];
}): Promise<ClosetContext> {
  const session = await getUserSession();
  const userId = session?.id ?? null;
  const today = input.localDate ?? new Date().toISOString().slice(0, 10);
  const weather = input.lat !== undefined && input.lon !== undefined ? await getWeatherForCoords(input.lat, input.lon) : null;

  const [garments, lookups, season, occasion, personalization, signals] = await Promise.all([
    loadGarments(input.garmentIds, userId),
    loadRuleLookups(),
    weather ? resolveSeason({ slug: weather.seasonSlug }) : Promise.resolve(null),
    resolveOccasion({ slug: input.occasionSlug }),
    resolvePersonalization(input.profile),
    // Signed-in users' history comes from the DB; guests send their own.
    loadUserSignals(userId, today, userId ? [] : input.recentlyWorn ?? []),
  ]);

  return {
    userId,
    garments,
    lookups,
    weather,
    today,
    rankAdjust: rankAdjustFor(signals),
    ctx: {
      occasion,
      season,
      weather: weather ? { tempC: weather.tempC, isRainy: weather.isRainy } : null,
      personalization: personalization.context,
    },
  };
}
