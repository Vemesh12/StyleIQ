import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { colorMatchSchema } from '@/lib/validation';
import { enforceRateLimits, getClientIp } from '@/lib/rate-limit';
import { cached } from '@/lib/ttl-cache';
import { colorPairScore } from '@/lib/rule-engine/color-rules';
import { loadCatalog, loadRuleLookups, ENGINE_CACHE_PREFIX } from '@/lib/rule-engine/catalog';

interface RgbColor {
  r: number;
  g: number;
  b: number;
}

function hexToRgb(hex: string): RgbColor {
  const clean = hex.replace('#', '').trim();
  const full = clean.length === 3 ? clean.split('').map((c) => c + c).join('') : clean;
  const num = parseInt(full, 16);
  return { r: (num >> 16) & 255, g: (num >> 8) & 255, b: num & 255 };
}

// Perceptually weighted Euclidean RGB color distance ("redmean").
function colorDistance(c1: RgbColor, c2: RgbColor): number {
  const rmean = (c1.r + c2.r) / 2;
  const r = c1.r - c2.r;
  const g = c1.g - c2.g;
  const b = c1.b - c2.b;
  return Math.sqrt((((512 + rmean) * r * r) >> 8) + 4 * g * g + (((767 - rmean) * b * b) >> 8));
}

const MAX_DISTANCE = colorDistance({ r: 0, g: 0, b: 0 }, { r: 255, g: 255, b: 255 });

const loadPalette = () => cached(`${ENGINE_CACHE_PREFIX}palette`, 5 * 60 * 1000, () => prisma.color.findMany());

export async function POST(request: NextRequest) {
  try {
    const limited = await enforceRateLimits([
      { key: `color-match:${getClientIp(request)}`, limit: 30, windowMs: 60 * 1000 },
    ]);
    if (limited) return limited;

    const parsed = colorMatchSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
    }
    const hex = parsed.data.hex.startsWith('#') ? parsed.data.hex : `#${parsed.data.hex}`;

    const [palette, lookups, catalog] = await Promise.all([loadPalette(), loadRuleLookups(), loadCatalog()]);
    if (!palette.length) {
      return NextResponse.json({ error: 'No palette colors found' }, { status: 500 });
    }

    // Rank palette colors by closeness to the scanned color.
    const inputRgb = hexToRgb(hex);
    const scored = palette
      .map((color) => {
        const distance = colorDistance(inputRgb, hexToRgb(color.hex));
        const confidence = Math.max(1, Math.min(100, Math.round(100 - (distance / MAX_DISTANCE) * 100)));
        return { ...color, distance, confidence };
      })
      .sort((a, b) => a.distance - b.distance);
    const bestMatch = scored[0];
    const alternatives = scored.slice(1, 4);

    // Score the matched color against EVERY palette color — curated rule when
    // one exists, color-wheel math otherwise — instead of only the handful of
    // curated rules (which left most scanned colors with no pairings at all).
    const pairings = palette
      .filter((c) => c.id !== bestMatch.id)
      .map((partner) => ({ partner, result: colorPairScore(bestMatch, partner, lookups.colors) }));

    const toHarmony = ({ partner, result }: (typeof pairings)[number]) => ({
      color: { id: partner.id, name: partner.name, hex: partner.hex, family: partner.family },
      harmony: result.harmony,
      score: result.pairScore,
      ruleType: result.ruleType,
      reason: result.reason,
    });

    // Best pairings, with variety: at most 2 per harmony type so the list
    // isn't six near-identical neutral anchors.
    const perType: Record<string, number> = {};
    const harmonies = pairings
      .filter((p) => !p.result.isClash && p.result.pairScore >= 7.5)
      .sort((a, b) => b.result.pairScore - a.result.pairScore)
      .filter((p) => {
        const n = perType[p.result.harmony] ?? 0;
        if (n >= 2) return false;
        perType[p.result.harmony] = n + 1;
        return true;
      })
      .slice(0, 8)
      .map(toHarmony);

    const avoidHarmonies = pairings
      .filter((p) => p.result.isClash)
      .sort((a, b) => a.result.pairScore - b.result.pairScore)
      .slice(0, 6)
      .map(toHarmony);

    // Real catalog garments whose main color pairs well, best pairing first.
    const partnerScore = new Map(harmonies.map((h) => [h.color.id, h.score]));
    const partnerBySlug = new Map(palette.filter((c) => partnerScore.has(c.id)).map((c) => [c.slug, partnerScore.get(c.id)!]));
    const matchingGarments = catalog
      .filter((g) => g.colors[0]?.slug && partnerBySlug.has(g.colors[0].slug))
      .sort((a, b) => partnerBySlug.get(b.colors[0].slug!)! - partnerBySlug.get(a.colors[0].slug!)!)
      .slice(0, 8)
      .map((g) => ({
        id: g.id,
        name: g.name,
        slug: g.slug,
        formalityLevel: g.formality,
        category: g.typeSlug,
        typeName: g.typeName ?? g.typeSlug,
        colors: g.colors.map((c) => ({ name: c.name, hex: c.hex })),
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
      matchingGarments,
    });
  } catch (error) {
    console.error('Color match error:', error);
    return NextResponse.json({ error: 'Failed to match color' }, { status: 500 });
  }
}
