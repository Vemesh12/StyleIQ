// Pure color-harmony math — no database access. Curated ColorCompatibilityRule
// rows (when present) take precedence over this; see ColorRuleLookup below.

export interface ColorInput {
  name: string;
  hex: string;
  slug?: string;
  family?: string;
  isNeutral?: boolean;
}

export interface ColorPairResult {
  pairScore: number; // 0-10
  harmony: string;
  ruleType: string;
  reason: string;
  isClash: boolean;
}

// Convert Hex to full HSL (Hue: 0-360, Saturation: 0-100%, Lightness: 0-100%)
export function hexToHSL(hex: string): { h: number; s: number; l: number } {
  let c = hex.replace('#', '');
  if (c.length === 3) c = c.split('').map((x) => x + x).join('');
  const r = parseInt(c.substring(0, 2), 16) / 255;
  const g = parseInt(c.substring(2, 4), 16) / 255;
  const b = parseInt(c.substring(4, 6), 16) / 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0;
  let s = 0;
  const l = (max + min) / 2;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r:
        h = (g - b) / d + (g < b ? 6 : 0);
        break;
      case g:
        h = (b - r) / d + 2;
        break;
      case b:
        h = (r - g) / d + 4;
        break;
    }
    h /= 6;
  }

  return {
    h: Math.round(h * 360),
    s: Math.round(s * 100),
    l: Math.round(l * 100),
  };
}

// Hue on the painter's (RYB) color wheel that fashion color theory uses,
// converted from the screen (RGB/HSL) hue. On the RGB wheel red's opposite is
// cyan and blue's is yellow; on the RYB wheel they're green and orange — which
// is what "complementary" means in styling (red/green clash, navy/gold works).
const RGB_TO_RYB: [number, number][] = [
  [0, 0],
  [30, 60],
  [60, 120],
  [120, 180],
  [240, 240],
  [300, 300],
  [360, 360],
];

export function rybHue(hslHue: number): number {
  const h = ((hslHue % 360) + 360) % 360;
  for (let i = 1; i < RGB_TO_RYB.length; i++) {
    const [x0, y0] = RGB_TO_RYB[i - 1];
    const [x1, y1] = RGB_TO_RYB[i];
    if (h <= x1) return y0 + ((h - x0) / (x1 - x0)) * (y1 - y0);
  }
  return h;
}

/** Inverse of rybHue: the screen (HSL) hue for a painter's-wheel hue. */
export function hslHueFromRyb(ryb: number): number {
  const h = ((ryb % 360) + 360) % 360;
  for (let i = 1; i < RGB_TO_RYB.length; i++) {
    const [x0, y0] = RGB_TO_RYB[i - 1];
    const [x1, y1] = RGB_TO_RYB[i];
    if (h <= y1) return x0 + ((h - y0) / (y1 - y0)) * (x1 - x0);
  }
  return h;
}

// ---------------------------------------------------------------------------
// Perceptual color measurement (OKLab / OKLCH, Björn Ottosson 2020)
// ---------------------------------------------------------------------------
// HSL "lightness" and "saturation" are screen math, not perception: pure
// yellow and pure blue are both "50% light" in HSL, yet yellow looks nearly
// white and blue dark; very dark or pale colors get huge HSL saturation even
// though they look almost grey. All contrast and loudness judgments below use
// OKLCH instead: L = perceived lightness (0-100), C = colorfulness (0 ≈ grey,
// ~15+ = vivid), h = hue angle.

const srgbToLinear = (v: number) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);

function oklab(hex: string): { L: number; a: number; b: number } {
  let c = hex.replace('#', '');
  if (c.length === 3) c = c.split('').map((x) => x + x).join('');
  const n = parseInt(c, 16);
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((x) => srgbToLinear(x / 255));
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s2 = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  return {
    L: (0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s2) * 100,
    a: (1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s2) * 100,
    b: (0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s2) * 100,
  };
}

/** Perceived lightness L (0-100), colorfulness C (0 = grey), hue h (degrees). */
export function oklch(hex: string): { L: number; C: number; h: number } {
  const { L, a, b } = oklab(hex);
  return { L, C: Math.hypot(a, b), h: ((Math.atan2(b, a) * 180) / Math.PI + 360) % 360 };
}

/** Perceptual distance between two colors (ΔE in OKLab, ×100). < 2 looks identical. */
export function colorDistance(hexA: string, hexB: string): number {
  const x = oklab(hexA);
  const y = oklab(hexB);
  return Math.hypot(x.L - y.L, x.a - y.a, x.b - y.b);
}

