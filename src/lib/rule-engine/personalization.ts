// Pure personalization matching (no database access). The rule lookup that
// reads the personalization table lives in catalog.ts.
import type { PersonalizationRule } from '@prisma/client';
import { hexToHSL, type ColorInput } from './color-rules';
import { PATTERN_SCALE } from './config';

export interface StyleProfile {
  hairColor?: string;
  eyeColor?: string;
  skinTone?: string;
  underTone?: string;
  torsoLength?: string;
  bodyProportion?: string;
}

// ---------------------------------------------------------------------------
// Color concepts
// ---------------------------------------------------------------------------

interface ColorFacts {
  words: Set<string>;
  family: string;
  h: number;
  s: number;
  l: number;
}

function factsFor(c: ColorInput): ColorFacts {
  const { h, s, l } = hexToHSL(c.hex);
  return {
    words: new Set(c.name.toLowerCase().split(/[^a-z]+/).filter(Boolean)),
    family: (c.family || '').toLowerCase(),
    h,
    // Wardrobe neutrals (navy, charcoal, camel...) are treated as achromatic,
    // so hue-based concepts like "Jewel Tones" or "Cool Blue" never catch
    // them; they still match by name/family ("Brown", "Neutral Beige").
    s: c.isNeutral ? 0 : s,
    l,
  };
}

const hasWord = (f: ColorFacts, ...w: string[]) => w.some((x) => f.words.has(x));
const hueIn = (f: ColorFacts, from: number, to: number) => (from <= to ? f.h >= from && f.h <= to : f.h >= from || f.h <= to);

// The personalization dataset speaks in stylist vocabulary ("Earth Tones",
// "Jewel Tones", "Icy Gray"). Each concept is defined by name keywords plus
// the actual hue/saturation/lightness it describes — instead of substring
// matching, where "Blue" matched both "Navy Blue" (recommended) and "Baby
// Blue" (avoid), and "tan" matched "Tangerine".
const CONCEPTS: Record<string, (f: ColorFacts) => boolean> = {
  'earth tones': (f) =>
    f.family === 'brown' ||
    hasWord(f, 'olive', 'khaki', 'rust', 'terracotta', 'camel', 'tan', 'ochre', 'sand', 'cognac', 'tobacco', 'chocolate', 'moss', 'sage') ||
    (f.family === 'green' && f.s < 55 && f.l < 50),
  olive: (f) => hasWord(f, 'olive') || (hueIn(f, 55, 100) && f.s >= 20 && f.s <= 60 && f.l >= 18 && f.l <= 45),
  coral: (f) => hasWord(f, 'coral', 'salmon') || (hueIn(f, 0, 20) && f.s >= 50 && f.l >= 55 && f.l <= 75),
  peach: (f) => hasWord(f, 'peach', 'apricot') || (hueIn(f, 15, 35) && f.s >= 40 && f.l >= 70),
  mustard: (f) => hasWord(f, 'mustard', 'ochre') || (hueIn(f, 38, 55) && f.s >= 45 && f.s <= 85 && f.l >= 30 && f.l <= 55),
  'warm red': (f) => (f.family === 'red' || hasWord(f, 'red', 'brick', 'tomato')) && hueIn(f, 0, 18) && f.s >= 45,
  'jewel tones': (f) =>
    hasWord(f, 'emerald', 'sapphire', 'ruby', 'amethyst', 'garnet', 'jade', 'teal', 'burgundy', 'plum') ||
    (['blue', 'green', 'purple', 'red', 'pink'].includes(f.family) && f.s >= 40 && f.l >= 18 && f.l <= 45),
  'icy blue': (f) => (f.family === 'blue' || hueIn(f, 180, 240)) && f.l >= 72,
  lavender: (f) => hasWord(f, 'lavender', 'lilac', 'mauve') || (hueIn(f, 250, 295) && f.l >= 65),
  silver: (f) => hasWord(f, 'silver', 'platinum', 'pewter'),
  emerald: (f) => hasWord(f, 'emerald') || (hueIn(f, 135, 165) && f.s >= 45 && f.l >= 25 && f.l <= 45),
  'soft pinks': (f) => (f.family === 'pink' || hasWord(f, 'pink', 'blush', 'rose')) && (f.l >= 65 || f.s <= 55),
  plums: (f) => hasWord(f, 'plum', 'aubergine', 'eggplant', 'mulberry', 'wine') || (hueIn(f, 280, 335) && f.l <= 40 && f.s >= 20),
  teal: (f) => hasWord(f, 'teal', 'petrol') || (hueIn(f, 170, 195) && f.s >= 30 && f.l >= 20 && f.l <= 55),
  'neutral beige': (f) => hasWord(f, 'beige', 'ecru', 'oatmeal', 'sand', 'taupe', 'cream', 'greige', 'khaki', 'stone', 'ivory'),
  // Excludes very dark blues (navy is a wardrobe neutral, not a "cool blue").
  'cool blue': (f) => hueIn(f, 195, 250) && f.s >= 35 && f.l >= 30,
  // Light greys only — not white.
  'icy gray': (f) => f.s <= 18 && f.l >= 75 && f.l <= 93 && (hueIn(f, 180, 260) || f.s <= 5) && !hasWord(f, 'white', 'ivory', 'cream', 'ecru'),
  orange: (f) => f.family === 'orange' || (hueIn(f, 15, 40) && f.s >= 55 && f.l >= 35),
  brown: (f) => f.family === 'brown' || hasWord(f, 'brown', 'chocolate', 'tobacco', 'cognac', 'walnut', 'chestnut'),
  fluorescents: (f) => hasWord(f, 'neon', 'fluorescent') || (f.s >= 85 && f.l >= 45 && f.l <= 70),
  'harsh yellow': (f) => (f.family === 'yellow' || hueIn(f, 48, 65)) && f.s >= 75 && f.l >= 40 && f.l <= 70,
};

