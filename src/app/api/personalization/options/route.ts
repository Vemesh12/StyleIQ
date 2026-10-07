import { prisma } from '@/lib/prisma';
import { NextResponse } from 'next/server';

export async function GET() {
  try {
    const [hairColors, eyeColors, skinTones, underTones, torsoLengths, bodyProportions] =
      await Promise.all([
        prisma.personalizationRule.findMany({ select: { hairColor: true }, distinct: ['hairColor'] }),
        prisma.personalizationRule.findMany({ select: { eyeColor: true }, distinct: ['eyeColor'] }),
        prisma.personalizationRule.findMany({ select: { skinTone: true }, distinct: ['skinTone'] }),
        prisma.personalizationRule.findMany({ select: { underTone: true }, distinct: ['underTone'] }),
        prisma.personalizationRule.findMany({ select: { torsoLength: true }, distinct: ['torsoLength'] }),
        prisma.personalizationRule.findMany({ select: { bodyProportion: true }, distinct: ['bodyProportion'] }),
      ]);

    return NextResponse.json({
      hairColors: hairColors.map((r) => r.hairColor).filter(Boolean),
      eyeColors: eyeColors.map((r) => r.eyeColor).filter(Boolean),
      skinTones: skinTones.map((r) => r.skinTone).filter(Boolean),
      underTones: underTones.map((r) => r.underTone).filter(Boolean),
      torsoLengths: torsoLengths.map((r) => r.torsoLength).filter(Boolean),
      bodyProportions: bodyProportions.map((r) => r.bodyProportion).filter(Boolean),
    });
  } catch (error) {
    console.error('Error fetching personalization options:', error);
    return NextResponse.json({ error: 'Failed to fetch options' }, { status: 500 });
  }
}
