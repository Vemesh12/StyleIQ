// Single source of truth for every tunable number in the scoring engine.
// The outfit builder, item picker, quick pick and daily suggestion all score
// through src/lib/rule-engine/core.ts, which reads only from here — so the
// same outfit gets the same score no matter which flow produced it.

// Share of the final 0-100 score per dimension. Dimensions that don't apply
// to a request (no occasion picked, no profile given) are dropped and the
// remaining weights are rescaled, instead of being filled with a fake
// "neutral" value that silently caps the achievable score.
export const DIMENSION_WEIGHTS = {
  colorHarmony: 30,
  garmentCompatibility: 25,
  occasionMatch: 15,
  seasonSuitability: 10,
  bodyTypeSuitability: 10,
  skinToneSuitability: 10,
} as const;

export type DimensionKey = keyof typeof DIMENSION_WEIGHTS;

// Multiplier applied to the whole score when pieces are far apart in
// formality (1-5 scale). Additive points alone can't express "no amount of
// color harmony makes a tuxedo jacket work with gym sneakers".
// A 2-step gap (oxford-cloth shirt with dress shoes) is normal in real
// outfits, so it only nudges; 3+ steps is a genuine mismatch.
export const FORMALITY_GATE: { minGap: number; multiplier: number }[] = [
  { minGap: 4, multiplier: 0.6 },
  { minGap: 3, multiplier: 0.75 },
  { minGap: 2, multiplier: 0.95 },
];

export const RATING_THRESHOLDS = { excellent: 85, good: 70, risky: 50 } as const;

// How much a pair of pieces matters to the overall look — used for both the
// color and the garment-compatibility dimensions. Pairs that sit next to each
// other and cover large areas dominate. Keys are alphabetically sorted slots.
export const SLOT_PAIR_WEIGHTS: Record<string, number> = {
  'bottom|top': 1.0,
  'layer|top': 1.0,
  'bottom|layer': 0.8,
  'bottom|footwear': 0.8,
  'footwear|top': 0.4,
  'footwear|layer': 0.4,
};

// Accessories only interact with the pieces they physically sit against;
// e.g. a belt is judged against the shoes and trousers, not the jacket.
export const ACCESSORY_PAIR_WEIGHTS: Record<string, Record<string, number>> = {
  belt: { footwear: 1.0, bottom: 0.6 },
  tie: { top: 1.0, layer: 0.6 },
  'pocket-square': { layer: 1.0, tie: 0.6 },
};

// Outfit color score = blend of the weighted average pair and the single
// worst meaningful pair — one bad clash should drag the look down even when
// every other pairing is fine.
export const COLOR_WORST_PAIR_SHARE = 0.35;
// Points (on the 0-10 color scale) removed when 3+ distinct non-neutral
// color families appear in one outfit.
export const THREE_COLOR_PENALTY = 1.5;

// Fallback garment-pair rating (1-5) when no curated CompatibilityRule
// exists. Built from formality distance, pattern clash and color harmony
// instead of a flat constant.
export const COMPAT_FALLBACK = {
  base: 4.4,
  // Penalty by formality gap (index = gap). Small gaps are normal (dress
  // trousers with slightly dressier shoes); big ones are real mismatches.
  formalityGapPenalty: [0, 0.3, 1.0, 2.0, 3.0],
  boldPatternClash: 1.2,
  samePatternScale: 0.4,
  colorInfluence: 0.3, // per point the pair's color score sits above/below 7.5
};

// Pattern "scale" — how loud a pattern reads. Two patterns can share an
// outfit when their scales differ; two bold ones compete.
// 0 = solid/texture-only, 1 = subtle, 2 = medium, 3 = bold.
export const PATTERN_SCALE: Record<string, number> = {
  solid: 0,
  'cable-knit': 0,
  herringbone: 1,
  houndstooth: 1,
  striped: 2,
  gingham: 2,
  check: 2,
  windowpane: 2,
  'polka-dot': 3,
  floral: 3,
};

// Fabric "weight" (1 = summer-light … 4 = winter-heavy). Pieces worn together
// shouldn't be far apart: linen trousers under a corduroy jacket look like
// two different seasons. Unlisted materials (or unknown) are ignored.
export const FABRIC_WEIGHT: Record<string, number> = {
  linen: 1,
  seersucker: 1,
  'jersey-cotton': 2,
  'pique-cotton': 2,
  cotton: 2,
  'chino-twill': 2,
  denim: 2,
  silk: 2,
  wool: 3,
  'merino-wool': 3,
  cashmere: 3,
  leather: 3,
  suede: 3,
  fleece: 3,
  flannel: 4,
  corduroy: 4,
  velvet: 4,
};
// Dressy, lustrous fabrics vs. rugged casual ones — a velvet jacket with
// joggers or a fleece reads as a mistake rather than high-low styling.
export const DRESSY_FABRICS = new Set(['velvet', 'silk']);
export const RUGGED_FABRICS = new Set(['denim', 'fleece', 'jersey-cotton']);
export const FABRIC_RULES = {
  weightGapForClash: 3, // e.g. linen (1) with corduroy/velvet/flannel (4)
  weightClashPenalty: 0.8, // on the 1-5 pair rating
  sheenClashPenalty: 0.8,
  doubleDenimPenalty: 0.6,
};

// Weather adjustments to season suitability (1-5 scale per garment).
export const WEATHER_RULES = {
  rainPenalty: 1.5, // suede, linen, canvas/white sneakers in rain
  coldNoLayerTempC: 14,
  hotTempC: 27,
  hotHeavyPenalty: 1.5, // wool coats, flannel, velvet... in heat
};

// How much each slot's colors matter for skin-tone guidance. Color analysis
// is about what sits next to the face; shoes don't change your complexion.
export const SKIN_TONE_SLOT_WEIGHT: Record<string, number> = {
  top: 1,
  layer: 1,
  tie: 0.8,
  bottom: 0.3,
  footwear: 0,
  accessory: 0,
};
