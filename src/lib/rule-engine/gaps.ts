// "What should I buy next?" — for each catalog item the user doesn't own,
// count how many NEW good outfits it would create with what they already
// own. Pure: works on ScoringGarment lists, no database access.
import { scoreOutfit, type RuleLookups, type ScoringContext, type ScoringGarment, type Slot } from './core';

export const GOOD_OUTFIT_SCORE = 75;
const CORE_SLOTS: Slot[] = ['top', 'bottom', 'footwear'];

export interface GapSuggestion {
  garment: ScoringGarment;
  newOutfits: number; // good top+bottom+shoe outfits this item would complete
  goodPairs: number; // good pairings with owned pieces (tie-breaker / when nothing completes yet)
  pairsWith: string[]; // names of owned pieces it pairs best with
}

export function findWardrobeGaps(params: {
  owned: ScoringGarment[];
  candidates: ScoringGarment[];
  ctx: ScoringContext;
  lookups: RuleLookups;
  limit?: number;
}): { suggestions: GapSuggestion[]; currentGoodOutfits: number } {
  const { owned, candidates, ctx, lookups, limit = 5 } = params;
  const ownedIds = new Set(owned.map((g) => g.id));
  const bySlot = (slot: Slot) => owned.filter((g) => g.slot === slot);
  const ownedBy: Record<string, ScoringGarment[]> = { top: bySlot('top'), bottom: bySlot('bottom'), footwear: bySlot('footwear') };
  const score = (pieces: ScoringGarment[]) => scoreOutfit(pieces, ctx, lookups).totalScore;

  // Good outfits the user can already make (for context in the UI).
  let currentGoodOutfits = 0;
  for (const t of ownedBy.top) for (const b of ownedBy.bottom) {
    if (score([t, b]) < GOOD_OUTFIT_SCORE - 5) continue;
    for (const s of ownedBy.footwear) if (score([t, b, s]) >= GOOD_OUTFIT_SCORE) currentGoodOutfits++;
  }

  const suggestions: GapSuggestion[] = [];
  for (const c of candidates) {
    if (ownedIds.has(c.id) || !CORE_SLOTS.includes(c.slot)) continue;
    const [slotA, slotB] = CORE_SLOTS.filter((s) => s !== c.slot);
    const partnersA = ownedBy[slotA];
    const partnersB = ownedBy[slotB];

    // Good pairings with owned pieces in the neighbouring slots.
    const goodA = partnersA.filter((a) => score([c, a]) >= GOOD_OUTFIT_SCORE);
    const goodB = partnersB.filter((b) => score([c, b]) >= GOOD_OUTFIT_SCORE);
    const goodPairs = goodA.length + goodB.length;
    if (goodPairs === 0) continue;

    // Complete outfits: candidate + one owned piece from each other slot.
    let newOutfits = 0;
    for (const a of goodA) for (const b of partnersB) {
      if (score([c, a, b]) >= GOOD_OUTFIT_SCORE) newOutfits++;
    }

    suggestions.push({
      garment: c,
      newOutfits,
      goodPairs,
      pairsWith: [...goodA, ...goodB].slice(0, 3).map((g) => g.name),
    });
  }

  suggestions.sort((x, y) => y.newOutfits - x.newOutfits || y.goodPairs - x.goodPairs || x.garment.name.localeCompare(y.garment.name));
  // Don't recommend five near-identical items: at most two per garment type.
  const perType: Record<string, number> = {};
  const picked = suggestions.filter((s) => {
    const n = perType[s.garment.typeSlug] ?? 0;
    if (n >= 2) return false;
    perType[s.garment.typeSlug] = n + 1;
    return true;
  });
  return { suggestions: picked.slice(0, limit), currentGoodOutfits };
}
