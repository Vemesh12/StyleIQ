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

/**
 * A color behaves like a neutral when it's flagged as one OR when it has so
 * little saturation (greys, near-black, near-white) that its hue is
 * meaningless. Without this, a dusty grey-blue gets judged "complementary"
 * or "clashing" on a hue the eye can barely see.
 */
export function actsAsNeutral(c: ColorInput): boolean {
  if (c.isNeutral) return true;
  const { s, l } = hexToHSL(c.hex);
  return s < 12 || l < 12 || l > 93;
}

function result(pairScore: number, harmony: string, ruleType: string, reason: string): ColorPairResult {
  const score = Math.round(Math.max(0, Math.min(10, pairScore)) * 10) / 10;
  return { pairScore: score, harmony, ruleType, reason, isClash: score < 6 };
}

/**
 * Color-wheel evaluation for any two colors. Every hue band below is
 * reachable (the old split-complementary branch was shadowed by the
 * triadic/complementary checks), and there is a genuine low band — clashing
 * colors now score as clashes instead of a minimum "Good Combination".
 */
export function evaluateColorPairHarmony(cA: ColorInput, cB: ColorInput): ColorPairResult {
  if (cA.hex.toLowerCase() === cB.hex.toLowerCase() || (cA.slug && cA.slug === cB.slug)) {
    return result(9.6, 'Exact Match', 'tonal-exact', `Matching ${cA.name} throughout creates a clean, intentional tonal look.`);
  }

  const a = hexToHSL(cA.hex);
  const b = hexToHSL(cB.hex);
  const lightnessDelta = Math.abs(a.l - b.l);
  const neutralA = actsAsNeutral(cA);
  const neutralB = actsAsNeutral(cB);

  // 1. Two neutrals. Different neutrals at a similar depth (navy blazer over
  // charcoal trousers) are a classic tonal look; what reads badly is two
  // neutrals that are ALMOST the same color — it looks like a failed match.
  if (neutralA && neutralB) {
    if (lightnessDelta < 10) {
      const bothGreyish = a.s < 15 && b.s < 15;
      const hueGap = Math.abs(rybHue(a.h) - rybHue(b.h));
      const sameHue = Math.min(hueGap, 360 - hueGap) < 30;
      // Saturation matters too: navy (saturated) over charcoal (greyish) is a
      // deliberate contrast even though their hues and depth are close.
      const sameSaturation = Math.abs(a.s - b.s) < 15;
      if ((bothGreyish || sameHue) && sameSaturation) {
        return result(
          6.2,
          'Near-Miss Neutrals',
          'flat-neutral',
          `${cA.name} and ${cB.name} are almost — but not quite — the same shade, which looks like a failed match. Go for clear contrast or an exact match.`
        );
      }
      return result(8.5, 'Tonal Neutrals', 'tonal-neutral', `${cA.name} and ${cB.name} are different neutrals at a similar depth — a quiet, tonal combination.`);
    }
    return result(9.2, 'Classic Neutrals', 'neutral-pair', `${cA.name} and ${cB.name} are a dependable neutral pairing.`);
  }

  // 2. Neutral + color: the neutral anchors the color — unless both are so
  // dark (or so similar in lightness) that they blur into each other.
  if (neutralA || neutralB) {
    const neutral = neutralA ? cA : cB;
    const color = neutralA ? cB : cA;
    if (lightnessDelta < 12 && Math.max(a.l, b.l) < 35) {
      return result(
        7.0,
        'Muddy Contrast',
        'dark-on-dark',
        `${color.name} and ${neutral.name} are both very dark, so they blur together — a lighter piece between them would help.`
      );
    }
    return result(9.3, 'Neutral Anchor', 'classic-neutral', `${neutral.name} is a versatile neutral that grounds ${color.name}.`);
  }

  // 3. Two real colors: judge by hue distance on the RYB wheel, then by how
  // loud they are.
  const hueDiff = Math.abs(rybHue(a.h) - rybHue(b.h));
  const angle = Math.min(hueDiff, 360 - hueDiff);
  const bothLoud = a.s >= 65 && b.s >= 65 && a.l > 30 && a.l < 72 && b.l > 30 && b.l < 72;
  const oneMuted = Math.min(a.s, b.s) < 35;

  let r: ColorPairResult;
  if (angle <= 15) {
    r =
      lightnessDelta >= 20
        ? result(9.2, 'Tonal Shades', 'monochromatic-contrast', `Light and dark shades of the same color (${cA.name} and ${cB.name}) look deliberate and polished.`)
        : result(7.8, 'Tone on Tone', 'monochromatic-flat', `${cA.name} and ${cB.name} are very close shades — fine, but more light/dark contrast would read sharper.`);
  } else if (angle <= 45) {
    r = result(8.8, 'Neighbour Colors', 'analogous', `${cA.name} and ${cB.name} sit next to each other on the color wheel and blend smoothly.`);
  } else if (angle <= 89) {
    // The awkward zone: too far apart to blend, too close to contrast.
    r =
      oneMuted || lightnessDelta >= 35
        ? result(6.6, 'Muted Mismatch', 'discordant-softened', `${cA.name} and ${cB.name} don't naturally relate, though the muted tone/contrast keeps it wearable.`)
        : result(5.0, 'Uneasy Pair', 'discordant', `${cA.name} and ${cB.name} are neither close enough to blend nor far enough apart to contrast — they tend to clash.`);
  } else if (angle <= 135) {
    r = result(8.3, 'Balanced Contrast', 'triadic', `${cA.name} and ${cB.name} form a balanced, triadic-style contrast.`);
  } else if (angle <= 164) {
    r = result(8.5, 'Smart Contrast', 'split-complementary', `${cA.name} and ${cB.name} are a split-complementary pair with attractive balance.`);
  } else {
    r =
      bothLoud && lightnessDelta < 20
        ? result(5.0, 'Vibrating Clash', 'complementary-clash', `${cA.name} and ${cB.name} are opposite, equally bright colors — side by side they visually vibrate. Mute one of them.`)
        : result(8.7, 'Perfect Contrast', 'complementary', `${cA.name} and ${cB.name} are opposite on the color wheel for a bold, confident contrast.`);
  }

  // Two loud colors that aren't neighbours compete for attention.
  if (bothLoud && angle > 45 && !r.isClash) {
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
