import { z } from 'zod';

export const registerSchema = z.object({
  name: z.string().trim().min(1).optional(),
  email: z.string().trim().email('A valid email is required'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
});

export const loginSchema = z.object({
  email: z.string().trim().email('A valid email is required'),
  password: z.string().min(1, 'Password is required'),
});

export const outfitScoreSchema = z.object({
  shirtId: z.string().min(1, 'shirtId is required'),
  trouserId: z.string().min(1, 'trouserId is required'),
  shoeId: z.string().min(1).optional(),
  layerId: z.string().min(1).optional(),
  beltId: z.string().min(1).optional(),
  occasionId: z.string().min(1).optional(),
  seasonId: z.string().min(1).optional(),
  skinTone: z.string().min(1).optional(),
  underTone: z.string().min(1).optional(),
  bodyProportion: z.string().min(1).optional(),
});

export const personalizationRecommendSchema = z.object({
  hairColor: z.string().min(1).optional(),
  eyeColor: z.string().min(1).optional(),
  skinTone: z.string().min(1).optional(),
  underTone: z.string().min(1).optional(),
  torsoLength: z.string().min(1).optional(),
  bodyProportion: z.string().min(1).optional(),
});

export const wardrobeAddSchema = z.object({
  garmentId: z.string().min(1, 'garmentId is required'),
});

export const savedOutfitCreateSchema = z.object({
  name: z.string().trim().min(1).default('My Saved Outfit'),
  outfitScore: z.number().int().min(0).max(100).default(80),
  garmentIds: z.array(z.string().min(1)).min(2, 'At least 2 garments required to save an outfit'),
});

export const pickerRecommendSchema = z.object({
  category: z.string().min(1, 'category is required'),
  itemType: z.string().min(1, 'itemType is required'),
  colorSlugs: z.array(z.string().min(1)).default([]),
  skinTone: z.string().min(1).optional(),
  underTone: z.string().min(1).optional(),
  occasionSlug: z.string().min(1).optional(),
  seasonSlug: z.string().min(1).optional(),
});

const seasonProfileSchema = z.enum(['light', 'heavy', 'all']);

export const adminGarmentCreateSchema = z.object({
  name: z.string().trim().min(1, 'name is required'),
  slug: z.string().trim().min(1).optional(),
  garmentTypeId: z.string().min(1, 'garmentTypeId is required'),
  description: z.string().optional(),
  formalityLevel: z.number().int().min(1).max(5).optional(),
  colorIds: z.array(z.string().min(1)).optional(),
  fitSlug: z.string().min(1).optional(),
  materialSlug: z.string().min(1).optional(),
  patternSlug: z.string().min(1).optional(),
  seasonProfile: seasonProfileSchema.optional(),
});

export const adminGarmentUpdateSchema = z.object({
  id: z.string().min(1, 'id is required'),
  name: z.string().trim().min(1, 'name is required'),
  slug: z.string().trim().min(1, 'slug is required'),
  garmentTypeId: z.string().min(1, 'garmentTypeId is required'),
  description: z.string().optional(),
  formalityLevel: z.number().int().min(1).max(5).optional(),
  colorIds: z.array(z.string().min(1)).optional(),
  fitSlug: z.string().min(1).optional(),
  materialSlug: z.string().min(1).optional(),
  patternSlug: z.string().min(1).optional(),
  seasonProfile: seasonProfileSchema.optional(),
});

export const adminCompatibilityRuleSchema = z.object({
  garmentAId: z.string().min(1, 'garmentAId is required'),
  garmentBId: z.string().min(1, 'garmentBId is required'),
  rating: z.number().min(1).max(5),
  reason: z.string().optional(),
  compatibilityType: z.enum(['excellent', 'good', 'acceptable', 'avoid']).optional(),
});

export const adminGuideSchema = z.object({
  title: z.string().trim().min(1, 'Title is required'),
  slug: z.string().trim().min(1).optional(),
  category: z.string().trim().min(1, 'Category is required'),
  content: z.string().trim().min(1, 'Content is required'),
  excerpt: z.string().trim().min(1, 'Excerpt is required'),
  published: z.boolean().default(true),
});

export const adminStyleRuleSchema = z.object({
  title: z.string().trim().min(1, 'Title is required'),
  ruleType: z.enum(['dos', 'donts', 'pro-tip']).default('dos'),
  category: z.string().trim().min(1).default('general'),
  explanation: z.string().trim().min(1, 'Explanation is required'),
});

export const dailySuggestionSchema = z.object({
  garmentIds: z.array(z.string().min(1)).min(1, 'Add a few items to your closet first.'),
  lat: z.number().optional(),
  lon: z.number().optional(),
});

export const quickPickSchema = z.object({
  occasionSlug: z.string().min(1, 'occasionSlug is required'),
});
