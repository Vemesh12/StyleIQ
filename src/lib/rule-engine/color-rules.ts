import { prisma } from '@/lib/prisma';

export interface ColorHarmonyResult {
  score: number; // 0-30
  details: {
    colorA: string;
    colorB: string;
    harmony: string;
    ruleType: string;
    reason: string;
    pairScore: number;
  }[];
  warning?: string;
}

// Convert Hex to full HSL (Hue: 0-360, Saturation: 0-100%, Lightness: 0-100%)
export function hexToHSL(hex: string): { h: number; s: number; l: number } {
  let c = hex.replace('#', '');
  if (c.length === 3) c = c.split('').map((x) => x + x).join('');
  const r = parseInt(c.substring(0, 2), 16) / 255;
  const g = parseInt(c.substring(2, 4), 16) / 255;
  const b = parseInt(c.substring(4, 6), 16) / 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0;
  let s = 0;
  const l = (max + min) / 2;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r:
        h = (g - b) / d + (g < b ? 6 : 0);
        break;
      case g:
        h = (b - r) / d + 2;
        break;
      case b:
        h = (r - g) / d + 4;
        break;
    }
    h /= 6;
  }

  return {
    h: Math.round(h * 360),
    s: Math.round(s * 100),
    l: Math.round(l * 100),
  };
}

// Pure Mathematical HSL Color Wheel Evaluator for any 2 colors
export function evaluateColorPairHarmony(
  cA: { name: string; hex: string; isNeutral?: boolean },
  cB: { name: string; hex: string; isNeutral?: boolean }
): { pairScore: number; harmony: string; ruleType: string; reason: string } {
  const hslA = hexToHSL(cA.hex);
  const hslB = hexToHSL(cB.hex);

  const hueDiff = Math.abs(hslA.h - hslB.h);
  const angle = Math.min(hueDiff, 360 - hueDiff);
  const lightnessDelta = Math.abs(hslA.l - hslB.l);

  // 0. Exact Same Color — matching a color to itself (e.g. one of an anchor
  // item's colors reappearing on a candidate, or two garments sharing a
  // primary color like a black belt + black shoes) is intentional tonal
  // dressing, not a flaw. Must be checked before the "low contrast neutrals"
  // rule below, which is for two DIFFERENT near-identical neutrals only.
  if (cA.hex.toLowerCase() === cB.hex.toLowerCase()) {
    return {
      pairScore: 9.9,
      harmony: 'Exact Match',
      ruleType: 'tonal-exact',
      reason: `Matching ${cA.name} throughout creates a clean, intentional tonal look.`,
    };
  }

  // 1. Universal Neutral Anchoring
  if (cA.isNeutral || cB.isNeutral) {
    // Two DIFFERENT neutrals that are also very close in lightness (e.g. two
    // near-identical off-whites) read as a washed-out, low-contrast pairing
    // rather than a classic neutral anchor, so score it lower instead of a
    // flat "Classic Match".
    if (cA.isNeutral && cB.isNeutral && lightnessDelta < 10) {
      return {
        pairScore: 6.5,
        harmony: 'Low Contrast Neutrals',
        ruleType: 'flat-neutral',
        reason: `${cA.name} and ${cB.name} are both neutrals of very similar lightness, which can look flat and washed out — consider adding more contrast.`,
      };
    }

    return {
      pairScore: 9.8,
      harmony: 'Classic Match',
      ruleType: 'classic-neutral',
      reason: `${cA.isNeutral ? cA.name : cB.name} is a versatile neutral color that goes perfectly with ${
        cA.isNeutral ? cB.name : cA.name
      }.`,
    };
  }

  // 2. Monochromatic Harmony (Same family shades)
  if (angle <= 15) {
    if (lightnessDelta >= 20) {
      return {
        pairScore: 9.5,
        harmony: 'Same Color Shades',
        ruleType: 'monochromatic-contrast',
        reason: `Matching shades of ${cA.name} and ${cB.name} with good light-and-dark contrast.`,
      };
    }
    return {
      pairScore: 7.5,
      harmony: 'Tone on Tone',
      ruleType: 'monochromatic-flat',
      reason: `Similar shades of ${cA.name} and ${cB.name}.`,
    };
  }

  // 3. Complementary Harmony (Opposite Contrast)
  if (Math.abs(angle - 180) <= 35) {
    return {
      pairScore: 9.6,
      harmony: 'Perfect Contrast',
      ruleType: 'complementary-180',
      reason: `Sharp contrasting pair of ${cA.name} and ${cB.name} that looks bold and attractive.`,
    };
  }

  // 4. Analogous Harmony (Nearby Shades)
  if (angle >= 16 && angle <= 50) {
    return {
      pairScore: 9.0,
      harmony: 'Neighbour Colors',
      ruleType: 'analogous-neighbor',
      reason: `Smooth combination of ${cA.name} and ${cB.name} sitting right next to each other on the color wheel.`,
    };
  }

  // 5. Triadic Harmony (~120° apart)
  if (Math.abs(angle - 120) <= 25) {
    return {
      pairScore: 9.2,
      harmony: 'Balanced Contrast',
      ruleType: 'triadic-120',
      reason: `Balanced 3-way color match between ${cA.name} and ${cB.name} for a smart look.`,
    };
  }

  // 6. Split-Complementary (~150° or ~210° apart)
  if (Math.abs(angle - 150) <= 20) {
    return {
      pairScore: 9.1,
      harmony: 'Smart Contrast',
      ruleType: 'split-complementary-150',
      reason: `Smart combination of ${cA.name} and ${cB.name} with attractive color balance.`,
    };
  }

  // Default Harmonious Contrast Fallback
  return {
    pairScore: 8.2,
    harmony: 'Good Combination',
    ruleType: 'balanced-contrast',
    reason: `Good matching contrast between ${cA.name} and ${cB.name}.`,
  };
}

