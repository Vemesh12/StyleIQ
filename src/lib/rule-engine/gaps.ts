// "What should I buy next?" — for each catalog item the user doesn't own,
// count how many NEW good outfits it would create with what they already
// own. Pure: works on ScoringGarment lists, no database access.
import { garmentColorPair, scoreOutfit, type RuleLookups, type ScoringContext, type ScoringGarment, type Slot } from './core';

export const GOOD_OUTFIT_SCORE = 75;
const CORE_SLOTS: Slot[] = ['top', 'bottom', 'footwear'];
// Cost bounds for large closets (a 500-piece closet used to mean millions of
// full scorings). Owned pieces are first ranked against each piece with a
// cheap color + formality estimate; only the closest PAIR_CAP per slot get a
// full pair score, and only the closest PARTNER_CAP per slot are tried as
// complete outfits — at most PARTNER_CAP² scorings per piece, however big the
// closet. Good outfits come from the closest partners, so this only misses
// outfits in closets with more than PARTNER_CAP pieces in a slot.
export const PARTNER_CAP = 10;
export const PAIR_CAP = 40;

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
  // Cheap stand-in for the pair score, used only to order partners.
  const closeness = (a: ScoringGarment, b: ScoringGarment) =>
    (garmentColorPair(a, b, lookups)?.score ?? 7) - 1.5 * Math.abs(a.formality - b.formality);
  /** The `n` partners closest to `g`, best first. */
  const nearest = (g: ScoringGarment, partners: ScoringGarment[], n: number) =>
    partners.length <= n
      ? partners
      : partners
          .map((p) => ({ p, c: closeness(g, p) }))
          .sort((x, y) => y.c - x.c)
          .slice(0, n)
          .map((x) => x.p);
  // A trio can be good even when one of its pairs alone isn't (great shoes
  // lift a so-so top+trousers pair), so outfits are counted over the best
  // partners by pair score — not only over pairs that already pass.
  const countGood = (c: ScoringGarment, partnersA: ScoringGarment[], partnersB: ScoringGarment[]) => {
    let n = 0;
    for (const a of partnersA) for (const b of partnersB) if (score([c, a, b]) >= GOOD_OUTFIT_SCORE) n++;
    return n;
  };

  // Good outfits the user can already make (for context in the UI).
  let currentGoodOutfits = 0;
  const shoesFor = new Map(ownedBy.bottom.map((b) => [b.id, nearest(b, ownedBy.footwear, PARTNER_CAP)]));
  for (const t of ownedBy.top) {
    for (const b of nearest(t, ownedBy.bottom, PARTNER_CAP)) currentGoodOutfits += countGood(t, [b], shoesFor.get(b.id)!);
  }

  const suggestions: GapSuggestion[] = [];
  for (const c of candidates) {
    if (ownedIds.has(c.id) || !CORE_SLOTS.includes(c.slot)) continue;
    const [slotA, slotB] = CORE_SLOTS.filter((s) => s !== c.slot);
    const nearA = nearest(c, ownedBy[slotA], PAIR_CAP);
    const nearB = nearest(c, ownedBy[slotB], PAIR_CAP);

    // Good pairings with owned pieces in the neighbouring slots.
    const goodA = nearA.filter((a) => score([c, a]) >= GOOD_OUTFIT_SCORE);
    const goodB = nearB.filter((b) => score([c, b]) >= GOOD_OUTFIT_SCORE);
    const goodPairs = goodA.length + goodB.length;

    // Complete outfits: candidate + one owned piece from each other slot.
    const newOutfits = countGood(c, nearA.slice(0, PARTNER_CAP), nearB.slice(0, PARTNER_CAP));
    if (goodPairs === 0 && newOutfits === 0) continue;

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
