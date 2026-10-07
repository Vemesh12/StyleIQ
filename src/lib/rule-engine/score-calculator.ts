import { prisma } from '@/lib/prisma';
import { calculateColorHarmony } from './color-rules';
import { calculateCompatibilityScore, getGarmentCompatibility } from './compatibility';
import {
  splitTerms,
  textMentionsAnyTerm,
  getPersonalizationRuleForSkinTone,
  getPersonalizationRuleForBodyProportion,
  scoreColorsAgainstPersonalization,
} from './personalization';
import { ratingFromScore, type OutfitRating } from './rating';

export interface OutfitScoreInput {
  shirtId: string;
  trouserId: string;
  shoeId?: string;
  layerId?: string;
  beltId?: string;
  occasionId?: string;
  seasonId?: string;
  skinTone?: string;
  underTone?: string;
  bodyProportion?: string;
}

export interface ScoreBreakdown {
  colorHarmony: number;       // 0-30
  garmentCompatibility: number; // 0-25
  occasionMatch: number;       // 0-15
  seasonSuitability: number;   // 0-10
  bodyTypeSuitability: number; // 0-10
  skinToneSuitability: number; // 0-10
}

export interface OutfitScoreResult {
  totalScore: number;
  breakdown: ScoreBreakdown;
  rating: OutfitRating;
  suggestions: string[];
}

/**
 * Calculate the complete outfit score across 6 dimensions.
 * Maximum score: 100 points.
 */
