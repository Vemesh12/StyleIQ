import { describe, expect, it } from 'vitest';
import { leatherTone, pairCompatibility, patternClash, scoreOutfit } from '../core';
import { C, garment, noRules, occasions, sampleCatalog, seasons } from './fixtures';

const byId = (id: string) => sampleCatalog().find((g) => g.id === id)!;

describe('scoreOutfit', () => {
  it('scores a classic business outfit as excellent', () => {
    const outfit = ['white-dress-shirt', 'charcoal-trousers', 'navy-blazer', 'black-oxfords', 'black-belt'].map(byId);
    const r = scoreOutfit(outfit, { occasion: occasions.businessFormal, season: seasons.winter }, noRules);
    expect(r.rating).toBe('excellent');
    expect(r.totalScore).toBeGreaterThanOrEqual(85);
  });

  it('leaves dimensions without data out of the score instead of faking them', () => {
    const r = scoreOutfit([byId('white-dress-shirt'), byId('charcoal-trousers')], {}, noRules);
    expect(r.dimensions.occasionMatch.applied).toBe(false);
    expect(r.dimensions.skinToneSuitability.applied).toBe(false);
    expect(r.dimensions.colorHarmony.applied).toBe(true);
  });

  it('caps a severe formality clash', () => {
    const blazer = garment('jacket', [C.charcoal], { formality: 5, name: 'Dinner Jacket' });
    const joggers = garment('trouser', [C.charcoal], { formality: 1, name: 'Joggers' });
    const r = scoreOutfit([blazer, joggers, byId('white-sneakers')], {}, noRules);
    expect(r.formalityGate).toBeLessThan(1);
    expect(r.suggestions[0]).toMatch(/dressier/);
  });

  it('flags a clashing color pair', () => {
    const r = scoreOutfit([garment('shirt', [C.red]), garment('trouser', [C.green])], {}, noRules);
    expect(r.suggestions.some((s) => s.startsWith('Color clash'))).toBe(true);
  });

  it('flags three loud color families', () => {
    const r = scoreOutfit(
      [garment('shirt', [C.red]), garment('trouser', [C.mustard]), garment('jacket', [C.purple])],
      {},
      noRules
    );
    expect(r.suggestions.some((s) => s.startsWith('Too many colors'))).toBe(true);
  });

  it('flags a brown belt with black shoes', () => {
    const r = scoreOutfit([byId('white-dress-shirt'), byId('charcoal-trousers'), byId('black-oxfords'), byId('brown-belt')], {}, noRules);
    expect(r.suggestions.some((s) => s.startsWith('Leather mismatch'))).toBe(true);
  });

  it('derives occasion fit from formality when a garment has no curated row', () => {
    const r = scoreOutfit([byId('white-tee'), byId('black-oxfords')], { occasion: occasions.casual }, noRules);
    expect(r.suggestions.some((s) => s.includes('too formal for Casual'))).toBe(true);
  });

  it('applies weather: rain flags suede, cold asks for a layer', () => {
    const suede = garment('shoe', [C.darkBrown], { name: 'Suede Boots', materials: ['suede'] });
    const rainy = scoreOutfit([byId('white-tee'), byId('jeans'), suede], { weather: { tempC: 18, isRainy: true } }, noRules);
    expect(rainy.suggestions.some((s) => s.includes('rainy'))).toBe(true);

    const cold = scoreOutfit([byId('white-tee'), byId('jeans'), byId('white-sneakers')], { weather: { tempC: 5, isRainy: false } }, noRules);
    expect(cold.suggestions.some((s) => s.includes('add a jacket'))).toBe(true);
  });

  it('suggests a belt only when the outfit calls for one', () => {
    const casual = scoreOutfit([byId('white-tee'), byId('jeans'), byId('white-sneakers')], {}, noRules, { suggestMissingPieces: true });
    expect(casual.suggestions.some((s) => /belt/i.test(s))).toBe(false);
    const formal = scoreOutfit([byId('white-dress-shirt'), byId('charcoal-trousers'), byId('black-oxfords')], {}, noRules, { suggestMissingPieces: true });
    expect(formal.suggestions.some((s) => /belt/i.test(s))).toBe(true);
  });

  it('applies skin-tone and body-shape scoring when a profile is given', () => {
    const r = scoreOutfit(
      [garment('shirt', [C.olive], { fits: ['Tailored Fit'] }), byId('navy-chinos')],
      {
        personalization: {
          colorAdvice: { recommendedClothingColors: 'Earth Tones, Olive', avoidClothingColors: 'Cool Blue' },
          bodyProportion: 'Rectangle',
        },
      },
      noRules
    );
    expect(r.dimensions.skinToneSuitability.applied).toBe(true);
    expect(r.dimensions.skinToneSuitability.score).toBeGreaterThan(6);
    expect(r.dimensions.bodyTypeSuitability.applied).toBe(true);
  });
});

