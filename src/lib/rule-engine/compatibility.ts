import { prisma } from '@/lib/prisma';

/**
 * Get compatibility between two specific garments
 */
export async function getGarmentCompatibility(garmentAId: string, garmentBId: string) {
  const rule = await prisma.compatibilityRule.findFirst({
    where: {
      OR: [
        { garmentAId, garmentBId },
        { garmentAId: garmentBId, garmentBId: garmentAId },
      ],
    },
    include: {
      garmentA: {
        include: {
          garmentType: true,
          colors: { include: { color: true } },
        },
      },
      garmentB: {
        include: {
          garmentType: true,
          colors: { include: { color: true } },
        },
      },
      occasions: { include: { occasion: true } },
      seasons: { include: { season: true } },
    },
  });

  return rule;
}

/**
 * Calculate garment compatibility score (0-25 pts)
 */
export function calculateCompatibilityScore(ratings: number[]): number {
  if (ratings.length === 0) return 12; // Neutral
  const avg = ratings.reduce((a, b) => a + b, 0) / ratings.length;
  return Math.round((avg / 5) * 25);
}
