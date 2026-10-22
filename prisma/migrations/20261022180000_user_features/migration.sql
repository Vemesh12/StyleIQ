-- AlterTable
ALTER TABLE "garments" ADD COLUMN     "ownerId" TEXT;

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "styleProfile" JSONB;

-- CreateTable
CREATE TABLE "wear_logs" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "wornOn" DATE NOT NULL,
    "garmentIds" TEXT[],
    "outfitScore" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "wear_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "outfit_feedback" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "outfitKey" TEXT NOT NULL,
    "garmentIds" TEXT[],
    "rating" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "outfit_feedback_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "wear_logs_userId_wornOn_idx" ON "wear_logs"("userId", "wornOn");

-- CreateIndex
CREATE UNIQUE INDEX "outfit_feedback_userId_outfitKey_key" ON "outfit_feedback"("userId", "outfitKey");

-- CreateIndex
CREATE INDEX "garments_ownerId_idx" ON "garments"("ownerId");

-- AddForeignKey
ALTER TABLE "garments" ADD CONSTRAINT "garments_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wear_logs" ADD CONSTRAINT "wear_logs_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "outfit_feedback" ADD CONSTRAINT "outfit_feedback_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- Value checks (same approach as the earlier constraints migration).
ALTER TABLE "outfit_feedback"
  ADD CONSTRAINT "outfit_feedback_rating_vocab" CHECK ("rating" IN (-1, 1)),
  ADD CONSTRAINT "outfit_feedback_garments_present" CHECK (cardinality("garmentIds") BETWEEN 2 AND 12);

ALTER TABLE "wear_logs"
  ADD CONSTRAINT "wear_log_garments_present" CHECK (cardinality("garmentIds") BETWEEN 1 AND 12),
  ADD CONSTRAINT "wear_log_score_range" CHECK ("outfitScore" IS NULL OR "outfitScore" BETWEEN 0 AND 100);
