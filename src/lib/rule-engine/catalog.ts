import type { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { cached, invalidateCache } from '@/lib/ttl-cache';
import { buildColorRuleLookup } from './color-rules';
import type { PersonalizationContext, RuleLookups, ScoringGarment } from './core';
import type { PersonalizationRule } from '@prisma/client';
import type { StyleProfile } from './personalization';
import { slotForType } from './slots';

// Loads catalog data into the plain shapes core.ts scores. Everything the
// engine needs is small (a few hundred garments, a few dozen curated rules),
// so it's loaded once and shared across requests, and dropped whenever an
// admin edits garments or rules.

const CACHE_TTL_MS = 5 * 60 * 1000;
export const ENGINE_CACHE_PREFIX = 'engine:';

export function invalidateEngineCache() {
  invalidateCache(ENGINE_CACHE_PREFIX, 'quick-pick:');
}

const garmentInclude = {
  garmentType: true,
  colors: { include: { color: true } },
  patterns: { include: { pattern: true } },
  materials: { include: { material: true } },
  fits: { include: { fit: true } },
  occasions: true,
  seasons: true,
} satisfies Prisma.GarmentInclude;

type GarmentRow = Prisma.GarmentGetPayload<{ include: typeof garmentInclude }>;

function toScoringGarment(g: GarmentRow): ScoringGarment {
  const primaryFirst = <T extends { isPrimary: boolean }>(rows: T[]) => [...rows].sort((a, b) => Number(b.isPrimary) - Number(a.isPrimary));
  return {
    id: g.id,
    name: g.name,
    slug: g.slug,
    description: g.description,
    typeSlug: g.garmentType.slug,
    typeName: g.garmentType.name,
    slot: slotForType(g.garmentType.slug),
    formality: g.formalityLevel,
    colors: primaryFirst(g.colors).map((gc) => ({
      name: gc.color.name,
      hex: gc.color.hex,
      slug: gc.color.slug,
      family: gc.color.family,
      isNeutral: gc.color.isNeutral,
    })),
    patterns: primaryFirst(g.patterns).map((p) => p.pattern.slug),
    materials: [...g.materials].sort((a, b) => b.percentage - a.percentage).map((m) => m.material.slug),
    fits: primaryFirst(g.fits).map((f) => f.fit.name),
    occasionSuitability: Object.fromEntries(g.occasions.map((o) => [o.occasionId, o.suitability])),
    seasonSuitability: Object.fromEntries(g.seasons.map((s) => [s.seasonId, s.suitability])),
  };
}

export function loadCatalog(): Promise<ScoringGarment[]> {
  return cached(`${ENGINE_CACHE_PREFIX}catalog`, CACHE_TTL_MS, async () => {
    const rows = await prisma.garment.findMany({ where: { ownerId: null }, include: garmentInclude, orderBy: { name: 'asc' } });
    return rows.map(toScoringGarment);
  });
}

/** A user's own items (not cached: they change whenever the user edits them). */
export async function loadUserGarments(userId: string): Promise<ScoringGarment[]> {
  const rows = await prisma.garment.findMany({ where: { ownerId: userId }, include: garmentInclude, orderBy: { name: 'asc' } });
  return rows.map(toScoringGarment);
}

/**
 * Garments for the given ids, in the given order (unknown ids are dropped).
 * Catalog items always resolve; a user's own items only for that user.
 */
export async function loadGarments(ids: string[], userId?: string | null): Promise<ScoringGarment[]> {
  const byId = new Map((await loadCatalog()).map((g) => [g.id, g]));
  if (userId && ids.some((id) => !byId.has(id))) {
    for (const g of await loadUserGarments(userId)) byId.set(g.id, g);
  }
  return ids.map((id) => byId.get(id)).filter((g): g is ScoringGarment => !!g);
}

export function loadRuleLookups(): Promise<RuleLookups> {
  return cached(`${ENGINE_CACHE_PREFIX}lookups`, CACHE_TTL_MS, async () => {
    const [colorRules, garmentRules] = await Promise.all([
      prisma.colorCompatibilityRule.findMany({ include: { colorA: true, colorB: true } }),
      prisma.compatibilityRule.findMany(),
    ]);

    // The unique key on CompatibilityRule is directional, so A->B and B->A can
    // both exist. Merge them (average rating) instead of picking one at random.
    // The reason shown is the one from the lower-rated direction (the warning).
    const merged = new Map<string, { total: number; count: number; minRating: number; reason: string }>();
    for (const r of garmentRules) {
      const key = [r.garmentAId, r.garmentBId].sort().join('|');
      const entry = merged.get(key) ?? { total: 0, count: 0, minRating: Infinity, reason: '' };
      entry.total += r.rating;
      entry.count += 1;
      if (r.rating < entry.minRating) {
        entry.minRating = r.rating;
        entry.reason = r.reason;
      }
      merged.set(key, entry);
    }

    return {
      colors: buildColorRuleLookup(colorRules),
      garmentRule(aId: string, bId: string) {
        const e = merged.get([aId, bId].sort().join('|'));
        return e ? { rating: e.total / e.count, reason: e.reason } : undefined;
      },
    };
  });
}

// Occasions and seasons are a handful of rows that almost never change, but
// nearly every scoring request needs one — serve them from the shared cache.
const loadOccasions = () => cached(`${ENGINE_CACHE_PREFIX}occasions`, CACHE_TTL_MS, () => prisma.occasion.findMany());
const loadSeasons = () => cached(`${ENGINE_CACHE_PREFIX}seasons`, CACHE_TTL_MS, () => prisma.season.findMany());

export async function resolveOccasion(by: { id?: string; slug?: string }) {
  if (!by.id && !by.slug) return null;
  return (await loadOccasions()).find((o) => (by.id ? o.id === by.id : o.slug === by.slug)) ?? null;
}

export async function resolveSeason(by: { id?: string; slug?: string }) {
  if (!by.id && !by.slug) return null;
  return (await loadSeasons()).find((s) => (by.id ? s.id === by.id : s.slug === by.slug)) ?? null;
}

const PROFILE_FIELDS = ['hairColor', 'eyeColor', 'skinTone', 'underTone', 'torsoLength', 'bodyProportion'] as const;
type ProfileField = (typeof PROFILE_FIELDS)[number];

// When no row matches every field given, fields are dropped in this order
// (least influential first). In the dataset, clothing-color advice depends on
// undertone and fit/pattern advice on body proportion, so those two are kept
// the longest.
const RELAXATION_ORDER: ProfileField[] = ['eyeColor', 'hairColor', 'torsoLength', 'skinTone', 'bodyProportion', 'underTone'];

export interface PersonalizationMatch {
  rule: PersonalizationRule;
  matchedOn: ProfileField[];
  ignored: ProfileField[];
}

/**
 * Finds the closest personalization row for a profile: exact match on every
 * supplied field first, then progressively relaxes the least important
 * fields. All comparisons are case-insensitive. Returns which fields the
 * chosen row actually matched, so callers only apply advice that is really
 * about this person (e.g. color advice only when the undertone matched).
 */
export async function findPersonalizationRule(profile: StyleProfile): Promise<PersonalizationMatch | null> {
  let active = PROFILE_FIELDS.filter((f) => profile[f]?.trim());
  if (active.length === 0) return null;
  const supplied = [...active];

  for (;;) {
    const where = Object.fromEntries(
      active.map((f) => [f, { equals: profile[f]!.trim(), mode: 'insensitive' as const }])
    );
    const rule = await prisma.personalizationRule.findFirst({ where, orderBy: [{ createdAt: 'asc' }, { id: 'asc' }] });
    if (rule) {
      return { rule, matchedOn: active, ignored: supplied.filter((f) => !active.includes(f)) };
    }
    const drop = RELAXATION_ORDER.find((f) => active.includes(f));
    if (!drop || active.length === 1) return null;
    active = active.filter((f) => f !== drop);
  }
}

export interface ResolvedPersonalization {
  context: PersonalizationContext | null;
  matchedOn: string[];
  ignored: string[];
}

/**
 * Turns a style profile into scoring context. Color advice is only used when
 * the matched dataset row has the person's undertone (the dataset's color
 * advice is undertone-specific); a skin tone alone doesn't determine it.
 */
export async function resolvePersonalization(profile: StyleProfile | undefined): Promise<ResolvedPersonalization> {
  if (!profile) return { context: null, matchedOn: [], ignored: [] };
  const bodyProportion = profile.bodyProportion?.trim() || undefined;
  // The lookup can take several relaxation queries; profiles repeat across
  // requests and the dataset is static, so cache by normalized profile.
  const key = JSON.stringify(Object.entries(profile).filter(([, v]) => v).map(([k, v]) => [k, String(v).trim().toLowerCase()]).sort());
  const match = await cached(`${ENGINE_CACHE_PREFIX}profile:${key}`, CACHE_TTL_MS, () => findPersonalizationRule(profile));

  const context: PersonalizationContext = { bodyProportion };
  if (match?.matchedOn.includes('underTone')) {
    context.colorAdvice = {
      recommendedClothingColors: match.rule.recommendedClothingColors,
      avoidClothingColors: match.rule.avoidClothingColors,
    };
  }
  if (match?.matchedOn.includes('bodyProportion')) {
    context.recommendedPatterns = match.rule.recommendedPatterns;
  }

  const hasAnything = !!(context.colorAdvice || context.bodyProportion);
  return {
    context: hasAnything ? context : null,
    matchedOn: match?.matchedOn ?? [],
    ignored: match?.ignored ?? [],
  };
}