export async function calculateOutfitScore(
  input: OutfitScoreInput
): Promise<OutfitScoreResult> {
  const { shirtId, trouserId, shoeId, layerId, beltId, occasionId, seasonId, skinTone, underTone, bodyProportion } = input;
  const garmentIds = [shirtId, trouserId, shoeId, layerId, beltId].filter(Boolean) as string[];
  const suggestions: string[] = [];

  // 1. COLOR HARMONY (0-30)
  const colorResult = await calculateColorHarmony(garmentIds);
  const colorHarmony = colorResult.score;

  // Add suggestions from color analysis
  colorResult.details.forEach((detail) => {
    if (detail.harmony === 'avoid') {
      suggestions.push(
        `Consider replacing — ${detail.colorA} and ${detail.colorB}: ${detail.reason}`
      );
    }
  });

  if (colorResult.warning) {
    suggestions.push(colorResult.warning);
  }

  // 2. GARMENT COMPATIBILITY (0-25)
  const compatibilityRatings: number[] = [];
  
  // Check shirt-trouser compatibility
  const shirtTrouserRule = await getGarmentCompatibility(shirtId, trouserId);
  if (shirtTrouserRule) {
    compatibilityRatings.push(shirtTrouserRule.rating);
    if (shirtTrouserRule.rating < 3) {
      suggestions.push(`Shirt-Trouser: ${shirtTrouserRule.reason}`);
    }
  }

  // Check layer compatibility (outerwear with shirt, trouser, shoe)
  if (layerId) {
    const layerShirtRule = await getGarmentCompatibility(layerId, shirtId);
    if (layerShirtRule) {
      compatibilityRatings.push(layerShirtRule.rating);
      if (layerShirtRule.rating < 3) {
        suggestions.push(`Outerwear-Shirt: ${layerShirtRule.reason}`);
      }
    }

    const layerTrouserRule = await getGarmentCompatibility(layerId, trouserId);
    if (layerTrouserRule) {
      compatibilityRatings.push(layerTrouserRule.rating);
      if (layerTrouserRule.rating < 3) {
        suggestions.push(`Outerwear-Trouser: ${layerTrouserRule.reason}`);
      }
    }

    if (shoeId) {
      const layerShoeRule = await getGarmentCompatibility(layerId, shoeId);
      if (layerShoeRule) {
        compatibilityRatings.push(layerShoeRule.rating);
      }
    }
  }

  // Check shirt-shoe compatibility
  if (shoeId) {
    const shirtShoeRule = await getGarmentCompatibility(shirtId, shoeId);
    if (shirtShoeRule) {
      compatibilityRatings.push(shirtShoeRule.rating);
    }

    // Check trouser-shoe compatibility
    const trouserShoeRule = await getGarmentCompatibility(trouserId, shoeId);
    if (trouserShoeRule) {
      compatibilityRatings.push(trouserShoeRule.rating);
    }
  }

  // Check belt-shoe compatibility & Strict Leather Color Match Rule
  let leatherMismatchPenalty = 0;
  if (beltId && shoeId) {
    const beltShoeRule = await getGarmentCompatibility(beltId, shoeId);
    if (beltShoeRule) {
      compatibilityRatings.push(beltShoeRule.rating);
      if (beltShoeRule.rating < 3) {
        suggestions.push(`Belt-Shoe: ${beltShoeRule.reason}`);
      }
    }

    // Check primary color family clash (Black vs Brown leathers)
    const [beltColors, shoeColors] = await Promise.all([
      prisma.garmentColor.findMany({
        where: { garmentId: beltId, isPrimary: true },
        include: { color: true },
      }),
      prisma.garmentColor.findMany({
        where: { garmentId: shoeId, isPrimary: true },
        include: { color: true },
      }),
    ]);

    const beltColor = beltColors[0]?.color;
    const shoeColor = shoeColors[0]?.color;

    if (beltColor && shoeColor) {
      const bDesc = `${beltColor.name} ${beltColor.family}`.toLowerCase();
      const sDesc = `${shoeColor.name} ${shoeColor.family}`.toLowerCase();

      const isBlackBelt = bDesc.includes('black') || bDesc.includes('charcoal');
      const isBrownBelt = ['brown', 'tan', 'cognac', 'oxblood', 'burgundy'].some((t) => bDesc.includes(t));

      const isBlackShoe = sDesc.includes('black') || sDesc.includes('charcoal');
      const isBrownShoe = ['brown', 'tan', 'cognac', 'oxblood', 'burgundy'].some((t) => sDesc.includes(t));

      if ((isBlackBelt && isBrownShoe) || (isBrownBelt && isBlackShoe)) {
        leatherMismatchPenalty = 6;
        suggestions.push(
          `Classic Menswear Faux Pas: Never pair a ${beltColor.name} belt with ${shoeColor.name} shoes. Leather accessories must match in color tone (black belt with black shoes, brown belt with brown shoes).`
        );
      }
    }
  }

  const rawCompatibility = calculateCompatibilityScore(compatibilityRatings);
  const garmentCompatibility = Math.max(0, rawCompatibility - leatherMismatchPenalty);

  // 3. OCCASION MATCH (0-15)
  let occasionMatch = 8; // Neutral default
  if (occasionId) {
    const garments = await prisma.garment.findMany({
      where: { id: { in: garmentIds } },
      include: {
        occasions: {
          where: { occasionId },
        },
      },
    });

    const suitabilities = garments
      .flatMap((g) => g.occasions.map((o) => o.suitability))
      .filter((s) => s > 0);

    if (suitabilities.length > 0) {
      const avgSuit = suitabilities.reduce((a, b) => a + b, 0) / suitabilities.length;
      occasionMatch = Math.round((avgSuit / 5) * 15);
    }

    // Check if any garment has low occasion suitability
    garments.forEach((g) => {
      const occ = g.occasions[0];
      if (occ && occ.suitability <= 2) {
        suggestions.push(`${g.name} may not be ideal for this occasion.`);
      }
    });
  }

  // 4. SEASON SUITABILITY (0-10)
  let seasonSuitability = 5; // Neutral default
  if (seasonId) {
    const garments = await prisma.garment.findMany({
      where: { id: { in: garmentIds } },
      include: {
        seasons: {
          where: { seasonId },
        },
      },
    });

    const suitabilities = garments
      .flatMap((g) => g.seasons.map((o) => o.suitability))
      .filter((s) => s > 0);

    if (suitabilities.length > 0) {
      const avgSuit = suitabilities.reduce((a, b) => a + b, 0) / suitabilities.length;
      seasonSuitability = Math.round((avgSuit / 5) * 10);
    }
  }

  // 5. SKIN TONE SUITABILITY (0-10)
  // Matches the outfit's garment colors against the personalization CSV's
  // recommended/avoid color guidance for the user's skin tone.
  let skinToneSuitability = 7; // Neutral default when no skin tone is supplied
  if (skinTone) {
    const rule = await getPersonalizationRuleForSkinTone(skinTone, underTone);

    if (rule) {
      const garmentColors = await prisma.garmentColor.findMany({
        where: { garmentId: { in: garmentIds }, isPrimary: true },
        include: { color: true },
      });

      const { score, matchedAvoid } = scoreColorsAgainstPersonalization(
        garmentColors.map((gc) => ({ name: gc.color.name, family: gc.color.family })),
        rule
      );
      skinToneSuitability = score;
      matchedAvoid.forEach((name) => {
        suggestions.push(
          `${name} is not ideal for your skin tone — consider ${rule.recommendedClothingColors}.`
        );
      });
    }
  }

  // 6. BODY TYPE SUITABILITY (0-10)
  // Matches the outfit's fits/patterns against recommended fitting style for
  // the user's body proportion.
  let bodyTypeSuitability = 7; // Neutral default when no body proportion is supplied
  if (bodyProportion) {
    const rule = await getPersonalizationRuleForBodyProportion(bodyProportion);

    if (rule) {
      const garments = await prisma.garment.findMany({
        where: { id: { in: garmentIds } },
        include: {
          fits: { include: { fit: true } },
          patterns: { include: { pattern: true } },
        },
      });

      const recommendedFitTerms = splitTerms(rule.recommendedFittingStyle);
      const recommendedPatternTerms = splitTerms(rule.recommendedPatterns);

      let score = 5;
      garments.forEach((g) => {
        g.fits.forEach((gf) => {
          if (textMentionsAnyTerm(gf.fit.name, recommendedFitTerms)) score += 1.5;
        });
        g.patterns.forEach((gp) => {
          if (textMentionsAnyTerm(gp.pattern.name, recommendedPatternTerms)) score += 1;
        });
      });

      bodyTypeSuitability = Math.round(Math.min(10, Math.max(0, score)));
    }
  }

  // CALCULATE TOTAL
  const breakdown: ScoreBreakdown = {
    colorHarmony,
    garmentCompatibility,
    occasionMatch,
    seasonSuitability,
    bodyTypeSuitability,
    skinToneSuitability,
  };

  const rawTotal =
    breakdown.colorHarmony +
    breakdown.garmentCompatibility +
    breakdown.occasionMatch +
    breakdown.seasonSuitability +
    breakdown.bodyTypeSuitability +
    breakdown.skinToneSuitability;

  // GATING — same philosophy as the item picker: a severe formality clash
  // between pieces (e.g. a black-tie jacket with casual sneakers) shouldn't
  // just lose a few additive points, it should multiplicatively cap the
  // total, since no amount of color harmony makes that combination "good."
  const formalityLevels = (
    await prisma.garment.findMany({
      where: { id: { in: garmentIds } },
      select: { formalityLevel: true },
    })
  ).map((g) => g.formalityLevel);

  let maxFormalityGap = 0;
  for (let i = 0; i < formalityLevels.length; i++) {
    for (let j = i + 1; j < formalityLevels.length; j++) {
      maxFormalityGap = Math.max(maxFormalityGap, Math.abs(formalityLevels[i] - formalityLevels[j]));
    }
  }

  let gate = 1;
  if (maxFormalityGap >= 3) {
    gate = 0.6;
    suggestions.push('One piece here is much more dressy or much more casual than the rest — try swapping it for something in between.');
  } else if (maxFormalityGap === 2) {
    gate = 0.85;
  }

  const totalScore = Math.round(rawTotal * gate);
  const rating = ratingFromScore(totalScore);

  // Add general suggestions
  if (!shoeId) suggestions.push('Add shoes to get a more accurate outfit score.');
  if (!beltId) suggestions.push('Consider adding a belt to complete the look.');

  return {
    totalScore: Math.min(100, Math.max(0, totalScore)),
    breakdown,
    rating,
    suggestions,
  };
}
