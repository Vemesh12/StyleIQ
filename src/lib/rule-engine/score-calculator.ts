import { loadGarments, loadRuleLookups, resolveOccasion, resolvePersonalization, resolveSeason } from './catalog';
import { scoreOutfit, type OutfitScore } from './core';
import type { StyleProfile } from './personalization';

export interface OutfitScoreInput {
  shirtId: string;
  trouserId: string;
  shoeId?: string;
  layerId?: string;
  beltId?: string;
  accessoryIds?: string[];
  occasionId?: string;
  seasonId?: string;
  profile?: StyleProfile;
}

export type OutfitScoreResult = OutfitScore & {
  personalization: { matchedOn: string[]; ignored: string[] };
};

/** Outfit builder scoring — a thin wrapper that loads data and calls core. */
export async function calculateOutfitScore(input: OutfitScoreInput): Promise<OutfitScoreResult> {
  const ids = [input.shirtId, input.layerId, input.trouserId, input.shoeId, input.beltId, ...(input.accessoryIds ?? [])].filter(
    (id): id is string => !!id
  );

  const [garments, lookups, occasion, season, personalization] = await Promise.all([
    loadGarments([...new Set(ids)]),
    loadRuleLookups(),
    resolveOccasion({ id: input.occasionId }),
    resolveSeason({ id: input.seasonId }),
    resolvePersonalization(input.profile),
  ]);

  const result = scoreOutfit(
    garments,
    { occasion, season, personalization: personalization.context },
    lookups,
    { suggestMissingPieces: true }
  );

  return { ...result, personalization: { matchedOn: personalization.matchedOn, ignored: personalization.ignored } };
}