export async function calculateColorHarmony(
  garmentIds: string[]
): Promise<ColorHarmonyResult> {
  const garmentColors = await prisma.garmentColor.findMany({
    where: {
      garmentId: { in: garmentIds },
      isPrimary: true,
    },
    include: {
      color: true,
    },
  });

  if (garmentColors.length < 2) {
    return { score: 20, details: [] };
  }

  const colorIds = garmentColors.map((gc) => gc.colorId);
  const uniqueColorIds = [...new Set(colorIds)];

  const colorRules = await prisma.colorCompatibilityRule.findMany({
    where: {
      OR: uniqueColorIds.flatMap((a) =>
        uniqueColorIds
          .filter((b) => b !== a)
          .map((b) => ({
            colorAId: a,
            colorBId: b,
          }))
      ),
    },
    include: {
      colorA: true,
      colorB: true,
    },
  });

  const details: ColorHarmonyResult['details'] = [];
  let totalPairScores = 0;
  let pairCount = 0;

  for (let i = 0; i < garmentColors.length; i++) {
    for (let j = i + 1; j < garmentColors.length; j++) {
      const cA = garmentColors[i].color;
      const cB = garmentColors[j].color;

      const dbRule = colorRules.find(
        (r) =>
          (r.colorAId === cA.id && r.colorBId === cB.id) ||
          (r.colorAId === cB.id && r.colorBId === cA.id)
      );

      if (dbRule) {
        totalPairScores += dbRule.score;
        details.push({
          colorA: cA.name,
          colorB: cB.name,
          harmony: dbRule.harmony,
          ruleType: dbRule.ruleType,
          reason: dbRule.reason,
          pairScore: dbRule.score,
        });
      } else {
        const evalResult = evaluateColorPairHarmony(cA, cB);
        totalPairScores += evalResult.pairScore;
        details.push({
          colorA: cA.name,
          colorB: cB.name,
          harmony: evalResult.harmony,
          ruleType: evalResult.ruleType,
          reason: evalResult.reason,
          pairScore: evalResult.pairScore,
        });
      }
      pairCount++;
    }
  }

  // 3-Color Maximum Rule: Check how many distinct non-neutral color families are present
  const nonNeutralFamilies = Array.from(
    new Set(
      garmentColors
        .map((gc) => gc.color)
        .filter((c) => !c.isNeutral)
        .map((c) => c.family.trim())
    )
  );

  let threeColorPenalty = 0;
  let warning: string | undefined;

  if (nonNeutralFamilies.length >= 3) {
    threeColorPenalty = 4;
    warning = `Visual Clutter Alert: You are wearing ${nonNeutralFamilies.length} distinct non-neutral colors (${nonNeutralFamilies.join(', ')}). Menswear Golden Rule: Stick to a maximum of 2 vibrant colors, anchored by neutral pieces.`;
  }

  const avgPairScore = pairCount > 0 ? totalPairScores / pairCount : 8;
  const rawScore = Math.round((avgPairScore / 10) * 30);
  const finalScore = Math.max(0, rawScore - threeColorPenalty);

  return {
    score: Math.min(30, Math.max(0, finalScore)),
    details,
    warning,
  };
}
