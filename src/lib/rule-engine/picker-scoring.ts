import type { ColorInput } from './color-rules';
import { scoreOutfit, type OutfitScore, type RuleLookups, type ScoringContext, type ScoringGarment, type Slot } from './core';
import { EXCLUSIVE_SLOTS, slotForType } from './slots';

// The item picker ("I own this — what goes with it?"). The user's item isn't
// a catalog row, so it becomes a virtual ScoringGarment and is scored by the
// exact same core engine as every other flow.

// Formality (1-5) per picker item type. Keyed `${category}:${itemType}` with
// the itemType ids used by the Style Advisor UI. Replaces the old free-text
// regex, where "tie" matched inside other words and unknowns defaulted to 2.
const ITEM_FORMALITY: Record<string, number> = {
  'shirt:formal-solid': 4,
  'shirt:stripe': 4,
  'shirt:checks': 3,
  'shirt:printed': 2,
  'tshirt:casual-plain': 1,
  'tshirt:stripe': 1,
  'tshirt:printed': 1,
  'polo:formal-solid': 3,
  'polo:stripe': 2,
  'trouser:formal-trousers': 4,
  'trouser:chinos': 3,
  'trouser:denim-jeans': 2,
  'trouser:linen-trousers': 2,
  'shoe:oxfords': 5,
  'shoe:loafers': 3,
  'shoe:chelsea': 3,
  'shoe:sneakers': 1,
  'belt:formal-leather': 4,
  'belt:casual-suede': 3,
  'belt:woven': 2,
  'jacket:suit-jacket': 5,
  'jacket:blazer': 4,
  'jacket:casual-jacket': 2,
  'sweater:formal-solid': 3,
  'sweater:cable-knit': 2,
  'cardigan:formal-solid': 3,
  'hoodie:casual': 1,
  'knitwear:formal-solid': 3,
  'knitwear:cable-knit': 2,
  'tie:formal-solid': 4,
  'tie:stripe': 4,
  'pocket-square:formal-solid': 4,
  'pocket-square:printed': 4,
  'watch:formal-solid': 4,
  'watch:casual': 2,
  'accessory:formal-solid': 3,
  'accessory:casual': 2,
};

const CATEGORY_DEFAULT_FORMALITY: Record<string, number> = {
  shirt: 3, tshirt: 1, polo: 3, trouser: 3, shoe: 3, belt: 3, jacket: 4, sweater: 3,
  cardigan: 3, hoodie: 1, knitwear: 3, tie: 4, 'pocket-square': 4, watch: 3, accessory: 2,
};

export function estimateAnchorFormality(itemType: string, category: string): number {
  const exact = ITEM_FORMALITY[`${category}:${itemType}`];
  if (exact) return exact;
  // Free-text fallback for API callers: whole words only.
  const t = ` ${itemType.toLowerCase().replace(/[^a-z]+/g, ' ')} `;
  if (/ (tux|tuxedo|black tie|suit) /.test(t)) return 5;
  if (/ (dress|oxford|oxfords|formal|blazer) /.test(t)) return 4;
  if (/ (jeans|denim|sneaker|sneakers|hoodie|graphic) /.test(t)) return 1;
  return CATEGORY_DEFAULT_FORMALITY[category] ?? 3;
}

function anchorPattern(itemType: string): string {
  if (itemType === 'checks' || itemType === 'check') return 'check';
  if (itemType === 'stripe' || itemType === 'striped') return 'striped';
  if (itemType === 'printed') return 'floral';
  if (itemType === 'cable-knit') return 'cable-knit';
  return 'solid';
}

function anchorMaterials(itemType: string): string[] {
  const map: Record<string, string> = {
    'denim-jeans': 'denim',
    'linen-trousers': 'linen',
    chinos: 'chino-twill',
    'formal-leather': 'leather',
    'casual-suede': 'suede',
    oxfords: 'leather',
    'cable-knit': 'wool',
  };
  return map[itemType] ? [map[itemType]] : [];
}

const ITEM_LABELS: Record<string, string> = {
  'formal-solid': 'plain', checks: 'check', stripe: 'striped', printed: 'printed', 'casual-plain': 'plain',
  chinos: 'chinos', 'formal-trousers': 'formal trousers', 'denim-jeans': 'jeans', 'linen-trousers': 'linen trousers',
  oxfords: 'oxfords', loafers: 'loafers', chelsea: 'boots', sneakers: 'sneakers', 'formal-leather': 'leather belt',
  'casual-suede': 'suede belt', woven: 'woven belt', blazer: 'blazer', 'suit-jacket': 'suit jacket',
  'casual-jacket': 'jacket', 'cable-knit': 'cable knit', casual: 'casual',
};

