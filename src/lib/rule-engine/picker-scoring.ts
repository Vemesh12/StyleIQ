import { prisma } from '@/lib/prisma';
import { evaluateColorPairHarmony } from './color-rules';
import { scoreColorsAgainstPersonalization, getPersonalizationRuleForSkinTone } from './personalization';
import { ratingFromScore, type OutfitRating } from './rating';
import type { Prisma } from '@prisma/client';

export { ratingFromScore };

export interface ColorLike {
  name: string;
  hex: string;
  slug?: string;
  isNeutral?: boolean;
  family?: string;
}

export type CandidateGarment = Prisma.GarmentGetPayload<{
  include: {
    garmentType: true;
    colors: { include: { color: true } };
    patterns: { include: { pattern: true } };
    occasions: true;
    seasons: true;
  };
}>;

export interface CandidateScore {
  total: number; // 0-100, can genuinely be low
  rating: OutfitRating;
  breakdown: {
    colorHarmony: number; // 0-35
    patternBalance: number; // 0-15
    formalityMatch: number; // 0-20
    occasionMatch: number; // 0-10
    seasonMatch: number; // 0-10
    personalization: number; // 0-10
  };
  colorHarmonyDetail: { harmony: string; reason: string } | null;
  warnings: string[];
}

export interface ColorRuleLookup {
  get(slugA: string, slugB: string): { score: number; harmony: string; reason: string } | undefined;
}

/**
 * Builds an in-memory lookup from a batch-fetched set of ColorCompatibilityRule
 * rows, so scoring N candidates doesn't require N separate DB round-trips.
 */
export function buildColorRuleLookup(
  rules: { colorA: { slug: string }; colorB: { slug: string }; score: number; harmony: string; reason: string }[]
): ColorRuleLookup {
  const map = new Map<string, { score: number; harmony: string; reason: string }>();
  for (const r of rules) {
    const entry = { score: r.score, harmony: r.harmony, reason: r.reason };
    map.set(`${r.colorA.slug}|${r.colorB.slug}`, entry);
    map.set(`${r.colorB.slug}|${r.colorA.slug}`, entry);
  }
  return { get: (a, b) => map.get(`${a}|${b}`) };
}

/**
 * Cross-product color-harmony score (0-10) between two sets of colors — e.g.
 * a striped shirt's 2 colors against a trouser's 1 color all get compared,
 * not just the two garments' primary shades.
 *
 * Pass a pre-built `lookup` (see buildColorRuleLookup) to avoid a DB query per
 * call when scoring many candidates in a loop; omit it for one-off use.
 */
export async function scoreColorSetHarmony(
  colorsA: ColorLike[],
  colorsB: ColorLike[],
  lookup?: ColorRuleLookup
): Promise<{ avgScore: number; best: { harmony: string; reason: string; pairScore: number } | null }> {
  if (colorsA.length === 0 || colorsB.length === 0) return { avgScore: 8, best: null };

  const idsA = colorsA.map((c) => c.slug).filter(Boolean) as string[];
  const idsB = colorsB.map((c) => c.slug).filter(Boolean) as string[];

  const dbRules =
    !lookup && idsA.length && idsB.length
      ? await prisma.colorCompatibilityRule.findMany({
          where: {
            OR: [
              { colorA: { slug: { in: idsA } }, colorB: { slug: { in: idsB } } },
              { colorA: { slug: { in: idsB } }, colorB: { slug: { in: idsA } } },
            ],
          },
          include: { colorA: true, colorB: true },
        })
      : [];
  const inlineLookup = !lookup ? buildColorRuleLookup(dbRules) : null;

  let total = 0;
  let count = 0;
  let best: { harmony: string; reason: string; pairScore: number } | null = null;

  for (const cA of colorsA) {
    for (const cB of colorsB) {
      const dbRule = cA.slug && cB.slug ? (lookup || inlineLookup)?.get(cA.slug, cB.slug) : undefined;

      const result = dbRule
        ? { pairScore: dbRule.score, harmony: dbRule.harmony, reason: dbRule.reason }
        : evaluateColorPairHarmony(cA, cB);

      total += result.pairScore;
      count++;
      if (!best || result.pairScore > best.pairScore) {
        best = { harmony: result.harmony, reason: result.reason, pairScore: result.pairScore };
      }
    }
  }

  return { avgScore: count > 0 ? total / count : 8, best };
}

function formalityScore(anchorFormality: number, candidateFormality: number): number {
  const diff = Math.abs(anchorFormality - candidateFormality);
  // 0 apart -> 10, 1 apart -> 7.5, 2 apart -> 5, 3+ apart -> increasingly poor
  return Math.max(0, 10 - diff * 2.5);
}

export interface ScoreContext {
  anchorColors: ColorLike[];
  anchorFormality: number;
  anchorIsPatterned: boolean;
  occasionId?: string;
  occasionFormalityLevel?: number;
  seasonId?: string;
  skinTone?: string;
  personalizationRule: Awaited<ReturnType<typeof getPersonalizationRuleForSkinTone>> | null;
  colorRuleLookup?: ColorRuleLookup;
}

/**
 * Scores a real catalog garment against the user's anchor item across every
 * dimension the outfit-builder itself uses (color, pattern, formality,
 * occasion, season, personalization) — instead of the old picker's flat
 * "always 88-99%" heuristic. A genuinely bad match now scores low.
 */
