-- CreateTable
CREATE TABLE "garment_types" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "garment_types_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "colors" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "hex" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "family" TEXT NOT NULL,
    "isNeutral" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "colors_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fits" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "fits_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "materials" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "breathability" INTEGER NOT NULL DEFAULT 3,
    "formality" INTEGER NOT NULL DEFAULT 3,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "materials_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "patterns" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "isFormal" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "patterns_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "occasions" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "formalityLevel" INTEGER NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "occasions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "seasons" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "seasons_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "body_types" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "body_types_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "skin_tones" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "skin_tones_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "garments" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "garmentTypeId" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "formalityLevel" INTEGER NOT NULL DEFAULT 3,
    "imageUrl" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "garments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "garment_colors" (
    "id" TEXT NOT NULL,
    "garmentId" TEXT NOT NULL,
    "colorId" TEXT NOT NULL,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "garment_colors_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "garment_fits" (
    "id" TEXT NOT NULL,
    "garmentId" TEXT NOT NULL,
    "fitId" TEXT NOT NULL,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "garment_fits_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "garment_materials" (
    "id" TEXT NOT NULL,
    "garmentId" TEXT NOT NULL,
    "materialId" TEXT NOT NULL,
    "percentage" INTEGER NOT NULL DEFAULT 100,

    CONSTRAINT "garment_materials_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "garment_patterns" (
    "id" TEXT NOT NULL,
    "garmentId" TEXT NOT NULL,
    "patternId" TEXT NOT NULL,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "garment_patterns_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "garment_occasions" (
    "id" TEXT NOT NULL,
    "garmentId" TEXT NOT NULL,
    "occasionId" TEXT NOT NULL,
    "suitability" INTEGER NOT NULL DEFAULT 3,

    CONSTRAINT "garment_occasions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "garment_seasons" (
    "id" TEXT NOT NULL,
    "garmentId" TEXT NOT NULL,
    "seasonId" TEXT NOT NULL,
    "suitability" INTEGER NOT NULL DEFAULT 3,

    CONSTRAINT "garment_seasons_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "compatibility_rules" (
    "id" TEXT NOT NULL,
    "garmentAId" TEXT NOT NULL,
    "garmentBId" TEXT NOT NULL,
    "rating" DOUBLE PRECISION NOT NULL,
    "reason" TEXT NOT NULL DEFAULT '',
    "compatibilityType" TEXT NOT NULL DEFAULT 'good',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "compatibility_rules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rule_occasions" (
    "id" TEXT NOT NULL,
    "ruleId" TEXT NOT NULL,
    "occasionId" TEXT NOT NULL,

    CONSTRAINT "rule_occasions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rule_seasons" (
    "id" TEXT NOT NULL,
    "ruleId" TEXT NOT NULL,
    "seasonId" TEXT NOT NULL,

    CONSTRAINT "rule_seasons_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "color_compatibility_rules" (
    "id" TEXT NOT NULL,
    "colorAId" TEXT NOT NULL,
    "colorBId" TEXT NOT NULL,
    "harmony" TEXT NOT NULL,
    "score" INTEGER NOT NULL,
    "ruleType" TEXT NOT NULL DEFAULT 'neutral',
    "reason" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "color_compatibility_rules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "guides" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "category" TEXT NOT NULL DEFAULT 'style',
    "content" TEXT NOT NULL DEFAULT '',
    "excerpt" TEXT NOT NULL DEFAULT '',
    "seoTitle" TEXT NOT NULL DEFAULT '',
    "seoDesc" TEXT NOT NULL DEFAULT '',
    "published" BOOLEAN NOT NULL DEFAULT false,
    "imageUrl" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "guides_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "style_rules" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "ruleType" TEXT NOT NULL DEFAULT 'dos',
    "explanation" TEXT NOT NULL DEFAULT '',
    "category" TEXT NOT NULL DEFAULT 'general',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "style_rules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "admin_users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "name" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "admin_users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "personalization_rules" (
    "id" TEXT NOT NULL,
    "hairColor" TEXT NOT NULL,
    "eyeColor" TEXT NOT NULL,
    "skinTone" TEXT NOT NULL,
    "underTone" TEXT NOT NULL,
    "torsoLength" TEXT NOT NULL,
    "bodyProportion" TEXT NOT NULL,
    "recommendedClothingColors" TEXT NOT NULL,
    "avoidClothingColors" TEXT NOT NULL,
    "recommendedFittingStyle" TEXT NOT NULL,
    "recommendedMaterials" TEXT NOT NULL,
    "recommendedPatterns" TEXT NOT NULL,
    "recommendedJewelryMetal" TEXT NOT NULL,
    "recommendedShoes" TEXT NOT NULL,
    "recommendedClothingColorWheelRegion" TEXT NOT NULL,
    "avoidClothingColorWheelRegion" TEXT NOT NULL,
    "fabricNature" TEXT NOT NULL,
    "dontExaggerate" TEXT NOT NULL,
    "doExaggerate" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "personalization_rules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "name" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "digital_wardrobe" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "garmentId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "addedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "digital_wardrobe_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "saved_outfits" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL DEFAULT 'My Saved Outfit',
    "outfitScore" INTEGER NOT NULL DEFAULT 80,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "saved_outfits_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "saved_outfit_items" (
    "id" TEXT NOT NULL,
    "outfitId" TEXT NOT NULL,
    "garmentId" TEXT NOT NULL,
    "layerOrder" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "saved_outfit_items_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "garment_types_name_key" ON "garment_types"("name");

-- CreateIndex
CREATE UNIQUE INDEX "garment_types_slug_key" ON "garment_types"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "colors_name_key" ON "colors"("name");

-- CreateIndex
CREATE UNIQUE INDEX "colors_slug_key" ON "colors"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "fits_name_key" ON "fits"("name");

-- CreateIndex
CREATE UNIQUE INDEX "fits_slug_key" ON "fits"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "materials_name_key" ON "materials"("name");

-- CreateIndex
CREATE UNIQUE INDEX "materials_slug_key" ON "materials"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "patterns_name_key" ON "patterns"("name");

-- CreateIndex
CREATE UNIQUE INDEX "patterns_slug_key" ON "patterns"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "occasions_name_key" ON "occasions"("name");

-- CreateIndex
CREATE UNIQUE INDEX "occasions_slug_key" ON "occasions"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "seasons_name_key" ON "seasons"("name");

-- CreateIndex
CREATE UNIQUE INDEX "seasons_slug_key" ON "seasons"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "body_types_name_key" ON "body_types"("name");

-- CreateIndex
CREATE UNIQUE INDEX "body_types_slug_key" ON "body_types"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "skin_tones_name_key" ON "skin_tones"("name");

-- CreateIndex
CREATE UNIQUE INDEX "skin_tones_slug_key" ON "skin_tones"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "garments_slug_key" ON "garments"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "garment_colors_garmentId_colorId_key" ON "garment_colors"("garmentId", "colorId");

-- CreateIndex
CREATE UNIQUE INDEX "garment_fits_garmentId_fitId_key" ON "garment_fits"("garmentId", "fitId");

-- CreateIndex
CREATE UNIQUE INDEX "garment_materials_garmentId_materialId_key" ON "garment_materials"("garmentId", "materialId");

-- CreateIndex
CREATE UNIQUE INDEX "garment_patterns_garmentId_patternId_key" ON "garment_patterns"("garmentId", "patternId");

-- CreateIndex
CREATE UNIQUE INDEX "garment_occasions_garmentId_occasionId_key" ON "garment_occasions"("garmentId", "occasionId");

-- CreateIndex
CREATE UNIQUE INDEX "garment_seasons_garmentId_seasonId_key" ON "garment_seasons"("garmentId", "seasonId");

-- CreateIndex
CREATE UNIQUE INDEX "compatibility_rules_garmentAId_garmentBId_key" ON "compatibility_rules"("garmentAId", "garmentBId");

-- CreateIndex
CREATE UNIQUE INDEX "rule_occasions_ruleId_occasionId_key" ON "rule_occasions"("ruleId", "occasionId");

-- CreateIndex
CREATE UNIQUE INDEX "rule_seasons_ruleId_seasonId_key" ON "rule_seasons"("ruleId", "seasonId");

-- CreateIndex
CREATE UNIQUE INDEX "color_compatibility_rules_colorAId_colorBId_key" ON "color_compatibility_rules"("colorAId", "colorBId");

-- CreateIndex
CREATE UNIQUE INDEX "guides_slug_key" ON "guides"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "admin_users_email_key" ON "admin_users"("email");

-- CreateIndex
CREATE INDEX "personalization_rules_skinTone_underTone_torsoLength_bodyPr_idx" ON "personalization_rules"("skinTone", "underTone", "torsoLength", "bodyProportion");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "digital_wardrobe_userId_garmentId_key" ON "digital_wardrobe"("userId", "garmentId");

-- CreateIndex
CREATE UNIQUE INDEX "saved_outfit_items_outfitId_garmentId_key" ON "saved_outfit_items"("outfitId", "garmentId");

-- AddForeignKey
ALTER TABLE "garments" ADD CONSTRAINT "garments_garmentTypeId_fkey" FOREIGN KEY ("garmentTypeId") REFERENCES "garment_types"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "garment_colors" ADD CONSTRAINT "garment_colors_garmentId_fkey" FOREIGN KEY ("garmentId") REFERENCES "garments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "garment_colors" ADD CONSTRAINT "garment_colors_colorId_fkey" FOREIGN KEY ("colorId") REFERENCES "colors"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "garment_fits" ADD CONSTRAINT "garment_fits_garmentId_fkey" FOREIGN KEY ("garmentId") REFERENCES "garments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "garment_fits" ADD CONSTRAINT "garment_fits_fitId_fkey" FOREIGN KEY ("fitId") REFERENCES "fits"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "garment_materials" ADD CONSTRAINT "garment_materials_garmentId_fkey" FOREIGN KEY ("garmentId") REFERENCES "garments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "garment_materials" ADD CONSTRAINT "garment_materials_materialId_fkey" FOREIGN KEY ("materialId") REFERENCES "materials"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "garment_patterns" ADD CONSTRAINT "garment_patterns_garmentId_fkey" FOREIGN KEY ("garmentId") REFERENCES "garments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "garment_patterns" ADD CONSTRAINT "garment_patterns_patternId_fkey" FOREIGN KEY ("patternId") REFERENCES "patterns"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "garment_occasions" ADD CONSTRAINT "garment_occasions_garmentId_fkey" FOREIGN KEY ("garmentId") REFERENCES "garments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "garment_occasions" ADD CONSTRAINT "garment_occasions_occasionId_fkey" FOREIGN KEY ("occasionId") REFERENCES "occasions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "garment_seasons" ADD CONSTRAINT "garment_seasons_garmentId_fkey" FOREIGN KEY ("garmentId") REFERENCES "garments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "garment_seasons" ADD CONSTRAINT "garment_seasons_seasonId_fkey" FOREIGN KEY ("seasonId") REFERENCES "seasons"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "compatibility_rules" ADD CONSTRAINT "compatibility_rules_garmentAId_fkey" FOREIGN KEY ("garmentAId") REFERENCES "garments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "compatibility_rules" ADD CONSTRAINT "compatibility_rules_garmentBId_fkey" FOREIGN KEY ("garmentBId") REFERENCES "garments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rule_occasions" ADD CONSTRAINT "rule_occasions_ruleId_fkey" FOREIGN KEY ("ruleId") REFERENCES "compatibility_rules"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rule_occasions" ADD CONSTRAINT "rule_occasions_occasionId_fkey" FOREIGN KEY ("occasionId") REFERENCES "occasions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rule_seasons" ADD CONSTRAINT "rule_seasons_ruleId_fkey" FOREIGN KEY ("ruleId") REFERENCES "compatibility_rules"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rule_seasons" ADD CONSTRAINT "rule_seasons_seasonId_fkey" FOREIGN KEY ("seasonId") REFERENCES "seasons"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "color_compatibility_rules" ADD CONSTRAINT "color_compatibility_rules_colorAId_fkey" FOREIGN KEY ("colorAId") REFERENCES "colors"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "color_compatibility_rules" ADD CONSTRAINT "color_compatibility_rules_colorBId_fkey" FOREIGN KEY ("colorBId") REFERENCES "colors"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "digital_wardrobe" ADD CONSTRAINT "digital_wardrobe_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "digital_wardrobe" ADD CONSTRAINT "digital_wardrobe_garmentId_fkey" FOREIGN KEY ("garmentId") REFERENCES "garments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "saved_outfits" ADD CONSTRAINT "saved_outfits_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "saved_outfit_items" ADD CONSTRAINT "saved_outfit_items_outfitId_fkey" FOREIGN KEY ("outfitId") REFERENCES "saved_outfits"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "saved_outfit_items" ADD CONSTRAINT "saved_outfit_items_garmentId_fkey" FOREIGN KEY ("garmentId") REFERENCES "garments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

