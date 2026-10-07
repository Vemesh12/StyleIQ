import { NextRequest, NextResponse } from 'next/server';
import { calculateOutfitScore } from '@/lib/rule-engine/score-calculator';
import { outfitScoreSchema } from '@/lib/validation';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = outfitScoreSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || 'Invalid request body' },
        { status: 400 }
      );
    }

    const result = await calculateOutfitScore(parsed.data);

    return NextResponse.json(result);
  } catch (error) {
    console.error('Error calculating outfit score:', error);
    return NextResponse.json(
      { error: 'Failed to calculate outfit score' },
      { status: 500 }
    );
  }
}
