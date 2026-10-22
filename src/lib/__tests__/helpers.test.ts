import { describe, expect, it } from 'vitest';
import { dominantColorsFromPixels } from '../color-extract';
import { cached, cacheSize, invalidateCache } from '../ttl-cache';
import { slugify } from '../utils';
import { dailySuggestionSchema, pickerRecommendSchema, registerSchema, colorMatchSchema, wardrobeAddSchema } from '../validation';
import { seasonFor } from '../weather';

/** Synthetic photo: a garment rectangle in the middle of a background. */
function photo(w: number, h: number, bg: number[], fg: number[]) {
  const data = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const inside = x > w * 0.25 && x < w * 0.75 && y > h * 0.2 && y < h * 0.85;
      const c = inside ? fg : bg;
      data.set([c[0], c[1], c[2], 255], (y * w + x) * 4);
    }
  }
  return data;
}
const distance = (hex: string, rgb: number[]) => {
  const v = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
  return Math.hypot(v[0] - rgb[0], v[1] - rgb[1], v[2] - rgb[2]);
};

describe('dominantColorsFromPixels', () => {
  it('detects a black garment on a white backdrop', () => {
    const [first] = dominantColorsFromPixels(photo(120, 160, [250, 250, 250], [18, 18, 20]), 120, 160);
    expect(distance(first, [18, 18, 20])).toBeLessThan(20);
  });

  it('detects a white garment on a dark backdrop', () => {
    const [first] = dominantColorsFromPixels(photo(120, 160, [40, 30, 25], [245, 245, 242]), 120, 160);
    expect(distance(first, [245, 245, 242])).toBeLessThan(20);
  });

  it('never overflows a bright channel into the next one', () => {
    const [first] = dominantColorsFromPixels(photo(80, 80, [10, 120, 10], [250, 100, 100]), 80, 80);
    expect(first).toMatch(/^#[0-9a-f]{6}$/);
    expect(distance(first, [250, 100, 100])).toBeLessThan(10);
  });
});

describe('seasonFor', () => {
  it('uses hemisphere-aware calendar seasons with temperature overrides', () => {
    const oct = new Date('2026-10-22');
    expect(seasonFor(51.5, 15, false, oct)).toBe('autumn');
    expect(seasonFor(-33.9, 18, false, oct)).toBe('spring');
    expect(seasonFor(51.5, 30, false, oct)).toBe('summer');
    expect(seasonFor(19, 28, true, oct)).toBe('monsoon');
  });
});

describe('slugify', () => {
  it.each([
    ['Navy Blue Blazer (Wool) — 2026!', 'navy-blue-blazer-wool-2026'],
    ['Café Crème Chinos', 'cafe-creme-chinos'],
    ['!!!', ''],
  ])('%s -> %s', (input, expected) => expect(slugify(input)).toBe(expected));
});

describe('validation limits', () => {
  it('bounds work a single request can trigger', () => {
    expect(dailySuggestionSchema.safeParse({ garmentIds: Array.from({ length: 101 }, (_, i) => `g${i}`) }).success).toBe(false);
    expect(dailySuggestionSchema.parse({ garmentIds: ['a', 'a', 'b'] }).garmentIds).toEqual(['a', 'b']);
    expect(pickerRecommendSchema.safeParse({ category: 'shirt', itemType: 'x', colorSlugs: Array(11).fill('navy') }).success).toBe(false);
    expect(registerSchema.safeParse({ email: 'a@b.co', password: 'p'.repeat(73) }).success).toBe(false);
    expect(colorMatchSchema.safeParse({ hex: 'zzz' }).success).toBe(false);
  });

  it('accepts one or many wardrobe ids and de-duplicates', () => {
    expect(wardrobeAddSchema.parse({ garmentId: 'a' })).toEqual(['a']);
    expect(wardrobeAddSchema.parse({ garmentIds: ['a', 'b', 'a'] })).toEqual(['a', 'b']);
    expect(wardrobeAddSchema.safeParse({}).success).toBe(false);
  });
});

describe('ttl cache', () => {
  it('shares one computation per key and can be invalidated', async () => {
    let calls = 0;
    const compute = async () => ++calls;
    expect(await cached('t:a', 60_000, compute)).toBe(1);
    expect(await cached('t:a', 60_000, compute)).toBe(1);
    invalidateCache('t:');
    expect(await cached('t:a', 60_000, compute)).toBe(2);
  });

  it('stays bounded no matter how many distinct keys are used', async () => {
    for (let i = 0; i < 2500; i++) await cached(`flood:${i}`, 60_000, async () => i);
    expect(cacheSize()).toBeLessThanOrEqual(2000);
  });
});
