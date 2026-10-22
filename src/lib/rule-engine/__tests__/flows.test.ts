import { describe, expect, it } from 'vitest';
import { findBestOutfits } from '../outfit-finder';
import { buildAnchorGarment, buildOutfitSets, estimateAnchorFormality } from '../picker-scoring';
import { compatibilityTypeForRating, ratingFromScore } from '../rating';
import { C, garment, noRules, occasions, sampleCatalog, seasons } from './fixtures';

describe('estimateAnchorFormality', () => {
  it('uses the item-type table', () => {
    expect(estimateAnchorFormality('suit-jacket', 'jacket')).toBe(5);
    expect(estimateAnchorFormality('sneakers', 'shoe')).toBe(1);
  });

  it('matches free text by whole words only', () => {
    expect(estimateAnchorFormality('untied casual knit', 'sweater')).toBe(3);
    expect(estimateAnchorFormality('dress shirt', 'shirt')).toBe(4);
  });
});

describe('buildOutfitSets (item picker)', () => {
  const anchor = buildAnchorGarment({ category: 'shirt', itemType: 'checks', colors: [C.navy] });

  it('names the virtual anchor item readably', () => {
    expect(anchor.name).toBe('your navy blue check shirt');
  });

  it('builds distinct complete sets with a layer and belt for winter business', () => {
    const sets = buildOutfitSets(anchor, sampleCatalog(), { occasion: occasions.businessFormal, season: seasons.winter }, noRules, 3);
    expect(sets.length).toBeGreaterThanOrEqual(2);
    expect(new Set(sets.map((s) => s.pieces.map((p) => p.id).join())).size).toBe(sets.length);
    for (const set of sets) {
      expect(set.pieces.some((p) => p.slot === 'bottom')).toBe(true);
      expect(set.pieces.some((p) => p.slot === 'footwear')).toBe(true);
      expect(set.pieces.some((p) => p.slot === 'layer')).toBe(true);
    }
  });

  it('never adds a tie to a casual t-shirt look', () => {
    const tee = buildAnchorGarment({ category: 'tshirt', itemType: 'casual-plain', colors: [C.white] });
    const sets = buildOutfitSets(tee, sampleCatalog(), { occasion: occasions.casual, season: seasons.summer }, noRules, 3);
    expect(sets.every((s) => !s.pieces.some((p) => p.typeSlug === 'tie'))).toBe(true);
  });
});

describe('findBestOutfits (quick pick / daily suggestion)', () => {
  it('returns diverse outfits, adding a layer and belt for winter business', () => {
    const picks = findBestOutfits({
      garments: sampleCatalog(),
      ctx: { occasion: occasions.businessFormal, season: seasons.winter },
      lookups: noRules,
      topN: 3,
    });
    expect(picks.length).toBeGreaterThan(0);
    expect(new Set(picks.map((p) => `${p.top.id}|${p.bottom.id}`)).size).toBe(picks.length);
    expect(picks[0].layer).toBeDefined();
    expect(picks[0].belt).toBeDefined();
  });

  it('returns nothing without a top, bottom and shoes', () => {
    const picks = findBestOutfits({ garments: [garment('shirt', [C.white])], ctx: {}, lookups: noRules });
    expect(picks).toEqual([]);
  });

  it('rotates between near-equal outfits by seed', () => {
    const garments = [
      ...['white', 'skyBlue', 'lightGrey', 'beige'].map((c) => garment('shirt', [C[c as keyof typeof C]], { formality: 3 })),
      ...['navy', 'charcoal', 'beige'].map((c) => garment('trouser', [C[c as keyof typeof C]], { formality: 3 })),
      garment('shoe', [C.darkBrown], { formality: 3 }),
    ];
    const leaders = new Set(
      ['2026-01-01', '2026-01-02', '2026-01-03', '2026-01-04', '2026-01-05', '2026-01-06'].map((seed) => {
        const [p] = findBestOutfits({ garments, ctx: {}, lookups: noRules, topN: 1, rotationSeed: seed });
        return `${p.top.id}|${p.bottom.id}`;
      })
    );
    expect(leaders.size).toBeGreaterThan(1);
  });
});

describe('rating scales', () => {
  it('maps totals and star ratings consistently', () => {
    expect([90, 75, 55, 30].map(ratingFromScore)).toEqual(['excellent', 'good', 'risky', 'avoid']);
    expect([5, 3.8, 3, 1].map(compatibilityTypeForRating)).toEqual(['excellent', 'good', 'acceptable', 'avoid']);
  });
});
