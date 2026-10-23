import { describe, expect, it } from 'vitest';
import { fabricClash, scoreOutfit } from '../core';
import { findWardrobeGaps } from '../gaps';
import { findBestOutfits } from '../outfit-finder';
import { serializeOutfitPick } from '../serialize';
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

describe('finder accessories', () => {
  it('keeps every locked accessory in every result', () => {
    const watch = garment('watch', [C.black], { id: 'black-watch', name: 'Black Watch' });
    const picks = findBestOutfits({
      garments: [...sampleCatalog(), watch],
      ctx: {},
      lookups: noRules,
      topN: 3,
      requiredIds: ['navy-tie', 'black-watch', 'brown-belt'],
    });
    expect(picks.length).toBeGreaterThan(0);
    for (const p of picks) {
      expect(p.belt?.id).toBe('brown-belt');
      expect(p.accessories?.map((g) => g.id).sort()).toEqual(['black-watch', 'navy-tie']);
      expect(p.score.totalScore).toBe(scoreOutfit([p.top, p.layer, p.bottom, p.shoe, p.belt, ...p.accessories!].filter((g) => !!g), {}, noRules).totalScore);
    }
  });

  it('serializes locked accessories, ownership and scorability', () => {
    const own = garment('shirt', [C.white], { id: 'my-shirt', isOwn: true });
    const [p] = findBestOutfits({ garments: [...sampleCatalog(), own], ctx: {}, lookups: noRules, topN: 1, requiredIds: ['my-shirt', 'navy-tie'] });
    const out = serializeOutfitPick(p);
    expect(out.shirt.isOwn).toBe(true);
    expect(out.trouser.isOwn).toBe(false);
    expect(out.accessories.map((a) => a.id)).toEqual(['navy-tie']);
    expect(out.scorable).toBe(true);
  });

  it('leaves the belt off when every belt clashes with the shoes', () => {
    const garments = [
      byId('white-dress-shirt'),
      byId('charcoal-trousers'),
      byId('black-oxfords'),
      byId('brown-belt'),
    ];
    const [p] = findBestOutfits({ garments, ctx: { occasion: occasions.businessFormal }, lookups: noRules, topN: 1 });
    expect(p.belt).toBeUndefined();
  });

  it('still wears a clashing belt when it is locked', () => {
    const garments = [byId('white-dress-shirt'), byId('charcoal-trousers'), byId('black-oxfords'), byId('brown-belt')];
    const [p] = findBestOutfits({ garments, ctx: {}, lookups: noRules, topN: 1, requiredIds: ['brown-belt'] });
    expect(p.belt?.id).toBe('brown-belt');
  });
});

describe('beam search with re-ranking', () => {
  it('can surface outfits that the plain-score beam would have pruned', () => {
    // 70 trousers => 70 star-shirt pairs, all outscoring the plain tee, so a
    // beam pruned on the plain score holds nothing but the star shirt.
    const star = garment('shirt', [C.white], { id: 'star-shirt', formality: 3 });
    const tee = garment('tshirt', [C.red], { id: 'red-tee', formality: 1 });
    const trousers = Array.from({ length: 70 }, (_, i) => garment('trouser', [i % 2 ? C.navy : C.charcoal], { id: `t${i}`, formality: 3 }));
    const shoe = garment('shoe', [C.darkBrown], { formality: 3 });
    const avoidStar = (pieces: { id: string }[]) => (pieces.some((g) => g.id === 'star-shirt') ? -100 : 0);

    const plain = findBestOutfits({ garments: [star, tee, ...trousers, shoe], ctx: {}, lookups: noRules, topN: 1 });
    expect(plain[0].top.id).toBe('star-shirt');
    const [p] = findBestOutfits({ garments: [star, tee, ...trousers, shoe], ctx: {}, lookups: noRules, topN: 1, rankAdjust: avoidStar });
    expect(p.top.id).toBe('red-tee');
    expect(p.score.totalScore).toBe(scoreOutfit([p.top, p.bottom, p.shoe], {}, noRules).totalScore);
  });
});

describe('wardrobe gaps counting', () => {
  it('counts outfits whose pairs are not all good on their own', () => {
    // The shoes alone are a weak match for the top, but the full outfit works:
    // it used to be skipped because only good shoe+top pairs were tried.
    const owned = [garment('shirt', [C.navy], { id: 'T', formality: 3 }), garment('trouser', [C.white], { id: 'B', formality: 3 })];
    const shoe = garment('shoe', [C.darkBrown], { id: 'S', formality: 5 });
    expect(scoreOutfit([shoe, owned[0]], {}, noRules).totalScore).toBeLessThan(75);
    expect(scoreOutfit([shoe, ...owned], {}, noRules).totalScore).toBeGreaterThanOrEqual(75);
    const { suggestions } = findWardrobeGaps({ owned, candidates: [shoe], ctx: {}, lookups: noRules });
    expect(suggestions[0]?.newOutfits).toBe(1);
  });

  it('stays bounded for a 500-piece closet', () => {
    const palette = [C.white, C.navy, C.charcoal, C.beige, C.skyBlue, C.olive, C.black, C.darkBrown];
    const owned = Array.from({ length: 500 }, (_, i) =>
      garment(['shirt', 'trouser', 'shoe'][i % 3], [palette[i % palette.length]], { id: `own-${i}`, formality: 2 + (i % 3) })
    );
    const started = Date.now();
    const { suggestions } = findWardrobeGaps({ owned, candidates: sampleCatalog(), ctx: {}, lookups: noRules });
    expect(suggestions.length).toBeGreaterThan(0);
    expect(Date.now() - started).toBeLessThan(5_000);
  });
});
