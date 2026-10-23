import { scoreOutfit, type OutfitScore, type RuleLookups, type ScoringContext, type ScoringGarment } from './core';
import { wantsLayer } from './picker-scoring';

export interface OutfitPick {
  top: ScoringGarment;
  bottom: ScoringGarment;
  shoe: ScoringGarment;
  layer?: ScoringGarment;
  belt?: ScoringGarment;
  // Locked accessories other than the belt (tie, watch, pocket square...),
  // carried into every result so "complete my outfit" never drops them.
  accessories?: ScoringGarment[];
  score: OutfitScore;
}

const BEAM_WIDTH = 60;

function piecesOf(p: Partial<Omit<OutfitPick, 'score'>>): ScoringGarment[] {
  return [p.top, p.layer, p.bottom, p.shoe, p.belt, ...(p.accessories ?? [])].filter((g): g is ScoringGarment => !!g);
}

/** Deterministic 0-1 value from a string (FNV-1a), for seeded rotation. */
function seededRandom(seed: string): number {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0) / 4294967295;
}

/**
 * Searches garments (whole catalog, or just a user's wardrobe) for the best
 * complete outfits using the shared core scorer.
 *
 * - Beam search (top+bottom, then shoes) instead of brute-forcing every
 *   combination, so adding a layer and belt stays cheap.
 * - A layer is added when weather/season/occasion call for one, or when it
 *   clearly improves the look and it isn't hot; a belt when the trousers and
 *   top call for one and it doesn't make the outfit score worse.
 * - Results are diversified (no near-duplicates differing only by shoes),
 *   and `rotationSeed` (e.g. today's date) rotates between near-equal top
 *   outfits so the daily suggestion isn't identical every day.
 * - `requiredIds` locks pieces into every result ("complete my outfit"),
 *   including any accessories (a locked belt is always added; other locked
 *   accessories are returned in `accessories`).
 * - `rankAdjust` nudges the ORDER (recently worn pieces, liked/disliked
 *   combinations) without changing the displayed style score. It is applied
 *   while pruning the beam too, so a re-ranked outfit can't be lost early.
 */
