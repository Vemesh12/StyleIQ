// The one outfit-scoring engine. The outfit builder, item picker, quick pick
// and daily suggestion all call scoreOutfit() on plain ScoringGarment objects
// (see catalog.ts for loading them), so every flow uses identical rules,
// weights and rating scale. Pure and synchronous — no DB access here.

import {
  ACCESSORY_PAIR_WEIGHTS,
  COLOR_WORST_PAIR_SHARE,
  COMPAT_FALLBACK,
  DIMENSION_WEIGHTS,
  DRESSY_FABRICS,
  FABRIC_RULES,
  FABRIC_WEIGHT,
  FORMALITY_GATE,
  RUGGED_FABRICS,
  PATTERN_SCALE,
  SKIN_TONE_SLOT_WEIGHT,
  SLOT_PAIR_WEIGHTS,
  THREE_COLOR_PENALTY,
  WEATHER_RULES,
  type DimensionKey,
} from './config';
import { actsAsNeutral, colorPairScore, hexToHSL, type ColorInput, type ColorPairResult, type ColorRuleLookup } from './color-rules';
import { judgeColorForProfile, judgeFitForBody, judgePatternForBody, type ColorVerdict } from './personalization';
import { ratingFromScore, type OutfitRating } from './rating';
import { clamp, occasionSuitability } from './suitability';

export type Slot = 'top' | 'bottom' | 'footwear' | 'layer' | 'accessory';

export interface ScoringGarment {
  id: string;
  name: string;
  slug?: string;
  description?: string;
  typeSlug: string;
  typeName?: string;
  slot: Slot;
  formality: number; // 1-5
  colors: ColorInput[]; // primary color first
  patterns: string[]; // pattern slugs
  materials: string[]; // material slugs
  fits: string[]; // fit names, e.g. "Slim Fit"
  occasionSuitability: Record<string, number>; // occasionId -> 1-5 (curated rows)
  seasonSuitability: Record<string, number>; // seasonId -> 1-5 (curated rows)
}

export interface PersonalizationContext {
  // Present only when the matched dataset row agrees with the person's
  // undertone — the dataset's color advice is undertone-specific.
  colorAdvice?: { recommendedClothingColors: string; avoidClothingColors: string };
  bodyProportion?: string;
  // Present only when the matched row agrees with the body proportion.
  recommendedPatterns?: string;
}

export interface ScoringContext {
  occasion?: { id: string; name: string; formalityLevel: number } | null;
  season?: { id: string; slug: string; name: string } | null;
  weather?: { tempC: number; isRainy: boolean } | null;
  personalization?: PersonalizationContext | null;
}

export interface RuleLookups {
  colors: ColorRuleLookup;
  garmentRule(aId: string, bId: string): { rating: number; reason: string } | undefined;
}

export interface DimensionResult {
  score: number; // 0..max
  max: number;
  applied: boolean;
  note?: string;
}

export interface OutfitScore {
  totalScore: number;
  rating: OutfitRating;
  // Points per dimension on its own max (0 when not applied). Kept for the
  // existing UI; `dimensions` says which ones actually counted.
  breakdown: Record<DimensionKey, number>;
  dimensions: Record<DimensionKey, DimensionResult>;
  suggestions: string[];
  highlights: string[];
  formalityGate: number;
  worstColorPair: { a: string; b: string; harmony: string; reason: string; pairScore: number } | null;
}

