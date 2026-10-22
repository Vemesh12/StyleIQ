import { describe, expect, it } from 'vitest';
import { actsAsNeutral, buildColorRuleLookup, colorPairScore, evaluateColorPairHarmony, rybHue } from '../color-rules';
import { C } from './fixtures';

describe('evaluateColorPairHarmony', () => {
  it('scores loud red + green as a clash (painter\'s wheel complements)', () => {
    const r = evaluateColorPairHarmony(C.red, C.green);
    expect(r.isClash).toBe(true);
    expect(r.pairScore).toBeLessThan(6);
  });

  it('scores the "blue and green" awkward zone low', () => {
    expect(evaluateColorPairHarmony(C.royalBlue, C.green).pairScore).toBeLessThanOrEqual(6.6);
  });

  it('treats blue + mustard as a good near-complement', () => {
    const r = evaluateColorPairHarmony({ ...C.royalBlue, hex: '#1E3A8A' }, C.mustard);
    expect(r.isClash).toBe(false);
    expect(r.pairScore).toBeGreaterThanOrEqual(8);
  });

  it('can reach the split-complementary band', () => {
    const r = evaluateColorPairHarmony({ name: 'Blue', hex: '#2050C0' }, { name: 'Gold', hex: '#C09020' });
    expect(r.ruleType).toBe('split-complementary');
  });

  it('keeps navy + charcoal as a tonal pairing, not flat', () => {
    expect(evaluateColorPairHarmony(C.navy, { ...C.charcoal, hex: '#36454F' }).pairScore).toBeGreaterThanOrEqual(8);
  });

  it('flags two near-identical greys', () => {
    const r = evaluateColorPairHarmony(C.lightGrey, C.silverGrey);
    expect(r.harmony).toBe('Near-Miss Neutrals');
    expect(r.pairScore).toBeLessThan(7);
  });

  it('gives an exact match a high tonal score', () => {
    expect(evaluateColorPairHarmony(C.black, C.black).ruleType).toBe('tonal-exact');
  });
});

describe('actsAsNeutral', () => {
  it('treats desaturated colors as neutral even when not flagged', () => {
    expect(actsAsNeutral({ name: 'Dusty Slate', hex: '#6B7078', isNeutral: false })).toBe(true);
    expect(actsAsNeutral(C.red)).toBe(false);
  });
});

describe('rybHue', () => {
  it('maps the screen wheel onto the painter\'s wheel', () => {
    expect(rybHue(0)).toBe(0); // red
    expect(rybHue(60)).toBe(120); // yellow
    expect(rybHue(120)).toBe(180); // green is opposite red
    expect(rybHue(240)).toBe(240); // blue
  });
});

describe('colorPairScore', () => {
  it('prefers a curated rule in either direction and decides clash by score', () => {
    const lookup = buildColorRuleLookup([
      { colorA: { slug: 'black' }, colorB: { slug: 'dark-brown' }, score: 3, harmony: 'Clash', reason: 'Leathers clash' },
    ]);
    const r = colorPairScore(C.darkBrown, C.black, lookup);
    expect(r.ruleType).toBe('curated');
    expect(r.pairScore).toBe(3);
    expect(r.isClash).toBe(true);
  });
});