// Thresholds, calibrated on the catalog palette (see the unit tests).
export const COLOR_PERCEPTION = {
  greyChroma: 3, // below this a color reads as grey/white/black
  darkNeutral: { maxL: 30, maxC: 6.5 }, // navy, ink, near-black greens and browns read as neutrals
  earthNeutral: { minL: 65, maxC: 8 }, // sand, stone, wheat, khaki — light muted warm tones read as neutrals
  mutedChroma: 8, // pastels, dusty and earthy colors
  loud: { minC: 14, minL: 45 }, // vivid colors that demand attention
  neon: { minC: 19, minL: 60 },
  tonalContrast: 15, // ΔL that makes light/dark versions of one color look deliberate
  vibrateMaxDeltaL: 16, // opposite vivid colors this close in lightness visually vibrate (red/green ≈ 13)
  sameColor: 2, // ΔE below which two colors look identical
  nearMiss: 8, // ΔE below which two different neutrals look like a failed match
};

/**
 * A color behaves like a neutral when it's flagged as one, when it has so
 * little colorfulness that its hue barely registers (greys, near-white,
 * near-black), or when it is very dark and only faintly colored (navy, ink,
 * dark racing green) — the way those colors actually read in clothing.
 */
export function actsAsNeutral(c: ColorInput): boolean {
  if (c.isNeutral || isMetallic(c)) return true;
  const { L, C } = oklch(c.hex);
  const P = COLOR_PERCEPTION;
  if (C < P.greyChroma || (L < P.darkNeutral.maxL && C < P.darkNeutral.maxC)) return true;
  return isEarthNeutral(c.hex, L, C);
}

/** Metallic finishes (gold, silver, bronze hardware and fabrics) behave as neutrals in an outfit. */
const isMetallic = (c: ColorInput) => /metallic/i.test(c.name);

/** Light, muted warm tones (sand, stone, wheat, khaki, beige): menswear neutrals. */
function isEarthNeutral(hex: string, L: number, C: number): boolean {
  const h = rybHue(hexToHSL(hex).h);
  return h >= 15 && h < 100 && C < COLOR_PERCEPTION.earthNeutral.maxC && L >= COLOR_PERCEPTION.earthNeutral.minL;
}

const isLoud = (o: { L: number; C: number }) => o.C >= COLOR_PERCEPTION.loud.minC && o.L >= COLOR_PERCEPTION.loud.minL;

/** Warm (red/orange/yellow side) vs cool (green/blue/purple side) on the painter's wheel. */
export function colorTemperature(c: ColorInput): 'warm' | 'cool' | 'none' {
  const { C } = oklch(c.hex);
  if (C < COLOR_PERCEPTION.greyChroma) return 'none';
  const h = rybHue(hexToHSL(c.hex).h);
  return h < 150 || h >= 330 ? 'warm' : 'cool';
}

/**
 * Color family from the actual color, not a hand-typed label: Neutral for
 * greys/near-black/near-white, Brown for dark muted warm colors, otherwise a
 * hue sector of the painter's wheel. Used for the "too many colors" rule and
 * for matching personalization terms, so a mislabelled catalog color (e.g. a
 * yellow filed under "Orange", or every pastel under "Pastel") can't skew them.
 */
export function colorFamily(c: ColorInput): 'Neutral' | 'Brown' | 'Red' | 'Pink' | 'Orange' | 'Yellow' | 'Green' | 'Blue' | 'Purple' {
  const { L, C } = oklch(c.hex);
  if (C < COLOR_PERCEPTION.greyChroma || isMetallic(c)) return 'Neutral';
  const h = rybHue(hexToHSL(c.hex).h);
  // Painter's-wheel sectors. Browns are dark or muted oranges/reds; olive
  // (yellow-green) is filed with greens, magenta-pinks with pinks.
  if (h >= 15 && h < 90 && ((L < 60 && C < 13) || (L < 75 && C < 10))) return 'Brown';
  if (isEarthNeutral(c.hex, L, C)) return 'Brown'; // sand, khaki, wheat: earth tones
  if (h >= 345 || h < 30) return L >= 68 ? 'Pink' : 'Red';
  if (h < 90) return 'Orange';
  if (h < 135) return 'Yellow';
  if (h < 210) return 'Green';
  if (h < 255) return 'Blue';
  if (h < 315) return 'Purple';
  return 'Pink';
}

