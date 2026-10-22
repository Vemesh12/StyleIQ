-- Postgres does not index foreign keys automatically. These cover the lookups
-- the app does (catalog filters, reverse side of rule pairs, a user's saved
-- outfits) and keep ON DELETE CASCADE from garments/colors from scanning.
-- CreateIndex
CREATE INDEX "color_compatibility_rules_colorBId_idx" ON "color_compatibility_rules"("colorBId");

-- CreateIndex
CREATE INDEX "compatibility_rules_garmentBId_idx" ON "compatibility_rules"("garmentBId");

-- CreateIndex
CREATE INDEX "digital_wardrobe_garmentId_idx" ON "digital_wardrobe"("garmentId");

-- CreateIndex
CREATE INDEX "garment_colors_colorId_idx" ON "garment_colors"("colorId");

-- CreateIndex
CREATE INDEX "garment_occasions_occasionId_idx" ON "garment_occasions"("occasionId");

-- CreateIndex
CREATE INDEX "garment_seasons_seasonId_idx" ON "garment_seasons"("seasonId");

-- CreateIndex
CREATE INDEX "garments_garmentTypeId_idx" ON "garments"("garmentTypeId");

-- CreateIndex
CREATE INDEX "saved_outfit_items_garmentId_idx" ON "saved_outfit_items"("garmentId");

-- CreateIndex
CREATE INDEX "saved_outfits_userId_createdAt_idx" ON "saved_outfits"("userId", "createdAt");

