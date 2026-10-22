import { RATING_THRESHOLDS } from './config';

// Single rating scale shared by every scoring flow on the site (outfit
// builder, item picker, quick pick, daily suggestion). All of them score
// through core.ts, so the same score always means the same thing.
export type OutfitRating = 'excellent' | 'good' | 'risky' | 'avoid';

export function ratingFromScore(total: number): OutfitRating {
  if (total >= RATING_THRESHOLDS.excellent) return 'excellent';
  if (total >= RATING_THRESHOLDS.good) return 'good';
  if (total >= RATING_THRESHOLDS.risky) return 'risky';
  return 'avoid';
}

/**
 * Label for a curated garment-pair rule (1-5 stars). Derived from the rating
 * so the label and the stars can never disagree.
 */
export function compatibilityTypeForRating(rating: number): 'excellent' | 'good' | 'acceptable' | 'avoid' {
  if (rating >= 4.5) return 'excellent';
  if (rating >= 3.5) return 'good';
  if (rating >= 2.5) return 'acceptable';
  return 'avoid';
}