describe('pairCompatibility', () => {
  it('computes a varied fallback when no curated rule exists', () => {
    const good = pairCompatibility(byId('charcoal-trousers'), byId('black-oxfords'), noRules, 8);
    const canvasSneakers = garment('shoe', [C.white], { name: 'Canvas Sneakers', formality: 1 });
    const bad = pairCompatibility(byId('charcoal-trousers'), canvasSneakers, noRules, 8);
    expect(good.curated).toBe(false);
    expect(good.rating - bad.rating).toBeGreaterThan(1);
  });

  it('uses a curated rule when present', () => {
    const lookups = { ...noRules, garmentRule: () => ({ rating: 1.5, reason: 'No' }) };
    expect(pairCompatibility(byId('white-tee'), byId('jeans'), lookups, 9).rating).toBe(1.5);
  });
});

describe('patterns and leather', () => {
  it('allows a subtle pattern with a bolder one, flags two bold ones', () => {
    const check = garment('shirt', [C.white], { patterns: ['check'] });
    const herringbone = garment('jacket', [C.charcoal], { patterns: ['herringbone'] });
    const floral = garment('shirt', [C.white], { patterns: ['floral'] });
    const polka = garment('trouser', [C.navy], { patterns: ['polka-dot'] });
    expect(patternClash(check, herringbone)).toBeNull();
    expect(patternClash(floral, polka)).toBe('bold');
  });

  it('only treats leather goods as leather', () => {
    expect(leatherTone(byId('black-belt'))).toBe('black');
    expect(leatherTone(byId('brown-oxfords'))).toBe('brown');
    expect(leatherTone(garment('shoe', [C.white], { name: 'Canvas Sneakers' }))).toBeNull();
  });
});

describe('outfits with nothing to judge', () => {
  it('does not invent color or compatibility scores for a single piece', () => {
    const r = scoreOutfit([byId('white-dress-shirt')], {}, noRules);
    expect(r.scorable).toBe(false);
    expect(r.dimensions.colorHarmony.applied).toBe(false);
    expect(r.dimensions.garmentCompatibility.applied).toBe(false);
    expect(r.totalScore).toBe(0);
  });

  it('scores an empty list as 0, not NaN, even with context', () => {
    const r = scoreOutfit([], { occasion: occasions.businessFormal, season: seasons.winter }, noRules);
    expect(r.scorable).toBe(false);
    expect(r.totalScore).toBe(0);
    expect(Number.isNaN(r.totalScore)).toBe(false);
  });

  it('marks accessories that do not interact as unscorable', () => {
    const r = scoreOutfit([byId('navy-tie'), byId('black-belt')], {}, noRules);
    expect(r.scorable).toBe(false);
    expect(r.highlights).toEqual([]);
  });

  it('judges a watch against the shirt instead of ignoring it', () => {
    const watch = garment('watch', [C.black], { name: 'Black Watch' });
    const r = scoreOutfit([byId('white-dress-shirt'), watch], {}, noRules);
    expect(r.scorable).toBe(true);
    expect(r.dimensions.colorHarmony.applied).toBe(true);
  });

  it('only renormalizes over the context dimensions when pieces cannot be paired', () => {
    const r = scoreOutfit([byId('white-dress-shirt')], { occasion: occasions.businessFormal }, noRules);
    expect(r.scorable).toBe(false);
    expect(r.dimensions.occasionMatch.applied).toBe(true);
    expect(r.totalScore).toBeGreaterThan(0);
  });
});

describe('notes agree with the scores', () => {
  it('does not praise colors that the three-color penalty marked down', () => {
    const r = scoreOutfit(
      [garment('shirt', [C.red]), garment('trouser', [C.green]), garment('shoe', [C.royalBlue])],
      {},
      noRules
    );
    expect(r.highlights).not.toContain('The colors work together cleanly.');
    expect(r.dimensions.colorHarmony.note).toMatch(/color families compete/);
  });
});