function result(pairScore: number, harmony: string, ruleType: string, reason: string): ColorPairResult {
  const score = Math.round(Math.max(0, Math.min(10, pairScore)) * 10) / 10;
  return { pairScore: score, harmony, ruleType, reason, isClash: score < 6 };
}

/**
 * Color-wheel evaluation for any two colors. Hue relationships use the
 * painter's (RYB) wheel; lightness contrast, colorfulness and "loudness" use
 * perceptual OKLCH. Every band is reachable and there is a real clash band.
 */
export function evaluateColorPairHarmony(cA: ColorInput, cB: ColorInput): ColorPairResult {
  const P = COLOR_PERCEPTION;
  const a = oklch(cA.hex);
  const b = oklch(cB.hex);
  const deltaL = Math.abs(a.L - b.L);
  const distance = colorDistance(cA.hex, cB.hex);
  const neutralA = actsAsNeutral(cA);
  const neutralB = actsAsNeutral(cB);

  // 0. The same color (or indistinguishable). Tonal dressing in a neutral or
  // muted shade is classic; a vivid color head-to-toe is a bold statement.
  if (distance < P.sameColor || (cA.slug && cA.slug === cB.slug)) {
    if ((neutralA && neutralB) || Math.max(a.C, b.C) < 10) {
      return result(9.6, 'Exact Match', 'tonal-exact', `Matching ${cA.name} throughout creates a clean, intentional tonal look.`);
    }
    return result(7.6, 'Bold Monochrome', 'vivid-monochrome', `${cA.name} head-to-toe is a bold statement — it works best with neutral shoes and accessories to break it up.`);
  }

  // 1. Two neutrals.
  if (neutralA && neutralB) {
    // A visible hue difference (navy vs charcoal) keeps two same-depth
    // neutrals apart; two greys or two beiges of nearly equal depth don't.
    const sameTint = Math.abs(a.C - b.C) < 4;
    if (deltaL < 8 && distance < P.nearMiss && sameTint) {
      return result(6.2, 'Near-Miss Neutrals', 'flat-neutral', `${cA.name} and ${cB.name} are almost — but not quite — the same shade, which looks like a failed match. Go for clear contrast or an exact match.`);
    }
    const tA = colorTemperature(cA);
    const tB = colorTemperature(cB);
    if (tA !== 'none' && tB !== 'none' && tA !== tB && a.C >= 4 && b.C >= 4 && deltaL < 25) {
      return result(8.0, 'Mixed Undertones', 'mixed-temperature-neutral', `${cA.name} is a ${tA} neutral and ${cB.name} a ${tB} one — they work, but sticking to one temperature looks more polished.`);
    }
    if (deltaL < 8 && sameTint) {
      return result(8.5, 'Tonal Neutrals', 'tonal-neutral', `${cA.name} and ${cB.name} are different neutrals at a similar depth — a quiet, tonal combination.`);
    }
    return result(9.2, 'Classic Neutrals', 'neutral-pair', `${cA.name} and ${cB.name} are a dependable neutral pairing.`);
  }

  // 2. Neutral + color: the neutral anchors the color — unless they blur
  // together (dark on dark, pale on pale), or the color is a neon that a
  // neutral can't calm down.
  if (neutralA || neutralB) {
    const neutral = neutralA ? cA : cB;
    const color = neutralA ? cB : cA;
    const colorOk = neutralA ? b : a;
    if (deltaL < 10 && Math.max(a.L, b.L) < 40) {
      return result(7.0, 'Muddy Contrast', 'dark-on-dark', `${color.name} and ${neutral.name} are both very dark, so they blur together — a lighter piece between them would help.`);
    }
    if (deltaL < 6 && Math.min(a.L, b.L) > 85) {
      return result(7.0, 'Washed Out', 'pale-on-pale', `${color.name} and ${neutral.name} are both very pale, so there's almost no contrast — add a darker piece to give the outfit shape.`);
    }
    if (colorOk.C >= P.neon.minC && colorOk.L >= P.neon.minL) {
      return result(8.6, 'Statement Color', 'neon-on-neutral', `${neutral.name} grounds ${color.name}, but ${color.name} is very bright — keep it the only loud piece.`);
    }
    return result(9.3, 'Neutral Anchor', 'classic-neutral', `${neutral.name} is a versatile neutral that grounds ${color.name}.`);
  }

  // 3. Two real colors: hue relationship on the painter's wheel, then
  // perceived lightness contrast and loudness.
  const hueDiff = Math.abs(rybHue(hexToHSL(cA.hex).h) - rybHue(hexToHSL(cB.hex).h));
  const angle = Math.min(hueDiff, 360 - hueDiff);
  const bothLoud = isLoud(a) && isLoud(b);
  const oneMuted = Math.min(a.C, b.C) < P.mutedChroma;

  let r: ColorPairResult;
  if (angle <= 15) {
    r =
      deltaL >= P.tonalContrast
        ? result(9.2, 'Tonal Shades', 'monochromatic-contrast', `Light and dark shades of the same color (${cA.name} and ${cB.name}) look deliberate and polished.`)
        : result(7.8, 'Tone on Tone', 'monochromatic-flat', `${cA.name} and ${cB.name} are very close shades — fine, but more light/dark contrast would read sharper.`);
  } else if (angle <= 45) {
    r = result(8.8, 'Neighbour Colors', 'analogous', `${cA.name} and ${cB.name} sit next to each other on the color wheel and blend smoothly.`);
  } else if (angle <= 89) {
    // The awkward zone: too far apart to blend, too close to contrast.
    r =
      oneMuted || deltaL >= 30
        ? result(6.6, 'Muted Mismatch', 'discordant-softened', `${cA.name} and ${cB.name} don't naturally relate, though the muted tone/contrast keeps it wearable.`)
        : result(5.0, 'Uneasy Pair', 'discordant', `${cA.name} and ${cB.name} are neither close enough to blend nor far enough apart to contrast — they tend to clash.`);
  } else if (angle <= 135) {
    r = result(8.3, 'Balanced Contrast', 'triadic', `${cA.name} and ${cB.name} form a balanced, triadic-style contrast.`);
  } else if (angle <= 164) {
    r = result(8.5, 'Smart Contrast', 'split-complementary', `${cA.name} and ${cB.name} are a split-complementary pair with attractive balance.`);
  } else {
    r =
      bothLoud && deltaL < P.vibrateMaxDeltaL
        ? result(5.0, 'Vibrating Clash', 'complementary-clash', `${cA.name} and ${cB.name} are opposite, equally bright colors — side by side they visually vibrate. Mute one of them.`)
        : result(8.7, 'Perfect Contrast', 'complementary', `${cA.name} and ${cB.name} are opposite on the color wheel for a bold, confident contrast.`);
  }

  // Two loud colors that aren't neighbours compete for attention — unless
  // they are complementary with a clear light/dark split (cobalt and orange,
  // purple and gold), which is the classic way to wear two strong colors.
  const darkLightComplement = angle > 164 && deltaL >= 20;
  if (bothLoud && angle > 45 && !r.isClash && !darkLightComplement) {
    return result(r.pairScore - 1, r.harmony, r.ruleType, `${r.reason} Both are very saturated, so let one of them lead.`);
  }
  return r;
}

