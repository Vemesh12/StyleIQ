import { describe, expect, it } from 'vitest';
import { actsAsNeutral, buildColorRuleLookup, colorDistance, colorFamily, colorPairScore, colorTemperature, evaluateColorPairHarmony, hslHueFromRyb, oklch, rybHue } from '../color-rules';
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

describe('perceptual color theory (OKLCH)', () => {
  const col = (name: string, hex: string, isNeutral = false) => ({ name, hex, isNeutral });

  it('measures perceived lightness, not HSL lightness', () => {
    // Pure yellow and pure blue are both "50% light" in HSL.
    expect(oklch('#FFFF00').L).toBeGreaterThan(90);
    expect(oklch('#0000FF').L).toBeLessThan(50);
    expect(colorDistance('#123456', '#123456')).toBe(0);
  });

  it('rewards complementary colors split light/dark, flags equal-brightness ones', () => {
    expect(evaluateColorPairHarmony(col('Cobalt', '#1F4FD0'), col('Orange', '#F08A1E')).pairScore).toBeGreaterThanOrEqual(8.5);
    expect(evaluateColorPairHarmony(col('Purple', '#5B2A86'), col('Gold', '#E8B830')).pairScore).toBeGreaterThanOrEqual(8.5);
    expect(evaluateColorPairHarmony(C.red, C.green).harmony).toBe('Vibrating Clash');
  });

  it('treats a vivid color head-to-toe differently from tonal neutrals', () => {
    expect(evaluateColorPairHarmony(C.red, { ...C.red, slug: 'red-2' }).harmony).toBe('Bold Monochrome');
    expect(evaluateColorPairHarmony(C.navy, C.navy).pairScore).toBeGreaterThanOrEqual(9.5);
  });

  it('catches light-on-light and dark-on-dark pairings', () => {
    expect(evaluateColorPairHarmony(C.white, col('Pale Yellow', '#FAF3D0')).harmony).toBe('Washed Out');
    expect(evaluateColorPairHarmony(C.black, col('Deep Purple', '#2A0A3A')).harmony).toBe('Muddy Contrast');
  });

  it('keeps classic menswear neutrals classic', () => {
    expect(evaluateColorPairHarmony(C.navy, C.charcoal).pairScore).toBeGreaterThanOrEqual(9);
    expect(evaluateColorPairHarmony(C.navy, col('Sand', '#D9C3A6')).pairScore).toBeGreaterThanOrEqual(9);
    expect(evaluateColorPairHarmony(C.lightGrey, C.silverGrey).harmony).toBe('Near-Miss Neutrals');
  });

  it('derives color families from the color, not the label', () => {
    expect(colorFamily(col('Lemon Yellow', '#FFF44F'))).toBe('Yellow');
    expect(colorFamily(col('Camel', '#C19A6B'))).toBe('Brown');
    expect(colorFamily(col('Royal Purple', '#7851A9'))).toBe('Purple');
    expect(colorFamily(col('Gold Metallic', '#D4AF37'))).toBe('Neutral');
    expect(colorFamily(C.charcoal)).toBe('Neutral');
    expect(colorTemperature(C.mustard)).toBe('warm');
    expect(colorTemperature(C.royalBlue)).toBe('cool');
  });

  it('maps painter\'s-wheel hues back to screen hues', () => {
    for (const h of [0, 25, 60, 150, 240, 300]) expect(hslHueFromRyb(rybHue(h))).toBeCloseTo(h, 5);
  });
});
