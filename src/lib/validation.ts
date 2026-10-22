import { z } from 'zod';

// Upper bounds on every client-supplied string/array, so a single request
// can't force huge DB `IN (...)` lists, brute-force searches, or bcrypt work.
const id = z.string().min(1).max(64);
const slug = z.string().min(1).max(100);

export const registerSchema = z.object({
  name: z.string().trim().min(1).max(80).optional(),
  email: z.string().trim().max(254).email('A valid email is required'),
  // bcrypt only uses the first 72 bytes; longer inputs just waste CPU.
  password: z.string().min(8, 'Password must be at least 8 characters').max(72, 'Password must be at most 72 characters'),
});

export const loginSchema = z.object({
  email: z.string().trim().max(254).email('A valid email is required'),
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
    garmentIds: z.array(id).max(200).optional(),
  })
  .refine((v) => v.garmentId || v.garmentIds?.length, 'garmentId is required')
  .transform((v) => Array.from(new Set([...(v.garmentId ? [v.garmentId] : []), ...(v.garmentIds ?? [])])));

// The score is NOT accepted from the client — the server recomputes it from
// the garments and the same context (occasion/season/profile) the user saw.
export const savedOutfitCreateSchema = z.object({
  name: z.string().trim().min(1).max(100).default('My Saved Outfit'),
  garmentIds: z
    .array(id)
    .min(2, 'At least 2 garments required to save an outfit')
    .max(10, 'An outfit can have at most 10 garments')
    .transform((ids) => Array.from(new Set(ids))),
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
// the cap directly bounds the work one request can trigger.
export const MAX_DAILY_SUGGESTION_GARMENTS = 100;

export const dailySuggestionSchema = z.object({
  garmentIds: z
    .array(id)
    .min(1, 'Add a few items to your closet first.')
    .max(MAX_DAILY_SUGGESTION_GARMENTS, `Daily suggestions support up to ${MAX_DAILY_SUGGESTION_GARMENTS} closet items.`)
    .transform((ids) => Array.from(new Set(ids))),
  lat: z.number().min(-90).max(90).optional(),
  lon: z.number().min(-180).max(180).optional(),
  // The user's local date, so the suggestion rotates at their midnight.
  localDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  // Guests' wear history from this browser (signed-in users' comes from the DB).
  recentlyWorn: z.array(z.object({ garmentId: id, wornOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/) })).max(100).optional(),
  // 0 = today's pick, 1+ = "Try Another" alternatives.
  variant: z.number().int().min(0).max(50).default(0),
  profile: styleProfileSchema.optional(),
});

export const quickPickSchema = z.object({
  occasionSlug: slug,
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

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use a YYYY-MM-DD date.');
const idList = (min: number, max: number) =>
  z
    .array(id)
    .min(min)
    .max(max)
    .transform((ids) => Array.from(new Set(ids)));

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
    garmentIds: idList(1, 100),
    lockedIds: idList(1, 2),
    occasionSlug: slug.optional(),
    lat: z.number().min(-90).max(90).optional(),
    lon: z.number().min(-180).max(180).optional(),
    localDate: isoDate.optional(),
    profile: styleProfileSchema.optional(),
    recentlyWorn: z.array(z.object({ garmentId: id, wornOn: isoDate })).max(100).optional(),
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
  garmentIds: idList(1, 100),
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
