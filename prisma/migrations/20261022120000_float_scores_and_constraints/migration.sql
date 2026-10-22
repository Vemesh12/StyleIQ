-- Color-rule scores are decimals (e.g. 9.8). They were stored in an INTEGER
-- column, so every seeded value lost its fraction (9.8 -> 9).
ALTER TABLE "color_compatibility_rules" ALTER COLUMN "score" SET DATA TYPE DOUBLE PRECISION,
ALTER COLUMN "ruleType" SET DEFAULT 'curated';

-- ---------------------------------------------------------------------------
-- Data clean-up
-- ---------------------------------------------------------------------------

-- A pair is one rule regardless of direction. Drop the newer of any A->B /
-- B->A duplicates (the app now always updates the existing pair instead).
DELETE FROM "color_compatibility_rules" r
USING "color_compatibility_rules" o
WHERE r."colorAId" = o."colorBId"
  AND r."colorBId" = o."colorAId"
  AND (r."createdAt", r."id") > (o."createdAt", o."id");

DELETE FROM "compatibility_rules" r
USING "compatibility_rules" o
WHERE r."garmentAId" = o."garmentBId"
  AND r."garmentBId" = o."garmentAId"
  AND (r."createdAt", r."id") > (o."createdAt", o."id");

-- `harmony` mixed lowercase relationship names with verdicts ('excellent',
-- 'avoid'). It is now a display label in the same vocabulary the scoring
-- engine uses; whether a pair clashes is decided by its score (< 6).
UPDATE "color_compatibility_rules" SET "harmony" = CASE lower("harmony")
  WHEN 'monochromatic' THEN 'Tonal Shades'
  WHEN 'analogous' THEN 'Neighbour Colors'
  WHEN 'complementary' THEN 'Perfect Contrast'
  WHEN 'contrast' THEN 'Classic Contrast'
  WHEN 'excellent' THEN 'Classic Pairing'
  WHEN 'good' THEN 'Good Pairing'
  WHEN 'acceptable' THEN 'Acceptable Pairing'
  WHEN 'fresh-neutral' THEN 'Neutral Anchor'
  WHEN 'jewel-neutral' THEN 'Neutral Anchor'
  WHEN 'avoid' THEN 'Clash'
  ELSE "harmony"
END;

-- The label of a garment rule always follows its star rating.
UPDATE "compatibility_rules" SET "compatibilityType" = CASE
  WHEN "rating" >= 4.5 THEN 'excellent'
  WHEN "rating" >= 3.5 THEN 'good'
  WHEN "rating" >= 2.5 THEN 'acceptable'
  ELSE 'avoid'
END;

-- ---------------------------------------------------------------------------
-- Constraints: let the database reject out-of-range values and unknown
-- vocabulary instead of trusting every writer (seeds, admin API, scripts).
-- ---------------------------------------------------------------------------

ALTER TABLE "color_compatibility_rules"
  ADD CONSTRAINT "color_rule_score_range" CHECK ("score" >= 0 AND "score" <= 10),
  ADD CONSTRAINT "color_rule_distinct_colors" CHECK ("colorAId" <> "colorBId");

ALTER TABLE "compatibility_rules"
  ADD CONSTRAINT "compat_rule_rating_range" CHECK ("rating" >= 1 AND "rating" <= 5),
  ADD CONSTRAINT "compat_rule_type_vocab" CHECK ("compatibilityType" IN ('excellent', 'good', 'acceptable', 'avoid')),
  ADD CONSTRAINT "compat_rule_distinct_garments" CHECK ("garmentAId" <> "garmentBId");

ALTER TABLE "garments"
  ADD CONSTRAINT "garment_formality_range" CHECK ("formalityLevel" BETWEEN 1 AND 5);

ALTER TABLE "occasions"
  ADD CONSTRAINT "occasion_formality_range" CHECK ("formalityLevel" BETWEEN 1 AND 5);

ALTER TABLE "materials"
  ADD CONSTRAINT "material_breathability_range" CHECK ("breathability" BETWEEN 1 AND 5),
  ADD CONSTRAINT "material_formality_range" CHECK ("formality" BETWEEN 1 AND 5);

ALTER TABLE "garment_occasions"
  ADD CONSTRAINT "garment_occasion_suitability_range" CHECK ("suitability" BETWEEN 1 AND 5);

ALTER TABLE "garment_seasons"
  ADD CONSTRAINT "garment_season_suitability_range" CHECK ("suitability" BETWEEN 1 AND 5);

ALTER TABLE "garment_materials"
  ADD CONSTRAINT "garment_material_percentage_range" CHECK ("percentage" BETWEEN 1 AND 100);

ALTER TABLE "style_rules"
  ADD CONSTRAINT "style_rule_type_vocab" CHECK ("ruleType" IN ('dos', 'donts', 'pro-tip')),
  ADD CONSTRAINT "style_rule_category_vocab" CHECK ("category" IN ('general', 'color', 'fit', 'occasion', 'accessory'));

ALTER TABLE "guides"
  ADD CONSTRAINT "guide_category_vocab" CHECK ("category" IN ('style', 'occasion', 'body', 'season', 'accessory'));

ALTER TABLE "saved_outfits"
  ADD CONSTRAINT "saved_outfit_score_range" CHECK ("outfitScore" BETWEEN 0 AND 100);

ALTER TABLE "digital_wardrobe"
  ADD CONSTRAINT "wardrobe_quantity_positive" CHECK ("quantity" >= 1);