export function findBestOutfits(params: {
  garments: ScoringGarment[];
  ctx: ScoringContext;
  lookups: RuleLookups;
  topN?: number;
  rotationSeed?: string;
  requiredIds?: string[];
  rankAdjust?: (pieces: ScoringGarment[]) => number;
}): OutfitPick[] {
  const { garments, ctx, lookups, topN = 3, rotationSeed, requiredIds = [], rankAdjust } = params;
  const required = garments.filter((g) => requiredIds.includes(g.id));
  const lockedIn = (slotPieces: ScoringGarment[], match: (g: ScoringGarment) => boolean) => {
    const locked = required.filter(match);
    return locked.length ? locked : slotPieces;
  };
  const tops = lockedIn(garments.filter((g) => g.slot === 'top'), (g) => g.slot === 'top');
  const bottoms = lockedIn(garments.filter((g) => g.slot === 'bottom'), (g) => g.slot === 'bottom');
  const shoes = lockedIn(garments.filter((g) => g.slot === 'footwear'), (g) => g.slot === 'footwear');
  const layers = lockedIn(garments.filter((g) => g.slot === 'layer'), (g) => g.slot === 'layer');
  const belts = lockedIn(garments.filter((g) => g.typeSlug === 'belt'), (g) => g.typeSlug === 'belt');
  const forceLayer = required.some((g) => g.slot === 'layer');
  const forceBelt = required.some((g) => g.typeSlug === 'belt');
  // Locked ties, watches etc. are part of every candidate from the start, so
  // the rest of the outfit is chosen to work with them.
  const lockedExtras = required.filter((g) => g.slot === 'accessory' && g.typeSlug !== 'belt');
  const accessories = lockedExtras.length ? { accessories: lockedExtras } : {};
  if (tops.length === 0 || bottoms.length === 0 || shoes.length === 0) return [];
  const adjustOf = (pieces: ScoringGarment[]) => (rankAdjust ? rankAdjust(pieces) : 0);
  const rankOf = (o: OutfitPick) => o.score.totalScore + adjustOf(piecesOf(o));

  const score = (pieces: ScoringGarment[]) => scoreOutfit(pieces, ctx, lookups).totalScore;
  // Beam entries are ordered by style score + rankAdjust; `s` stays the plain
  // style score used for the layer/belt decisions.
  const scored = <T extends Partial<Omit<OutfitPick, 'score'>>>(o: T) => {
    const pieces = piecesOf(o);
    const s = score(pieces);
    return { ...o, s, rank: s + adjustOf(pieces) };
  };

  // 1. Best top + bottom pairs.
  const pairs = tops
    .flatMap((top) => bottoms.map((bottom) => scored({ top, bottom, ...accessories })))
    .sort((a, b) => b.rank - a.rank)
    .slice(0, BEAM_WIDTH);

  // 2. Add shoes.
  const withShoes = pairs
    .flatMap(({ top, bottom }) => shoes.map((shoe) => scored({ top, bottom, shoe, ...accessories })))
    .sort((a, b) => b.rank - a.rank)
    .slice(0, BEAM_WIDTH);

  /** Best addition among `options` that passes `accept` (on the plain score), ranked with rankAdjust. */
  const bestAddition = (
    options: ScoringGarment[],
    build: (g: ScoringGarment) => Omit<OutfitPick, 'score'>,
    accept: (s: number) => boolean
  ) => {
    let best: { g: ScoringGarment; s: number; rank: number } | null = null;
    for (const g of options) {
      const { s, rank } = scored(build(g));
      if (accept(s) && (!best || rank > best.rank)) best = { g, s, rank };
    }
    return best;
  };

  // 3. Layer and belt where they belong.
  const needLayer = wantsLayer(ctx);
  const tooHotForLayer =
    (ctx.weather && ctx.weather.tempC >= 24) || (!ctx.weather && ctx.season && ['summer', 'monsoon'].includes(ctx.season.slug));
  const occasionFormality = ctx.occasion?.formalityLevel ?? 0;

  const complete: OutfitPick[] = withShoes.map((base) => {
    let outfit: Omit<OutfitPick, 'score'> = { top: base.top, bottom: base.bottom, shoe: base.shoe, ...accessories };
    let current = base.s;

    if (layers.length > 0 && (forceLayer || needLayer || !tooHotForLayer)) {
      // Required layers are always added; optional ones only when they clearly help.
      const best = bestAddition(layers, (layer) => ({ ...outfit, layer }), (s) => forceLayer || needLayer || s >= current + 2);
      if (best) {
        outfit = { ...outfit, layer: best.g };
        current = best.s;
      }
    }

    const wantsBelt = outfit.bottom.formality >= 3 && (outfit.top.typeSlug === 'shirt' || occasionFormality >= 3);
    if (belts.length > 0 && (wantsBelt || forceBelt)) {
      // A locked belt is always worn. Otherwise a belt is optional: the score
      // doesn't penalise a missing one, so only add it when it doesn't make
      // the outfit worse (e.g. never a brown belt with black shoes).
      const best = bestAddition(belts, (belt) => ({ ...outfit, belt }), (s) => forceBelt || s >= current);
      if (best) outfit = { ...outfit, belt: best.g };
    }

    return { ...outfit, score: scoreOutfit(piecesOf(outfit), ctx, lookups) };
  });

  complete.sort((a, b) => rankOf(b) - rankOf(a));

  // 4. Rotation: among outfits within 4 points of the best, let the seed pick
  // which one leads today.
  let pool = complete;
  if (rotationSeed && complete.length > 1) {
    const bestScore = rankOf(complete[0]);
    const nearBest = complete.filter((o) => rankOf(o) >= bestScore - 4);
    const leader = nearBest.reduce((m, o) =>
      seededRandom(`${rotationSeed}|${o.top.id}|${o.bottom.id}`) > seededRandom(`${rotationSeed}|${m.top.id}|${m.bottom.id}`) ? o : m
    );
    pool = [leader, ...complete.filter((o) => o !== leader)];
  }

  // 5. Diversity: penalise reusing the same top/bottom/shoes across results.
  const chosen: OutfitPick[] = [pool[0]];
  const remaining = pool.slice(1);
  while (chosen.length < topN && remaining.length > 0) {
    let bestIdx = -1;
    let bestValue = -Infinity;
    remaining.forEach((o, idx) => {
      if (chosen.some((c) => c.top.id === o.top.id && c.bottom.id === o.bottom.id)) return;
      const overlap = chosen.reduce(
        (n, c) => n + (c.top.id === o.top.id ? 6 : 0) + (c.bottom.id === o.bottom.id ? 6 : 0) + (c.shoe.id === o.shoe.id ? 3 : 0),
        0
      );
      const value = rankOf(o) - overlap;
      if (value > bestValue) {
        bestValue = value;
        bestIdx = idx;
      }
    });
    if (bestIdx === -1) break;
    chosen.push(remaining.splice(bestIdx, 1)[0]);
  }

  return chosen;
}
