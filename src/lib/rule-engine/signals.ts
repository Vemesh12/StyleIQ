// Turns a person's history into a ranking nudge for suggestions. Pure — the
// database loading lives in src/lib/user-signals.ts.
import type { ScoringGarment } from './core';

/** Canonical key for an outfit: its garment ids, sorted. */
export function outfitKey(garmentIds: string[]): string {
  return [...new Set(garmentIds)].sort().join('|');
}

export interface UserSignals {
  // garmentId -> days since last worn (0 = today), only for the last week
  recentlyWorn: Map<string, number>;
  // outfitKey -> 1 (liked) / -1 (disliked)
  feedback: Map<string, number>;
}

const RECENT_DAYS = 7;

/**
 * Ranking adjustment (in score points) for a candidate outfit:
 *  - pieces worn in the last week are pushed down (more if worn very
 *    recently, more for the main pieces than for shoes/belts), so the daily
 *    suggestion rotates through the closet;
 *  - an outfit the person disliked is buried; one they liked gets a small
 *    boost; and any outfit reusing a disliked top+bottom combination is
 *    pushed down too.
 */
export function rankAdjustFor(signals: UserSignals): (pieces: ScoringGarment[]) => number {
  const dislikedPairs = new Set<string>();
  const likedPairs = new Set<string>();
  for (const [key, rating] of signals.feedback) {
    const ids = key.split('|');
    for (let i = 0; i < ids.length; i++) for (let j = i + 1; j < ids.length; j++) {
      (rating < 0 ? dislikedPairs : likedPairs).add(`${ids[i]}|${ids[j]}`);
    }
  }

  return (pieces) => {
    let adjust = 0;

    let wearPenalty = 0;
    for (const g of pieces) {
      const days = signals.recentlyWorn.get(g.id);
      if (days === undefined || days >= RECENT_DAYS) continue;
      const weight = g.slot === 'top' || g.slot === 'bottom' || g.slot === 'layer' ? 1.2 : 0.5;
      wearPenalty += (RECENT_DAYS - days) * weight;
    }
    adjust -= Math.min(wearPenalty, 20);

    const exact = signals.feedback.get(outfitKey(pieces.map((g) => g.id)));
    if (exact === -1) adjust -= 40;
    else if (exact === 1) adjust += 4;

    const top = pieces.find((g) => g.slot === 'top');
    const bottom = pieces.find((g) => g.slot === 'bottom');
    if (top && bottom && exact === undefined) {
      const pair = [top.id, bottom.id].sort().join('|');
      if (dislikedPairs.has(pair)) adjust -= 10;
      else if (likedPairs.has(pair)) adjust += 2;
    }
    return adjust;
  };
}

export const emptySignals = (): UserSignals => ({ recentlyWorn: new Map(), feedback: new Map() });
