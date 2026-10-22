import { describe, expect, it } from 'vitest';
import { fabricClash, scoreOutfit } from '../core';
import { findWardrobeGaps } from '../gaps';
import { findBestOutfits } from '../outfit-finder';
import { emptySignals, outfitKey, rankAdjustFor } from '../signals';
import { C, garment, noRules, occasions, sampleCatalog } from './fixtures';

const byId = (id: string) => sampleCatalog().find((g) => g.id === id)!;

describe('fabric rules', () => {
  it('flags summer-weight with winter-weight fabrics', () => {
    const linen = garment('trouser', [C.beige], { name: 'Linen Trousers', materials: ['linen'] });
    const cord = garment('jacket', [C.darkBrown], { name: 'Corduroy Jacket', materials: ['corduroy'] });
    expect(fabricClash(linen, cord, 8)?.kind).toBe('weight');
    const r = scoreOutfit([byId('white-dress-shirt'), linen, cord], {}, noRules);
    expect(r.suggestions.some((s) => s.includes('two different seasons'))).toBe(true);
  });

  it('flags dressy velvet with rugged denim', () => {
    const velvet = garment('jacket', [C.navy], { name: 'Velvet Blazer', materials: ['velvet'] });
    expect(fabricClash(velvet, byId('jeans'), 8)?.kind).toBe('sheen');
  });

  it('flags same-shade double denim but not contrasting washes', () => {
    const denimJacket = garment('jacket', [C.navy], { name: 'Denim Jacket', materials: ['denim'] });
    expect(fabricClash(denimJacket, byId('jeans'), 9.6)?.kind).toBe('double-denim');
    expect(fabricClash(denimJacket, byId('jeans'), 7.5)).toBeNull();
  });

  it('ignores shoes and accessories', () => {
    expect(fabricClash(byId('black-oxfords'), garment('trouser', [C.beige], { materials: ['linen'] }), 8)).toBeNull();
  });
});

describe('dimension explanations', () => {
  it('explains every applied dimension', () => {
    const r = scoreOutfit(['white-dress-shirt', 'charcoal-trousers', 'black-oxfords'].map(byId), { occasion: occasions.businessFormal }, noRules);
    for (const key of ['colorHarmony', 'garmentCompatibility', 'occasionMatch'] as const) {
      expect(r.dimensions[key].applied).toBe(true);
      expect(r.dimensions[key].note).toBeTruthy();
    }
    expect(r.dimensions.occasionMatch.note).toContain('Business Formal');
  });
});

describe('complete my outfit (locked pieces)', () => {
  it('builds every result around the locked pieces', () => {
    const picks = findBestOutfits({ garments: sampleCatalog(), ctx: {}, lookups: noRules, topN: 3, requiredIds: ['jeans', 'white-sneakers'] });
    expect(picks.length).toBeGreaterThan(0);
    for (const p of picks) {
      expect(p.bottom.id).toBe('jeans');
      expect(p.shoe.id).toBe('white-sneakers');
    }
  });

  it('forces a locked layer in, even in heat', () => {
    const picks = findBestOutfits({
      garments: sampleCatalog(),
      ctx: { weather: { tempC: 30, isRainy: false } },
      lookups: noRules,
      topN: 1,
      requiredIds: ['navy-blazer'],
    });
    expect(picks[0].layer?.id).toBe('navy-blazer');
  });
});

describe('ranking from history and feedback', () => {
  const catalog = sampleCatalog();
  const best = () => findBestOutfits({ garments: catalog, ctx: {}, lookups: noRules, topN: 1 })[0];

  it('buries an outfit the person disliked', () => {
    const top = best();
    const ids = [top.top, top.layer, top.bottom, top.shoe, top.belt].filter((g) => !!g).map((g) => g.id);
    const signals = emptySignals();
    signals.feedback.set(outfitKey(ids), -1);
    const [next] = findBestOutfits({ garments: catalog, ctx: {}, lookups: noRules, topN: 1, rankAdjust: rankAdjustFor(signals) });
    expect(outfitKey([next.top, next.layer, next.bottom, next.shoe, next.belt].filter((g) => !!g).map((g) => g.id))).not.toBe(outfitKey(ids));
  });

  it('rotates away from pieces worn yesterday', () => {
    const top = best();
    const signals = emptySignals();
    signals.recentlyWorn.set(top.top.id, 1);
    signals.recentlyWorn.set(top.bottom.id, 1);
    const [next] = findBestOutfits({ garments: catalog, ctx: {}, lookups: noRules, topN: 1, rankAdjust: rankAdjustFor(signals) });
    expect(next.top.id === top.top.id && next.bottom.id === top.bottom.id).toBe(false);
  });

  it('does not change the displayed score, only the order', () => {
    const signals = emptySignals();
    signals.recentlyWorn.set('white-dress-shirt', 0);
    const plain = findBestOutfits({ garments: catalog, ctx: {}, lookups: noRules, topN: 5 });
    const adjusted = findBestOutfits({ garments: catalog, ctx: {}, lookups: noRules, topN: 5, rankAdjust: rankAdjustFor(signals) });
    const scoreOf = (list: typeof plain, topId: string, bottomId: string) => list.find((o) => o.top.id === topId && o.bottom.id === bottomId)?.score.totalScore;
    for (const o of adjusted) {
      const same = scoreOf(plain, o.top.id, o.bottom.id);
      if (same !== undefined) expect(o.score.totalScore).toBe(same);
    }
  });
});

describe('wardrobe gaps', () => {
  it('recommends shoes to a closet with tops and trousers but no shoes', () => {
    const owned = ['white-dress-shirt', 'blue-dress-shirt', 'charcoal-trousers', 'navy-chinos'].map(byId);
    const { suggestions, currentGoodOutfits } = findWardrobeGaps({ owned, candidates: sampleCatalog(), ctx: {}, lookups: noRules });
    expect(currentGoodOutfits).toBe(0);
    expect(suggestions[0].garment.slot).toBe('footwear');
    expect(suggestions[0].newOutfits).toBeGreaterThan(0);
    expect(suggestions.every((s) => !owned.some((o) => o.id === s.garment.id))).toBe(true);
  });
});