export interface CuratedColorRule {
  score: number;
  harmony: string;
  reason: string;
}

export interface ColorRuleLookup {
  get(slugA: string, slugB: string): CuratedColorRule | undefined;
}

/**
 * In-memory lookup over curated ColorCompatibilityRule rows, so scoring many
 * outfits doesn't need a DB round-trip per color pair.
 */
export function buildColorRuleLookup(
  rules: { colorA: { slug: string }; colorB: { slug: string }; score: number; harmony: string; reason: string }[]
): ColorRuleLookup {
  const map = new Map<string, CuratedColorRule>();
  for (const r of rules) {
    const entry = { score: r.score, harmony: r.harmony, reason: r.reason };
    map.set(`${r.colorA.slug}|${r.colorB.slug}`, entry);
    map.set(`${r.colorB.slug}|${r.colorA.slug}`, entry);
  }
  return { get: (a, b) => map.get(`${a}|${b}`) };
}

/** Curated rule if one exists for the pair, otherwise color-wheel math. */
export function colorPairScore(cA: ColorInput, cB: ColorInput, lookup?: ColorRuleLookup): ColorPairResult {
  const curated = cA.slug && cB.slug ? lookup?.get(cA.slug, cB.slug) : undefined;
  if (curated) {
    return {
      pairScore: curated.score,
      harmony: curated.harmony,
      ruleType: 'curated',
      reason: curated.reason,
      isClash: curated.score < 6,
    };
  }
  return evaluateColorPairHarmony(cA, cB);
}
