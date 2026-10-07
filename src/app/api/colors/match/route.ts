import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

interface RgbColor {
  r: number;
  g: number;
  b: number;
}

function hexToRgb(hex: string): RgbColor {
  const clean = hex.replace('#', '').trim();
  const full = clean.length === 3
    ? clean.split('').map((c) => c + c).join('')
    : clean;
  const num = parseInt(full, 16);
  return {
    r: (num >> 16) & 255,
    g: (num >> 8) & 255,
    b: num & 255,
  };
}

// Perceptually weighted Euclidean RGB color distance
function colorDistance(c1: RgbColor, c2: RgbColor): number {
  const rmean = (c1.r + c2.r) / 2;
  const r = c1.r - c2.r;
  const g = c1.g - c2.g;
  const b = c1.b - c2.b;
  return Math.sqrt(
    (((512 + rmean) * r * r) >> 8) +
    4 * g * g +
    (((767 - rmean) * b * b) >> 8)
  );
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { hex } = body;

    if (!hex || typeof hex !== 'string') {
      return NextResponse.json({ error: 'Valid hex color is required' }, { status: 400 });
    }

    const inputRgb = hexToRgb(hex);

    // Fetch all colors in database
    const allColors = await prisma.color.findMany();
    if (!allColors.length) {
      return NextResponse.json({ error: 'No palette colors found' }, { status: 500 });
    }

    // Rank database colors by closeness
    const scoredColors = allColors.map((color) => {
      const dbRgb = hexToRgb(color.hex);
      const dist = colorDistance(inputRgb, dbRgb);
      // Max possible distance is ~765
      const confidence = Math.max(1, Math.min(100, Math.round(100 - (dist / 765) * 100)));
      return {
        ...color,
        distance: dist,
        confidence,
      };
    });

    scoredColors.sort((a, b) => a.distance - b.distance);
    const bestMatch = scoredColors[0];
    const alternatives = scoredColors.slice(1, 4);

    // Query color compatibility rules for best match
    const rules = await prisma.colorCompatibilityRule.findMany({
      where: {
        OR: [
          { colorAId: bestMatch.id },
          { colorBId: bestMatch.id },
        ],
      },
      include: {
        colorA: true,
        colorB: true,
      },
      orderBy: { score: 'desc' },
    });

    const recommendedColorIds = new Set<string>();
    const harmonies = rules
      .filter((r) => r.harmony !== 'avoid' && r.score >= 6)
      .map((r) => {
        const partner = r.colorAId === bestMatch.id ? r.colorB : r.colorA;
        recommendedColorIds.add(partner.id);
        return {
          color: partner,
          harmony: r.harmony,
          score: r.score,
          ruleType: r.ruleType,
          reason: r.reason,
        };
      });

    const avoidHarmonies = rules
      .filter((r) => r.harmony === 'avoid' || r.score < 5)
      .map((r) => {
        const partner = r.colorAId === bestMatch.id ? r.colorB : r.colorA;
        return {
          color: partner,
          harmony: r.harmony,
          score: r.score,
          ruleType: r.ruleType,
          reason: r.reason,
        };
      });

    // Query actual garments featuring recommended pairing colors
    const partnerColorIdsArray = Array.from(recommendedColorIds);
    const matchingGarments = await prisma.garment.findMany({
      where: {
        colors: {
          some: {
            colorId: { in: partnerColorIdsArray.length ? partnerColorIdsArray : [bestMatch.id] },
          },
        },
      },
      include: {
        garmentType: true,
        colors: {
          include: { color: true },
        },
      },
      take: 8,
    });

    const transformedGarments = matchingGarments.map((g) => ({
      id: g.id,
      name: g.name,
      slug: g.slug,
      formalityLevel: g.formalityLevel,
      category: g.garmentType.slug,
      typeName: g.garmentType.name,
      colors: g.colors.map((c) => ({
        name: c.color.name,
        hex: c.color.hex,
      })),
    }));

    return NextResponse.json({
      detectedHex: hex,
      matchedColor: {
        id: bestMatch.id,
        name: bestMatch.name,
        hex: bestMatch.hex,
        slug: bestMatch.slug,
        family: bestMatch.family,
        isNeutral: bestMatch.isNeutral,
      },
      matchConfidence: bestMatch.confidence,
      alternatives: alternatives.map((a) => ({
        id: a.id,
        name: a.name,
        hex: a.hex,
        slug: a.slug,
        family: a.family,
        confidence: a.confidence,
      })),
      harmonies,
      avoidHarmonies,
      matchingGarments: transformedGarments,
    });
  } catch (error) {
    console.error('Color match error:', error);
    return NextResponse.json({ error: 'Failed to match color' }, { status: 500 });
  }
}