export async function scoreCandidateAgainstAnchor(
  candidate: CandidateGarment,
  ctx: ScoreContext
): Promise<CandidateScore> {
  const warnings: string[] = [];
  const candidateColors: ColorLike[] = candidate.colors.map((gc) => ({
    name: gc.color.name,
    hex: gc.color.hex,
    slug: gc.color.slug,
    isNeutral: gc.color.isNeutral,
    family: gc.color.family,
  }));

  // 1. COLOR HARMONY (0-35)
  const { avgScore, best } = await scoreColorSetHarmony(ctx.anchorColors, candidateColors, ctx.colorRuleLookup);
  const colorHarmony = Math.round(Math.min(35, Math.max(0, (avgScore / 10) * 35)));
  if (best && best.pairScore < 5) {
    warnings.push(`Color clash risk: ${best.reason}`);
  }

  // 2. PATTERN BALANCE (0-15)
  const candidatePatterns = candidate.patterns.map((gp) => gp.pattern);
  const candidateHasBoldPattern = candidatePatterns.some((p) => !p.isFormal || p.name.toLowerCase() !== 'solid');
  let patternBalance = 12; // neutral-good default (most items are solid)
  if (ctx.anchorIsPatterned && candidateHasBoldPattern) {
    patternBalance = 3;
    warnings.push('Two patterned pieces together can clash — pair a pattern with a solid.');
  } else if (ctx.anchorIsPatterned && !candidateHasBoldPattern) {
    patternBalance = 15;
  }

  // 3. FORMALITY MATCH (0-20)
  const formalityRaw = formalityScore(ctx.anchorFormality, candidate.formalityLevel);
  const formalityMatch = Math.round((formalityRaw / 10) * 20);
  if (formalityRaw < 5) {
    const tooDressy = candidate.formalityLevel > ctx.anchorFormality;
    warnings.push(
      tooDressy
        ? 'This is dressier than your item — it may look mismatched together.'
        : 'This is more casual than your item — it may look mismatched together.'
    );
  }

  // 4. OCCASION MATCH (0-10)
  let occasionMatch = 7; // neutral default when no occasion supplied
  if (ctx.occasionId) {
    const occ = candidate.occasions.find((o) => o.occasionId === ctx.occasionId);
    if (occ) {
      occasionMatch = Math.round((occ.suitability / 5) * 10);
      if (occ.suitability <= 2) warnings.push('Not a great fit for the selected occasion.');
    }
  }

  // 5. SEASON MATCH (0-10)
  let seasonMatch = 7; // neutral default when no season supplied
  if (ctx.seasonId) {
    const season = candidate.seasons.find((s) => s.seasonId === ctx.seasonId);
    if (season) {
      seasonMatch = Math.round((season.suitability / 5) * 10);
      if (season.suitability <= 2) warnings.push('Not ideal for the selected season.');
    }
  }

  // 6. PERSONALIZATION / SKIN TONE (0-10)
  let personalization = 7;
  if (ctx.personalizationRule) {
    const { score, matchedAvoid } = scoreColorsAgainstPersonalization(
      candidateColors.map((c) => ({ name: c.name, family: c.family })),
      ctx.personalizationRule
    );
    personalization = score;
    if (matchedAvoid.length > 0) {
      warnings.push(`${matchedAvoid.join(', ')} may not suit your skin tone.`);
    }
  }

  // GATING — a genuinely bad formality/occasion fit shouldn't be masked by an
  // otherwise-good color score. Severe mismatches multiplicatively cap the
  // total instead of only losing a few additive points.
  let gate = 1;
  const candidateFormalityGap = Math.abs(ctx.anchorFormality - candidate.formalityLevel);
  if (candidateFormalityGap >= 3) gate *= 0.6;
  else if (candidateFormalityGap === 2) gate *= 0.85;

  if (ctx.occasionFormalityLevel !== undefined) {
    const anchorOccasionGap = Math.abs(ctx.anchorFormality - ctx.occasionFormalityLevel);
    if (anchorOccasionGap >= 3) {
      gate *= 0.6;
      warnings.push('Your selected item itself may be too casual or too formal for this occasion.');
    } else if (anchorOccasionGap === 2) {
      gate *= 0.85;
    }
  }

  const rawTotal =
    colorHarmony + patternBalance + formalityMatch + occasionMatch + seasonMatch + personalization;
  const total = Math.round(rawTotal * gate);

  return {
    total: Math.min(100, Math.max(0, total)),
    rating: ratingFromScore(total),
    breakdown: { colorHarmony, patternBalance, formalityMatch, occasionMatch, seasonMatch, personalization },
    colorHarmonyDetail: best ? { harmony: best.harmony, reason: best.reason } : null,
    warnings,
  };
}

// Rough formality estimate from a free-typed item-type label, since the
// picker's anchor item isn't a real catalog row with its own formalityLevel.
export function estimateFormalityFromItemType(itemType: string, category: string): number {
  const t = itemType.toLowerCase();
  if (/(tux|black.?tie|formal)/.test(t)) return 5;
  if (/(dress|oxford|suit|blazer|tie|pocket.?square)/.test(t)) return 4;
  if (/(polo|chino|loafer|cardigan|sweater|cable.?knit)/.test(t)) return 3;
  // Business-adjacent check patterns (windowpane, houndstooth) read as
  // smart-casual/business-casual in practice — matches the real "Windowpane
  // Check Shirt" catalog item, which is tagged formality 3, not casual.
  if (/(windowpane|houndstooth|herringbone|check)/.test(t)) return 3;
  if (/(gingham|tattersall|plaid)/.test(t)) return 2;
  if (/(jeans|denim|sneaker|hoodie|casual)/.test(t)) return 1;
  if (category === 'tie' || category === 'pocket-square') return 4;
  if (category === 'hoodie' || t === 'casual-plain') return 1;
  if (category === 'sweater' || category === 'cardigan') return 3;
  return 2;
}

export function isPatternedItemType(itemType: string): boolean {
  return ['checks', 'check', 'stripe', 'striped', 'printed', 'plaid', 'floral', 'polka'].some((p) =>
    itemType.toLowerCase().includes(p)
  );
}