export function buildAnchorGarment(params: { category: string; itemType: string; colors: ColorInput[] }): ScoringGarment {
  const { category, itemType, colors } = params;
  const label = ITEM_LABELS[itemType] ?? itemType.replace(/-/g, ' ');
  const noun = /(shirt|tee|polo|trouser|jeans|chinos|oxfords|loafers|boots|sneakers|belt|blazer|jacket|tie|sweater|cardigan|hoodie|watch)/.test(label)
    ? ''
    : ` ${category.replace('-', ' ').replace('tshirt', 't-shirt')}`;
  return {
    id: 'anchor',
    name: `your ${colors[0]?.name.toLowerCase() ?? ''} ${label}${noun}`.replace(/\s+/g, ' ').trim(),
    typeSlug: category,
    slot: slotForType(category),
    formality: estimateAnchorFormality(itemType, category),
    colors,
    patterns: [anchorPattern(itemType)],
    materials: anchorMaterials(itemType),
    fits: [],
    // No curated rows for a virtual item: occasion suitability is derived from
    // its formality and season counts as neutral, same as any catalog gap.
    occasionSuitability: {},
    seasonSuitability: {},
  };
}

export interface ScoredCandidate {
  garment: ScoringGarment;
  score: OutfitScore;
}

/** Every catalog piece scored as a pairing with the anchor. */
export function scoreCandidates(
  anchor: ScoringGarment,
  catalog: ScoringGarment[],
  ctx: ScoringContext,
  lookups: RuleLookups
): ScoredCandidate[] {
  return catalog
    .filter((g) => g.typeSlug !== anchor.typeSlug)
    .filter((g) => !(EXCLUSIVE_SLOTS.has(anchor.slot) && g.slot === anchor.slot))
    .map((garment) => ({ garment, score: scoreOutfit([anchor, garment], ctx, lookups) }))
    .sort((a, b) => b.score.totalScore - a.score.totalScore);
}

export function wantsLayer(ctx: ScoringContext): boolean {
  if ((ctx.occasion?.formalityLevel ?? 0) >= 4) return true;
  if (ctx.season && ['winter', 'autumn'].includes(ctx.season.slug)) return true;
  if (ctx.weather && (ctx.weather.tempC < 16 || ctx.weather.isRainy)) return true;
  return false;
}

type PlanStep = { slot: Slot; typeSlug?: string };

export interface OutfitSet {
  pieces: ScoringGarment[];
  score: OutfitScore;
}

/**
 * Builds complete outfits around the anchor. Each next piece is chosen by
 * scoring the WHOLE outfit so far (not just its pairing with the anchor), so
 * the suggested top and trousers also have to work with each other. Pieces
 * used in an earlier set are penalised so the alternatives are genuinely
 * different. Layer, belt and tie are only added where they make sense.
 */
export function buildOutfitSets(
  anchor: ScoringGarment,
  catalog: ScoringGarment[],
  ctx: ScoringContext,
  lookups: RuleLookups,
  numSets = 3
): OutfitSet[] {
  const coreSteps: PlanStep[] = (['bottom', 'top', 'footwear'] as Slot[])
    .filter((s) => !(EXCLUSIVE_SLOTS.has(anchor.slot) && s === anchor.slot))
    .map((slot) => ({ slot }));

  const used = new Map<string, number>();
  const sets: OutfitSet[] = [];
  const seen = new Set<string>();

  for (let i = 0; i < numSets; i++) {
    const pieces: ScoringGarment[] = [anchor];
    const pick = (step: PlanStep, mustImprove = false) => {
      const options = catalog.filter(
        (g) => g.slot === step.slot && (!step.typeSlug || g.typeSlug === step.typeSlug) && g.typeSlug !== anchor.typeSlug
      );
      if (options.length === 0) return;
      const before = mustImprove ? scoreOutfit(pieces, ctx, lookups).totalScore : -Infinity;
      let best: { g: ScoringGarment; value: number; raw: number } | null = null;
      for (const g of options) {
        const raw = scoreOutfit([...pieces, g], ctx, lookups).totalScore;
        const value = raw - 8 * (used.get(g.id) ?? 0);
        if (!best || value > best.value) best = { g, value, raw };
      }
      if (best && best.raw >= before) pieces.push(best.g);
    };

    for (const step of coreSteps) pick(step);

    if (anchor.slot !== 'layer' && wantsLayer(ctx)) pick({ slot: 'layer' });

    const bottom = pieces.find((g) => g.slot === 'bottom');
    const top = pieces.find((g) => g.slot === 'top');
    const occasionFormality = ctx.occasion?.formalityLevel ?? 0;
    if (anchor.typeSlug !== 'belt' && bottom && bottom.formality >= 3 && (top?.typeSlug === 'shirt' || occasionFormality >= 3)) {
      pick({ slot: 'accessory', typeSlug: 'belt' });
    }
    if (anchor.typeSlug !== 'tie' && top?.typeSlug === 'shirt' && occasionFormality >= 4) {
      pick({ slot: 'accessory', typeSlug: 'tie' }, true);
    }

    const key = pieces.map((g) => g.id).sort().join('|');
    if (pieces.length > 1 && !seen.has(key)) {
      seen.add(key);
      sets.push({ pieces, score: scoreOutfit(pieces, ctx, lookups) });
    }
    for (const g of pieces) if (g !== anchor) used.set(g.id, (used.get(g.id) ?? 0) + 1);
  }

  return sets;
}