const singular = (w: string) => w.replace(/(es|s)$/, '');

/** Does a stylist term like "Earth Tones" or "Teal" describe this color? */
export function colorMatchesTerm(color: ColorInput, term: string): boolean {
  const key = term.trim().toLowerCase().replace('grey', 'gray');
  const f = factsFor(color);
  const concept = CONCEPTS[key] || CONCEPTS[singular(key)];
  if (concept) return concept(f);

  // Unknown term: whole-word match only. Every word of the term must appear in
  // the color name ("navy blue" -> "Navy Blue"), or the term is the family.
  const termWords = key.split(/[^a-z]+/).filter(Boolean).map(singular);
  if (termWords.length === 0) return false;
  const nameWords = new Set([...f.words].map(singular));
  return termWords.every((w) => nameWords.has(w)) || (termWords.length === 1 && singular(f.family) === termWords[0]);
}

export function splitTerms(field: string): string[] {
  return field
    .split(',')
    .map((t) => t.trim())
    .filter(Boolean);
}

export type ColorVerdict = 'recommended' | 'avoid' | 'neutral';

export function judgeColorForProfile(
  color: ColorInput,
  rule: Pick<PersonalizationRule, 'recommendedClothingColors' | 'avoidClothingColors'>
): ColorVerdict {
  const avoid = splitTerms(rule.avoidClothingColors).some((t) => colorMatchesTerm(color, t));
  if (avoid) return 'avoid';
  const rec = splitTerms(rule.recommendedClothingColors).some((t) => colorMatchesTerm(color, t));
  return rec ? 'recommended' : 'neutral';
}

// ---------------------------------------------------------------------------
// Body proportion -> menswear fit guidance
// ---------------------------------------------------------------------------

// The dataset's fit advice is womenswear vocabulary ("Empire Waist", "A-Line
// Bottoms", "Wraps") that never matches a menswear catalog fit. These are the
// menswear equivalents per body proportion, keyed by the dataset's values.
// `slots` limits a rule to tops or bottoms where that matters.
interface FitRule {
  fit: string; // lowercase first word of the catalog Fit name
  slots?: ('top' | 'bottom' | 'layer')[];
}

const BODY_FIT_GUIDE: Record<string, { good: FitRule[]; avoid: FitRule[] }> = {
  rectangle: {
    good: [{ fit: 'tailored' }, { fit: 'slim' }, { fit: 'athletic' }],
    avoid: [{ fit: 'oversized' }],
  },
  'inverted triangle': {
    good: [{ fit: 'regular' }, { fit: 'tailored' }, { fit: 'relaxed', slots: ['bottom'] }],
    avoid: [{ fit: 'skinny', slots: ['bottom'] }, { fit: 'athletic', slots: ['top', 'layer'] }],
  },
  triangle: {
    good: [{ fit: 'tailored' }, { fit: 'athletic', slots: ['top', 'layer'] }, { fit: 'regular', slots: ['bottom'] }],
    avoid: [{ fit: 'skinny', slots: ['bottom'] }, { fit: 'slim', slots: ['bottom'] }],
  },
  oval: {
    good: [{ fit: 'regular' }, { fit: 'tailored' }],
    avoid: [{ fit: 'skinny' }, { fit: 'slim' }, { fit: 'oversized' }],
  },
  apple: {
    good: [{ fit: 'regular' }, { fit: 'tailored' }],
    avoid: [{ fit: 'skinny' }, { fit: 'slim' }, { fit: 'oversized' }],
  },
  trapezoid: {
    good: [{ fit: 'slim' }, { fit: 'tailored' }, { fit: 'athletic' }],
    avoid: [{ fit: 'oversized' }],
  },
  hourglass: {
    good: [{ fit: 'tailored' }, { fit: 'slim' }],
    avoid: [{ fit: 'oversized' }, { fit: 'relaxed' }],
  },
};

function fitRuleApplies(rule: FitRule, fitName: string, slot: string): boolean {
  if (!fitName.toLowerCase().startsWith(rule.fit)) return false;
  return !rule.slots || (rule.slots as string[]).includes(slot);
}

export function judgeFitForBody(fitName: string, slot: string, bodyProportion: string): ColorVerdict {
  const guide = BODY_FIT_GUIDE[bodyProportion.trim().toLowerCase()];
  if (!guide) return 'neutral';
  if (guide.avoid.some((r) => fitRuleApplies(r, fitName, slot))) return 'avoid';
  if (guide.good.some((r) => fitRuleApplies(r, fitName, slot))) return 'recommended';
  return 'neutral';
}

// Dataset pattern advice -> which catalog patterns it endorses.
export function judgePatternForBody(
  patternSlug: string,
  slot: string,
  recommendedPatterns: string,
  topIsBright: boolean
): ColorVerdict {
  const scale = PATTERN_SCALE[patternSlug] ?? 2;
  let verdict: ColorVerdict = 'neutral';
  for (const raw of splitTerms(recommendedPatterns)) {
    const t = raw.toLowerCase();
    if (t.includes('vertical stripe') && patternSlug === 'striped') verdict = 'recommended';
    else if ((t.includes('simple solid') || t.includes('solid')) && scale === 0) {
      if (!t.includes('top') || slot === 'top' || slot === 'layer') verdict = 'recommended';
    } else if (t.includes('subtle') && scale > 0) verdict = scale <= 2 ? 'recommended' : 'avoid';
    else if (t.includes('diagonal') && patternSlug === 'herringbone') verdict = 'recommended';
    else if (t.includes('bright top') && slot === 'top' && topIsBright) verdict = 'recommended';
  }
  return verdict;
}
