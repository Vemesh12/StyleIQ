import type { ScoringGarment } from './core';
import type { OutfitPick } from './outfit-finder';

const item = (g: ScoringGarment) => ({
  id: g.id,
  name: g.name,
  slug: g.slug,
  // User-owned items have no public encyclopedia page — don't link them.
  isOwn: !!g.isOwn,
  typeSlug: g.typeSlug,
  colors: g.colors.map((c) => ({ name: c.name, hex: c.hex })),
});

/** API shape for a finder outfit (quick pick, daily suggestion). */
export function serializeOutfitPick(pick: OutfitPick) {
  return {
    score: pick.score.totalScore,
    rating: pick.score.rating,
    scorable: pick.score.scorable,
    shirt: item(pick.top),
    trouser: item(pick.bottom),
    shoe: item(pick.shoe),
    layer: pick.layer ? item(pick.layer) : null,
    belt: pick.belt ? item(pick.belt) : null,
    // Locked accessories other than the belt (tie, watch...); usually empty.
    accessories: (pick.accessories ?? []).map(item),
    highlights: pick.score.highlights,
    suggestions: pick.score.suggestions.slice(0, 3),
  };
}
