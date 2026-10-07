import { prisma } from '@/lib/prisma';
import { NextRequest, NextResponse } from 'next/server';
import { personalizationRecommendSchema } from '@/lib/validation';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = personalizationRecommendSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
    }
    const { hairColor, eyeColor, skinTone, underTone, torsoLength, bodyProportion } = parsed.data;

    const where: Record<string, string> = {};
    if (hairColor) where.hairColor = hairColor;
    if (eyeColor) where.eyeColor = eyeColor;
    if (skinTone) where.skinTone = skinTone;
    if (underTone) where.underTone = underTone;
    if (torsoLength) where.torsoLength = torsoLength;
    if (bodyProportion) where.bodyProportion = bodyProportion;

    const rule = await prisma.personalizationRule.findFirst({
      where,
    });

    if (!rule) {
      // Fallback to broader match (skin tone + body proportion)
      const fallback = await prisma.personalizationRule.findFirst({
        where: {
          skinTone: skinTone || undefined,
          bodyProportion: bodyProportion || undefined,
        },
      });
      if (!fallback) {
        return NextResponse.json({ error: 'No exact recommendation found' }, { status: 404 });
      }
      return NextResponse.json(fallback);
    }

    return NextResponse.json(rule);
  } catch (error) {
    console.error('Error querying personalization rule:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
