import { prisma } from '@/lib/prisma';

// Splits a comma-separated recommendation field (e.g. "Earth Tones, Olive, Coral")
// into lowercase terms usable for case-insensitive substring matching.
export function splitTerms(field: string): string[] {
  return field
    .split(',')
    .map((t) => t.trim().toLowerCase())
    .filter(Boolean);
}

export function textMentionsAnyTerm(text: string, terms: string[]): boolean {
  const lowerText = text.toLowerCase();
  return terms.some((term) => lowerText.includes(term) || term.includes(lowerText));
}

export async function getPersonalizationRuleForSkinTone(skinTone: string, underTone?: string) {
  if (underTone) {
    const specific = await prisma.personalizationRule.findFirst({
      where: {
        skinTone: { equals: skinTone, mode: 'insensitive' },
        underTone: { equals: underTone, mode: 'insensitive' },
      },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    });
    if (specific) return specific;
  }

  return prisma.personalizationRule.findFirst({
    where: { skinTone: { equals: skinTone, mode: 'insensitive' } },
    orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
  });
}

export async function getPersonalizationRuleForBodyProportion(bodyProportion: string) {
  return prisma.personalizationRule.findFirst({
    where: { bodyProportion: { equals: bodyProportion, mode: 'insensitive' } },
    orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
  });
}

/**
 * Scores a set of colors (0-10) against a skin-tone personalization rule's
 * recommended/avoid guidance. Returns a neutral 7 when nothing is known.
 *
 * Matches against both the color's literal name AND its `family` (e.g.
 * "Oxblood Red" / family "Red") — the family is a reliable, curated signal
 * that a name-only substring match misses whenever a color's style name
 * doesn't literally contain the matched hue word.
 */
export function scoreColorsAgainstPersonalization(
  colors: { name: string; family?: string }[],
  rule: { recommendedClothingColors: string; avoidClothingColors: string } | null
): { score: number; matchedAvoid: string[] } {
  if (!rule || colors.length === 0) return { score: 7, matchedAvoid: [] };

  const recommendedTerms = splitTerms(rule.recommendedClothingColors);
  const avoidTerms = splitTerms(rule.avoidClothingColors);

  let score = 5;
  const matchedAvoid: string[] = [];
  colors.forEach(({ name, family }) => {
    const isRecommended = textMentionsAnyTerm(name, recommendedTerms) || (family && textMentionsAnyTerm(family, recommendedTerms));
    const isAvoid = textMentionsAnyTerm(name, avoidTerms) || (family && textMentionsAnyTerm(family, avoidTerms));
    if (isRecommended) score += 1.5;
    if (isAvoid) {
      score -= 2;
      matchedAvoid.push(name);
    }
  });

  return { score: Math.round(Math.min(10, Math.max(0, score))), matchedAvoid };
}