export interface ScoreOptions {
  // Builder only: hint at missing pieces (shoes, belt). Flows that pick the
  // pieces themselves leave this off.
  suggestMissingPieces?: boolean;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const round1 = (n: number) => Math.round(n * 10) / 10;

/** How much a pair of pieces matters (0 = they don't interact). */
export function pairWeight(a: ScoringGarment, b: ScoringGarment): number {
  if (a.slot !== 'accessory' && b.slot !== 'accessory') {
    const key = [a.slot, b.slot].sort().join('|');
    return SLOT_PAIR_WEIGHTS[key] ?? 0;
  }
  const viaA = ACCESSORY_PAIR_WEIGHTS[a.typeSlug]?.[b.slot === 'accessory' ? b.typeSlug : b.slot] ?? 0;
  const viaB = ACCESSORY_PAIR_WEIGHTS[b.typeSlug]?.[a.slot === 'accessory' ? a.typeSlug : a.slot] ?? 0;
  return Math.max(viaA, viaB);
}

export function patternScale(g: ScoringGarment): number {
  return g.patterns.reduce((max, p) => Math.max(max, PATTERN_SCALE[p] ?? 2), 0);
}

/**
 * Two patterns can coexist when their scales differ (a subtle herringbone
 * blazer over a bold check is classic); two equally loud ones compete.
 */
export function patternClash(a: ScoringGarment, b: ScoringGarment): 'bold' | 'same-scale' | null {
  const sa = patternScale(a);
  const sb = patternScale(b);
  if (sa === 0 || sb === 0) return null;
  if (sa >= 3 && sb >= 3) return 'bold';
  if (sa === sb) return 'same-scale';
  return null;
}

/** Cross-product color score between two garments (primary colors count double). */
export function garmentColorPair(
  a: ScoringGarment,
  b: ScoringGarment,
  lookups: RuleLookups
): { score: number; worst: ColorPairResult & { a: string; b: string } } | null {
  if (a.colors.length === 0 || b.colors.length === 0) return null;
  let total = 0;
  let weight = 0;
  let worst: (ColorPairResult & { a: string; b: string }) | null = null;
  a.colors.forEach((ca, i) => {
    b.colors.forEach((cb, j) => {
      const w = (i === 0 ? 1 : 0.5) * (j === 0 ? 1 : 0.5);
      const r = colorPairScore(ca, cb, lookups.colors);
      total += r.pairScore * w;
      weight += w;
      if (!worst || r.pairScore < worst.pairScore) worst = { ...r, a: ca.name, b: cb.name };
    });
  });
  return { score: total / weight, worst: worst! };
}

const LEATHER_BLACK = ['black', 'jet', 'onyx', 'charcoal', 'anthracite', 'graphite'];
const LEATHER_BROWN = ['brown', 'tan', 'cognac', 'tobacco', 'chocolate', 'walnut', 'chestnut', 'oxblood', 'burgundy', 'camel', 'rust', 'taupe', 'sand'];

/** 'black' | 'brown' leather tone, or null for non-leather / other colors. */
export function leatherTone(g: ScoringGarment): 'black' | 'brown' | null {
  const name = g.name.toLowerCase();
  if (g.slot === 'footwear' && /sneaker|canvas|espadrille|running/.test(name)) return null;
  if (g.typeSlug === 'belt' && !(g.materials.some((m) => m === 'leather' || m === 'suede') || /leather|suede/.test(name))) return null;
  const c = g.colors[0];
  if (!c) return null;
  const words = `${c.name} ${c.family ?? ''}`.toLowerCase().split(/[^a-z]+/);
  if (words.some((w) => LEATHER_BLACK.includes(w))) return 'black';
  if (words.some((w) => LEATHER_BROWN.includes(w))) return 'brown';
  return null;
}

/**
 * Garment pair rating on 1-5. Curated rules win; otherwise the rating is
 * computed from formality distance, pattern clash and color harmony — not a
 * flat "unknown" constant, which used to pin most outfits at ~48%.
 */
export function pairCompatibility(
  a: ScoringGarment,
  b: ScoringGarment,
  lookups: RuleLookups,
  colorScore: number | null
): { rating: number; curated: boolean; reason?: string; leatherClash?: boolean; fabric?: FabricClash } {
  let rating: number;
  let curated = false;
  let reason: string | undefined;

  const rule = lookups.garmentRule(a.id, b.id);
  if (rule) {
    rating = rule.rating;
    curated = true;
    reason = rule.reason;
  } else {
    const c = COMPAT_FALLBACK;
    const gap = Math.min(Math.abs(a.formality - b.formality), c.formalityGapPenalty.length - 1);
    rating = c.base - c.formalityGapPenalty[gap];
    const clash = patternClash(a, b);
    if (clash === 'bold') rating -= c.boldPatternClash;
    else if (clash === 'same-scale') rating -= c.samePatternScale;
    if (colorScore !== null) rating += (colorScore - 7.5) * c.colorInfluence;
  }

  // Fabric clashes lower computed ratings; a curated rating is an expert's
  // judgment of the actual pair and is left alone.
  const fabric = fabricClash(a, b, colorScore) ?? undefined;
  if (fabric && !curated) {
    rating -=
      fabric.kind === 'weight'
        ? FABRIC_RULES.weightClashPenalty
        : fabric.kind === 'sheen'
          ? FABRIC_RULES.sheenClashPenalty
          : FABRIC_RULES.doubleDenimPenalty;
  }

  let leatherClash = false;
  const isBeltShoe =
    (a.typeSlug === 'belt' && b.slot === 'footwear') || (b.typeSlug === 'belt' && a.slot === 'footwear');
  if (isBeltShoe) {
    const ta = leatherTone(a);
    const tb = leatherTone(b);
    if (ta && tb && ta !== tb) {
      leatherClash = true;
      rating = Math.min(rating, 1.5);
    }
  }

  return { rating: clamp(rating, 1, 5), curated, reason, leatherClash, fabric };
}

export type FabricClash = { kind: 'weight' | 'sheen' | 'double-denim'; message: string };

const fabricWeight = (g: ScoringGarment): number | null => {
  const known = g.materials.map((m) => FABRIC_WEIGHT[m]).filter((w): w is number => w !== undefined);
  return known.length ? known[0] : null;
};

/**
 * Fabric combinations that read wrong even when colors and formality work:
 * very different seasonal weights, dressy sheen against rugged casual, and
 * double denim in the same shade. Only clothing pieces (not accessories).
 */
export function fabricClash(a: ScoringGarment, b: ScoringGarment, colorScore: number | null): FabricClash | null {
  if (a.slot === 'accessory' || b.slot === 'accessory' || a.slot === 'footwear' || b.slot === 'footwear') return null;

  const wa = fabricWeight(a);
  const wb = fabricWeight(b);
  if (wa !== null && wb !== null && Math.abs(wa - wb) >= FABRIC_RULES.weightGapForClash) {
    const [light, heavy] = wa < wb ? [a, b] : [b, a];
    return {
      kind: 'weight',
      message: `${light.name} is a summer-weight fabric and ${heavy.name} a winter-weight one — together they look like two different seasons.`,
    };
  }

  const dressy = (g: ScoringGarment) => g.materials.some((m) => DRESSY_FABRICS.has(m));
  const rugged = (g: ScoringGarment) => g.materials.some((m) => RUGGED_FABRICS.has(m));
  if ((dressy(a) && rugged(b)) || (dressy(b) && rugged(a))) {
    const [d, r] = dressy(a) ? [a, b] : [b, a];
    return { kind: 'sheen', message: `${d.name} is a dressy, lustrous fabric that clashes with casual ${r.name}.` };
  }

  const isDenim = (g: ScoringGarment) => g.materials[0] === 'denim';
  if (isDenim(a) && isDenim(b) && (colorScore === null || colorScore >= 9)) {
    return { kind: 'double-denim', message: `${a.name} with ${b.name} is double denim in the same shade — pick contrasting washes or swap one for another fabric.` };
  }
  return null;
}

function formalityGateFor(garments: ScoringGarment[]): { gate: number; gap: number; low?: ScoringGarment; high?: ScoringGarment } {
  // Watches, pocket squares and misc accessories don't set an outfit's formality.
  const counted = garments.filter((g) => g.slot !== 'accessory' || g.typeSlug === 'belt' || g.typeSlug === 'tie');
  if (counted.length < 2) return { gate: 1, gap: 0 };
  const low = counted.reduce((m, g) => (g.formality < m.formality ? g : m));
  const high = counted.reduce((m, g) => (g.formality > m.formality ? g : m));
  const gap = high.formality - low.formality;
  const rule = FORMALITY_GATE.find((r) => gap >= r.minGap);
  return { gate: rule ? rule.multiplier : 1, gap, low, high };
}

/**
 * 1-5 suitability -> 0-10, blending the average with the weakest piece.
 * Uses v/5 (4 = "good" = 80%) to match how the catalog data is authored.
 */
function suitabilityTo10(values: { v: number; w: number }[]): number {
  const totalW = values.reduce((s, x) => s + x.w, 0);
  const avg = values.reduce((s, x) => s + x.v * x.w, 0) / totalW;
  const min = Math.min(...values.map((x) => x.v));
  return clamp(((0.7 * avg + 0.3 * min) / 5) * 10, 0, 10);
}

const pieceWeight = (g: ScoringGarment) => (g.slot !== 'accessory' ? 1 : g.typeSlug === 'belt' || g.typeSlug === 'tie' ? 0.5 : 0.3);

const HEAVY_MATERIALS = new Set(['wool', 'flannel', 'velvet', 'corduroy', 'fleece', 'cashmere', 'merino-wool']);

// Names and slugs are both checked: catalog material data is incomplete
// (e.g. "Brown Casual Boots" is slug tobacco-suede-chukka-boots, material cotton).
const textOf = (g: ScoringGarment) => `${g.name} ${g.slug ?? ''}`.toLowerCase();

function isRainSensitive(g: ScoringGarment): boolean {
  const name = textOf(g);
  if (g.materials.some((m) => m === 'suede' || m === 'linen' || m === 'seersucker')) return true;
  if (/suede|linen|canvas|espadrille/.test(name)) return true;
  return g.slot === 'footwear' && /sneaker/.test(name) && /white/.test(`${name} ${g.colors[0]?.name ?? ''}`.toLowerCase());
}

function isHeavy(g: ScoringGarment): boolean {
  return g.materials.some((m) => HEAVY_MATERIALS.has(m)) || /overcoat|peacoat|wool|flannel|velvet|corduroy|fleece/.test(textOf(g));
}

const verdictValue = (v: ColorVerdict) => (v === 'recommended' ? 1 : v === 'avoid' ? -1 : 0);
/** Mean verdict in [-1, 1] -> 0-10 (a fully neutral outfit scores 6). */
const verdictTo10 = (m: number) => (m >= 0 ? 6 + 4 * m : 6 + 6 * m);

// ---------------------------------------------------------------------------
// scoreOutfit
// ---------------------------------------------------------------------------

export function scoreOutfit(
  garments: ScoringGarment[],
  ctx: ScoringContext,
  lookups: RuleLookups,
  options: ScoreOptions = {}
): OutfitScore {
  const issues: { severity: number; text: string }[] = [];
  // One-line "why" per scored dimension, shown under its bar in the UI.
  const why: Partial<Record<DimensionKey, string>> = {};
  const highlights: string[] = [];
  const add = (severity: number, text: string) => issues.push({ severity, text });

  // Interacting pairs, computed once and shared by color + compatibility.
  const pairs: { a: ScoringGarment; b: ScoringGarment; w: number; color: ReturnType<typeof garmentColorPair> }[] = [];
  for (let i = 0; i < garments.length; i++) {
    for (let j = i + 1; j < garments.length; j++) {
      const w = pairWeight(garments[i], garments[j]);
      if (w > 0) pairs.push({ a: garments[i], b: garments[j], w, color: garmentColorPair(garments[i], garments[j], lookups) });
    }
  }

  // 1. COLOR HARMONY -------------------------------------------------------
  let color10 = 8;
  let worstColorPair: OutfitScore['worstColorPair'] = null;
  const colorPairs = pairs.filter((p) => p.color);
  if (colorPairs.length > 0) {
    const wSum = colorPairs.reduce((s, p) => s + p.w, 0);
    const avg = colorPairs.reduce((s, p) => s + p.color!.score * p.w, 0) / wSum;
    // Only pairs that visibly sit together (weight >= 0.5) can be "the worst".
    const meaningful = colorPairs.filter((p) => p.w >= 0.5);
    const worst = (meaningful.length ? meaningful : colorPairs).reduce((m, p) => (p.color!.worst.pairScore < m.color!.worst.pairScore ? p : m));
    const worstScore = worst.color!.worst.pairScore;
    color10 = (1 - COLOR_WORST_PAIR_SHARE) * avg + COLOR_WORST_PAIR_SHARE * Math.min(avg, worstScore);
    worstColorPair = {
      a: worst.color!.worst.a,
      b: worst.color!.worst.b,
      harmony: worst.color!.worst.harmony,
      reason: worst.color!.worst.reason,
      pairScore: worstScore,
    };
    if (worst.color!.worst.isClash) {
      add(3, `Color clash — ${worst.a.name} and ${worst.b.name}: ${worst.color!.worst.reason}`);
    } else if (avg >= 9) {
      highlights.push('The colors work together cleanly.');
    }
  }

  const chromaticFamilies = new Set(
    garments
      .filter((g) => g.slot !== 'accessory' || g.typeSlug === 'tie')
      .map((g) => g.colors[0])
      .filter((c): c is ColorInput => !!c && !actsAsNeutral(c))
      .map((c) => (c.family || c.name).trim().toLowerCase())
  );
  if (chromaticFamilies.size >= 3) {
    color10 -= THREE_COLOR_PENALTY;
    add(
      2,
      `Too many colors: ${chromaticFamilies.size} different color families (${[...chromaticFamilies].join(', ')}). Keep it to two colors and let neutrals do the rest.`
    );
  }
  color10 = clamp(color10, 0, 10);

  // 2. GARMENT COMPATIBILITY --------------------------------------------------
  let compat10 = 7;
  let curatedPairs = 0;
  let totalPairs = 0;
  if (pairs.length > 0) {
    const ratings = pairs.map((p) => ({ ...pairCompatibility(p.a, p.b, lookups, p.color?.score ?? null), p }));
    const wSum = ratings.reduce((s, r) => s + r.p.w, 0);
    const avg = ratings.reduce((s, r) => s + r.rating * r.p.w, 0) / wSum;
    const min = Math.min(...ratings.map((r) => r.rating));
    compat10 = clamp(((0.75 * avg + 0.25 * min) / 5) * 10, 0, 10);

    for (const r of ratings) {
      if (r.leatherClash) {
        add(
          4,
          `Leather mismatch: ${r.p.a.name} with ${r.p.b.name}. Match your belt to your shoes — black with black, brown with brown.`
        );
      } else if (r.curated && r.rating < 3 && r.reason) {
        add(3, `${r.p.a.name} + ${r.p.b.name}: ${r.reason}`);
      } else if (r.curated && r.rating >= 4.5 && r.reason) {
        highlights.push(r.reason);
      }
      const clash = patternClash(r.p.a, r.p.b);
      if (clash === 'bold') add(2, `${r.p.a.name} and ${r.p.b.name} are both bold patterns — pair a pattern with a solid or a much subtler pattern.`);
      else if (clash === 'same-scale') add(1, `${r.p.a.name} and ${r.p.b.name} have patterns of the same size, which can look busy — vary the scale.`);
      if (r.fabric) add(r.fabric.kind === 'double-denim' ? 1 : 2, r.fabric.message);
    }
    curatedPairs = ratings.filter((r) => r.curated).length;
    totalPairs = ratings.length;
  }

  const { gate, gap, low, high } = formalityGateFor(garments);
  if (gap >= 3 && low && high) {
    add(4, `${high.name} is much dressier than ${low.name} — swap one of them for something in between.`);
  } else if (gap === 2 && low && high) {
    add(1, `${high.name} is noticeably dressier than ${low.name}.`);
  }

  // 3. OCCASION MATCH --------------------------------------------------------
  let occasion10: number | null = null;
  if (ctx.occasion) {
    const occ = ctx.occasion;
    const values = garments.map((g) => {
      // Missing curated row -> derive from formality instead of ignoring the piece.
      const v = g.occasionSuitability[occ.id] ?? occasionSuitability(g.formality, occ.formalityLevel);
      if (v <= 2) {
        add(3, `${g.name} is too ${g.formality < occ.formalityLevel ? 'casual' : 'formal'} for ${occ.name}.`);
      }
      return { v, w: pieceWeight(g) };
    });
    occasion10 = suitabilityTo10(values);
    const misfits = values.filter((x) => x.v <= 2).length;
    why.occasionMatch = misfits
      ? `${misfits} piece${misfits > 1 ? 's' : ''} ${misfits > 1 ? "don't" : "doesn't"} suit ${occ.name}.`
      : `Every piece suits ${occ.name}.`;
  }

  // 4. SEASON / WEATHER ------------------------------------------------------
  let season10: number | null = null;
  if (ctx.season || ctx.weather) {
    const weather = ctx.weather;
    const values = garments.map((g) => {
      let v = ctx.season ? g.seasonSuitability[ctx.season.id] ?? 3 : 3.5;
      if (ctx.season && v <= 2) add(2, `${g.name} isn't a great choice for ${ctx.season.name}.`);
      if (weather?.isRainy && isRainSensitive(g)) {
        v -= WEATHER_RULES.rainPenalty;
        add(2, `It's rainy — ${g.name} won't handle the wet well.`);
      }
      if (weather && weather.tempC >= WEATHER_RULES.hotTempC && isHeavy(g)) {
        v -= WEATHER_RULES.hotHeavyPenalty;
        add(2, `It's ${Math.round(weather.tempC)}°C — ${g.name} will be too warm.`);
      }
      return { v: clamp(v, 1, 5), w: pieceWeight(g) };
    });
    season10 = suitabilityTo10(values);
    why.seasonSuitability = [
      ctx.season ? `Judged for ${ctx.season.name}` : null,
      weather ? `${Math.round(weather.tempC)}°C${weather.isRainy ? ', rain' : ''}` : null,
    ]
      .filter(Boolean)
      .join(' · ');
    const hasLayer = garments.some((g) => g.slot === 'layer');
    if (weather && weather.tempC < WEATHER_RULES.coldNoLayerTempC && !hasLayer && garments.some((g) => g.slot === 'top')) {
      season10 = clamp(season10 - 1.5, 0, 10);
      add(2, `It's ${Math.round(weather.tempC)}°C — add a jacket, sweater or other layer.`);
    }
  }

  // 5. SKIN TONE -------------------------------------------------------------
  let skin10: number | null = null;
  const advice = ctx.personalization?.colorAdvice;
  if (advice) {
    let sum = 0;
    let wSum = 0;
    const avoided: string[] = [];
    for (const g of garments) {
      const slotW = g.typeSlug === 'tie' ? SKIN_TONE_SLOT_WEIGHT.tie : SKIN_TONE_SLOT_WEIGHT[g.slot] ?? 0;
      if (slotW === 0) continue;
      g.colors.forEach((c, i) => {
        const w = slotW * (i === 0 ? 1 : 0.5);
        const verdict = judgeColorForProfile(c, advice);
        sum += verdictValue(verdict) * w;
        wSum += w;
        if (verdict === 'avoid' && slotW >= 0.8) avoided.push(`${c.name} (${g.name})`);
      });
    }
    if (wSum > 0) {
      skin10 = clamp(verdictTo10(sum / wSum), 0, 10);
      why.skinToneSuitability = avoided.length
        ? `${avoided.length} color${avoided.length > 1 ? 's' : ''} near your face ${avoided.length > 1 ? "aren't" : "isn't"} ideal for your undertone.`
        : sum / wSum > 0.4
          ? 'Colors near your face suit your undertone.'
          : 'Neutral colors near your face — neither helps nor hurts.';
      if (avoided.length) {
        add(2, `Near your face, ${avoided.join(', ')} isn't ideal for your coloring — try ${advice.recommendedClothingColors}.`);
      } else if (sum / wSum > 0.4) {
        highlights.push('These colors suit your coloring.');
      }
    }
  }

  // 6. BODY TYPE -------------------------------------------------------------
  let body10: number | null = null;
  const bodyProportion = ctx.personalization?.bodyProportion;
  if (bodyProportion) {
    let sum = 0;
    let n = 0;
    const avoidedFits: string[] = [];
    const top = garments.find((g) => g.slot === 'top');
    const topIsBright = !!top?.colors[0] && !actsAsNeutral(top.colors[0]) && hexToHSL(top.colors[0].hex).s >= 50;
    for (const g of garments) {
      if (g.slot !== 'top' && g.slot !== 'bottom' && g.slot !== 'layer') continue;
      if (g.fits[0]) {
        const v = judgeFitForBody(g.fits[0], g.slot, bodyProportion);
        sum += verdictValue(v);
        n++;
        if (v === 'avoid') avoidedFits.push(`${g.fits[0]} (${g.name})`);
      }
      const recPatterns = ctx.personalization?.recommendedPatterns;
      if (recPatterns && g.patterns[0]) {
        const v = judgePatternForBody(g.patterns[0], g.slot, recPatterns, topIsBright);
        if (v !== 'neutral') {
          sum += verdictValue(v) * 0.5;
          n += 0.5;
        }
      }
    }
    if (n > 0) {
      body10 = clamp(verdictTo10(sum / n), 0, 10);
      why.bodyTypeSuitability = avoidedFits.length
        ? `${avoidedFits.length} fit${avoidedFits.length > 1 ? 's are' : ' is'} less flattering for a ${bodyProportion.toLowerCase()} build.`
        : `Fits and patterns work for a ${bodyProportion.toLowerCase()} build.`;
      if (avoidedFits.length) add(2, `For a ${bodyProportion.toLowerCase()} build, ${avoidedFits.join(', ')} is less flattering.`);
    }
  }

  // MISSING PIECES (builder only) ---------------------------------------------
  if (options.suggestMissingPieces) {
    const bottom = garments.find((g) => g.slot === 'bottom');
    const top = garments.find((g) => g.slot === 'top');
    if (!garments.some((g) => g.slot === 'footwear')) add(1, 'Add shoes to get a complete outfit score.');
    const wantsBelt = bottom && bottom.formality >= 3 && (top?.typeSlug === 'shirt' || (ctx.occasion?.formalityLevel ?? 0) >= 3);
    if (wantsBelt && !garments.some((g) => g.typeSlug === 'belt')) add(1, 'A belt matched to your shoes would finish this look.');
  }

  if (worstColorPair) {
    why.colorHarmony =
      worstColorPair.pairScore < 6
        ? `Weakest pairing: ${worstColorPair.a} + ${worstColorPair.b} (${worstColorPair.harmony}).`
        : `Even the weakest pairing (${worstColorPair.a} + ${worstColorPair.b}) works: ${worstColorPair.harmony}.`;
  }
  if (totalPairs > 0) {
    why.garmentCompatibility =
      curatedPairs > 0
        ? `${curatedPairs} of ${totalPairs} pairings rated by our stylists; the rest judged on formality, pattern, fabric and color.`
        : 'Judged on formality, pattern, fabric and color between the pieces.';
  }

  // TOTAL ---------------------------------------------------------------------
  const raw: Record<DimensionKey, number | null> = {
    colorHarmony: color10,
    garmentCompatibility: compat10,
    occasionMatch: occasion10,
    seasonSuitability: season10,
    bodyTypeSuitability: body10,
    skinToneSuitability: skin10,
  };
  const notes: Partial<Record<DimensionKey, string>> = {
    occasionMatch: 'Pick an occasion to include this.',
    seasonSuitability: 'Pick a season (or share your location) to include this.',
    bodyTypeSuitability: 'Add your body shape in the Style Advisor to include this.',
    skinToneSuitability: 'Add your skin undertone in the Style Advisor to include this.',
  };

  let weighted = 0;
  let weightSum = 0;
  const dimensions = {} as Record<DimensionKey, DimensionResult>;
  const breakdown = {} as Record<DimensionKey, number>;
  for (const key of Object.keys(DIMENSION_WEIGHTS) as DimensionKey[]) {
    const max = DIMENSION_WEIGHTS[key];
    const v = raw[key];
    if (v === null) {
      dimensions[key] = { score: 0, max, applied: false, note: notes[key] };
      breakdown[key] = 0;
      continue;
    }
    weighted += (v / 10) * max;
    weightSum += max;
    const points = round1((v / 10) * max);
    dimensions[key] = { score: points, max, applied: true, note: why[key] };
    breakdown[key] = points;
  }

  const totalScore = Math.round(clamp((weighted / weightSum) * 100 * gate, 0, 100));
  const suggestions = [...new Map(issues.sort((x, y) => y.severity - x.severity).map((i) => [i.text, i.text])).values()];

  return {
    totalScore,
    rating: ratingFromScore(totalScore),
    breakdown,
    dimensions,
    suggestions,
    highlights: [...new Set(highlights)].slice(0, 3),
    formalityGate: gate,
    worstColorPair,
  };
}
