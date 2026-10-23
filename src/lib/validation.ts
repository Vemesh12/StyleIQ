import { z } from 'zod';

// Upper bounds on every client-supplied string/array, so a single request
// can't force huge DB `IN (...)` lists, brute-force searches, or bcrypt work.
const id = z.string().min(1).max(64);
const slug = z.string().min(1).max(100);

// Emails are stored and looked up lowercased, so "Bob@x.com" and "bob@x.com"
// are the same account.
const email = z.string().trim().toLowerCase().max(254).email('A valid email is required');

// A real calendar date in YYYY-MM-DD form: "2024-02-31" is rejected because
// it doesn't survive a round trip through Date, and so are dates before 2000.
export const MIN_DATE = '2000-01-01';
export function isCalendarDate(s: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const d = new Date(`${s}T00:00:00.000Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
}
const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Use a YYYY-MM-DD date.')
  .refine(isCalendarDate, 'Use a real calendar date.')
  .refine((s) => s >= MIN_DATE, `Dates before ${MIN_DATE} are not supported.`);

const dedupe = (ids: string[]) => Array.from(new Set(ids));

/**
 * A list of ids, de-duplicated BEFORE the min/max checks so ['a', 'a'] counts
 * as one item. The raw list is bounded too (twice the cap) so a huge payload
 * of repeats is still rejected cheaply.
 */
const idList = (min: number, max: number, messages: { min?: string; max?: string } = {}) =>
  z
    .array(id)
    .max(max * 2, messages.max)
    .transform(dedupe)
    .pipe(z.array(id).min(min, messages.min).max(max, messages.max));

// Coordinates are rounded to 2 decimals (~1 km): enough for the weather, and
// it keeps precise locations out of upstream requests and cache keys.
const roundCoord = (v: number) => Math.round(v * 100) / 100;
const lat = z.number().min(-90).max(90).transform(roundCoord);
const lon = z.number().min(-180).max(180).transform(roundCoord);

// A closet can hold this many items, so every closet-based endpoint accepts
// that many ids.
export const MAX_WARDROBE_ITEMS = 500;

// Guests send their own wear history from this browser (signed-in users' comes
// from the DB). Only the last week matters, so an over-long list is trimmed to
// its newest entries instead of failing the whole request.
export const MAX_RECENTLY_WORN = 300;
const recentlyWorn = z.preprocess(
  (v) => (Array.isArray(v) ? v.slice(-MAX_RECENTLY_WORN) : v),
  z.array(z.object({ garmentId: id, wornOn: isoDate })).max(MAX_RECENTLY_WORN)
);

export const registerSchema = z.object({
  name: z.string().trim().min(1).max(80).optional(),
  email,
  // bcrypt only uses the first 72 bytes; longer inputs just waste CPU.
  password: z.string().min(8, 'Password must be at least 8 characters').max(72, 'Password must be at most 72 characters'),
});

export const loginSchema = z.object({
  email,
  password: z.string().min(1, 'Password is required').max(72, 'Invalid email or password'),
});

// A person's style profile (all optional). Empty strings from untouched form
// fields are treated as "not given".
const profileField = z
  .string()
  .max(100)
  .optional()
  .transform((v) => (v && v.trim() ? v.trim() : undefined));

export const styleProfileSchema = z.object({
  hairColor: profileField,
  eyeColor: profileField,
  skinTone: profileField,
  underTone: profileField,
  torsoLength: profileField,
  bodyProportion: profileField,
});

export const outfitScoreSchema = z.object({
  shirtId: id,
  trouserId: id,
  shoeId: id.optional(),
  layerId: id.optional(),
  beltId: id.optional(),
  accessoryIds: z.array(id).max(4).optional(),
  occasionId: id.optional(),
  seasonId: id.optional(),
  profile: styleProfileSchema.optional(),
});

export const personalizationRecommendSchema = styleProfileSchema.refine(
  (p) => Object.values(p).some(Boolean),
  'Pick at least one profile option.'
);

// Either one garment (the "Add" button) or many at once (moving a guest's
// closet into their account after login).
export const wardrobeAddSchema = z
  .object({
    garmentId: id.optional(),
    garmentIds: z.array(id).max(MAX_WARDROBE_ITEMS * 2).optional(),
  })
  .refine((v) => v.garmentId || v.garmentIds?.length, 'garmentId is required')
  .transform((v) => dedupe([...(v.garmentId ? [v.garmentId] : []), ...(v.garmentIds ?? [])]))
  .pipe(z.array(id).max(MAX_WARDROBE_ITEMS, `Your closet can hold up to ${MAX_WARDROBE_ITEMS} items.`));

// The score is NOT accepted from the client — the server recomputes it from
// the garments and the same context (occasion/season/profile) the user saw.
export const savedOutfitCreateSchema = z.object({
  name: z.string().trim().min(1).max(100).default('My Saved Outfit'),
  garmentIds: idList(2, 10, {
    min: 'At least 2 garments required to save an outfit',
    max: 'An outfit can have at most 10 garments',
  }),
  occasionId: id.optional(),
  occasionSlug: slug.optional(),
  seasonId: id.optional(),
  profile: styleProfileSchema.optional(),
});

export const pickerRecommendSchema = z.object({
  category: z.string().min(1, 'category is required').max(40),
  itemType: z.string().min(1, 'itemType is required').max(60),
  colorSlugs: z.array(slug).max(10, 'Pick at most 10 colors').default([]),
  profile: styleProfileSchema.optional(),
  occasionSlug: slug.optional(),
  seasonSlug: slug.optional(),
});

const seasonProfileSchema = z.enum(['light', 'heavy', 'all']);

export const adminGarmentCreateSchema = z.object({
  name: z.string().trim().min(1, 'name is required').max(150),
  slug: z.string().trim().min(1).max(150).optional(),
  garmentTypeId: id,
  description: z.string().max(5000).optional(),
  formalityLevel: z.number().int().min(1).max(5).optional(),
  colorIds: z.array(id).max(10).optional(),
  fitSlug: slug.optional(),
  materialSlug: slug.optional(),
  patternSlug: slug.optional(),
  seasonProfile: seasonProfileSchema.optional(),
});

export const adminGarmentUpdateSchema = z.object({
  id,
  name: z.string().trim().min(1, 'name is required').max(150),
  slug: z.string().trim().min(1, 'slug is required').max(150),
  garmentTypeId: id,
  description: z.string().max(5000).optional(),
  formalityLevel: z.number().int().min(1).max(5).optional(),
  colorIds: z.array(id).max(10).optional(),
  fitSlug: slug.optional(),
  materialSlug: slug.optional(),
  patternSlug: slug.optional(),
  seasonProfile: seasonProfileSchema.optional(),
});

export const adminCompatibilityRuleSchema = z.object({
  garmentAId: id,
  garmentBId: id,
  rating: z.number().min(1).max(5),
  reason: z.string().max(1000).optional(),
  compatibilityType: z.enum(['excellent', 'good', 'acceptable', 'avoid']).optional(),
});

export const adminGuideSchema = z.object({
  title: z.string().trim().min(1, 'Title is required').max(200),
  slug: z.string().trim().min(1).max(200).optional(),
  // Same vocabularies as the DB CHECK constraints (see prisma/migrations).
  category: z.enum(['style', 'occasion', 'body', 'season', 'accessory']),
  content: z.string().trim().min(1, 'Content is required').max(100_000),
  excerpt: z.string().trim().min(1, 'Excerpt is required').max(1000),
  published: z.boolean().default(true),
});

export const adminStyleRuleSchema = z.object({
  title: z.string().trim().min(1, 'Title is required').max(200),
  ruleType: z.enum(['dos', 'donts', 'pro-tip']).default('dos'),
  category: z.enum(['general', 'color', 'fit', 'occasion', 'accessory']).default('general'),
  explanation: z.string().trim().min(1, 'Explanation is required').max(5000),
});

export const adminGuideUpdateSchema = adminGuideSchema.extend({ id });
export const adminStyleRuleUpdateSchema = adminStyleRuleSchema.extend({ id });

// The daily suggestion runs a top x bottom x shoe search over these ids, so
// the cap bounds the work one request can trigger. It matches the closet size
// limit so a full closet still works.
export const MAX_DAILY_SUGGESTION_GARMENTS = MAX_WARDROBE_ITEMS;

export const dailySuggestionSchema = z.object({
  garmentIds: idList(1, MAX_DAILY_SUGGESTION_GARMENTS, {
    min: 'Add a few items to your closet first.',
    max: `Daily suggestions support up to ${MAX_DAILY_SUGGESTION_GARMENTS} closet items.`,
  }),
  lat: lat.optional(),
  lon: lon.optional(),
  // The user's local date, so the suggestion rotates at their midnight.
  localDate: isoDate.optional(),
  recentlyWorn: recentlyWorn.optional(),
  // 0 = today's pick, 1+ = "Try Another" alternatives.
  variant: z.number().int().min(0).max(50).default(0),
  profile: styleProfileSchema.optional(),
});

export const quickPickSchema = z.object({
  occasionSlug: slug,
  // The user's local date (for "worn recently" signals), like the closet routes.
  localDate: isoDate.optional(),
  profile: styleProfileSchema.optional(),
});

export const colorMatchSchema = z.object({
  hex: z
    .string()
    .trim()
    .regex(/^#?([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/, 'Valid hex color is required'),
});

// ---------------------------------------------------------------------------
// Accounts & personal features
// ---------------------------------------------------------------------------

export const profileUpdateSchema = z.object({ profile: styleProfileSchema });

export const customGarmentSchema = z.object({
  name: z.string().trim().min(2, 'Give the item a name.').max(80),
  typeSlug: slug,
  colorSlugs: z.array(slug).min(1, 'Pick at least one color.').max(3, 'Pick up to 3 colors.'),
  formalityLevel: z.number().int().min(1).max(5),
  patternSlug: slug.optional(),
  materialSlug: slug.optional(),
  fitSlug: slug.optional(),
  seasonProfile: z.enum(['light', 'heavy', 'all']).default('all'),
});

export const completeOutfitSchema = z
  .object({
    garmentIds: idList(1, MAX_WARDROBE_ITEMS),
    lockedIds: idList(1, 2),
    occasionSlug: slug.optional(),
    lat: lat.optional(),
    lon: lon.optional(),
    localDate: isoDate.optional(),
    profile: styleProfileSchema.optional(),
    recentlyWorn: recentlyWorn.optional(),
  })
  .refine((v) => v.lockedIds.every((l) => v.garmentIds.includes(l)), 'Locked items must be in your closet.');

export const feedbackSchema = z.object({
  garmentIds: idList(2, 12),
  // 1 = like, -1 = dislike, 0 = clear my vote
  rating: z.union([z.literal(1), z.literal(-1), z.literal(0)]),
});

export const wearLogSchema = z.object({
  garmentIds: idList(1, 12),
  wornOn: isoDate,
  outfitScore: z.number().int().min(0).max(100).optional(),
});

export const gapsSchema = z.object({
  garmentIds: idList(1, MAX_WARDROBE_ITEMS),
  occasionSlug: slug.optional(),
  profile: styleProfileSchema.optional(),
});

// ---------------------------------------------------------------------------
// Admin: color rules & bulk import
// ---------------------------------------------------------------------------

export const adminColorRuleSchema = z
  .object({
    colorA: slug,
    colorB: slug,
    score: z.number().min(0).max(10),
    harmony: z.string().trim().min(1).max(60),
    reason: z.string().trim().max(500).default(''),
  })
  .refine((v) => v.colorA !== v.colorB, 'Pick two different colors.');

export const adminImportSchema = z.object({
  kind: z.enum(['garments', 'compatibility', 'colorRules']),
  csv: z.string().min(1, 'Paste or upload a CSV.').max(500_000, 'CSV is too large (max 500 KB).'),
  dryRun: z.boolean().default(true),
});
