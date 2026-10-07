// Single rating scale shared by every scoring engine on the site (outfit
// builder, item picker) so the same score always means the same thing,
// regardless of which flow produced it.
export type OutfitRating = 'excellent' | 'good' | 'risky' | 'avoid';

export function ratingFromScore(total: number): OutfitRating {
  if (total >= 85) return 'excellent';
  if (total >= 70) return 'good';
  if (total >= 50) return 'risky';
  return 'avoid';
}
