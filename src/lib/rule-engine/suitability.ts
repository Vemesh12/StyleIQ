export function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

export type SeasonProfile = 'light' | 'heavy' | 'all';

/**
 * Formality-distance suitability (1-5): a garment is most suitable for
 * occasions close to its own formality level, and progressively less
 * suitable the further apart they are — instead of a flat score for every
 * occasion regardless of fit.
 */
export function occasionSuitability(garmentFormality: number, occasionFormality: number): number {
  return clamp(5 - Math.abs(garmentFormality - occasionFormality), 1, 5);
}

/**
 * Season suitability (1-5) from a simple light/heavy/all-season profile.
 */
export function seasonSuitability(profile: SeasonProfile, seasonSlug: string): number {
  const warmSeasons = new Set(['summer', 'spring', 'monsoon']);
  const coldSeasons = new Set(['winter', 'autumn']);
  if (profile === 'all') return 4;
  if (profile === 'light') return warmSeasons.has(seasonSlug) ? 5 : coldSeasons.has(seasonSlug) ? 2 : 4;
  return coldSeasons.has(seasonSlug) ? 5 : warmSeasons.has(seasonSlug) ? 1 : 3;
}
