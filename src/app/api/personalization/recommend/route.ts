import { NextRequest, NextResponse } from 'next/server';
import { personalizationRecommendSchema } from '@/lib/validation';
import { enforceRateLimits, getClientIp } from '@/lib/rate-limit';
import { findPersonalizationRule } from '@/lib/rule-engine/catalog';

export async function POST(request: NextRequest) {
  try {
    const limited = await enforceRateLimits([
      { key: `personalization:${getClientIp(request)}`, limit: 30, windowMs: 60 * 1000 },
    ]);
    if (limited) return limited;

    const parsed = personalizationRecommendSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
    }

    // Closest match: exact on every field given, then progressively relaxing
    // the least important fields (case-insensitive). Never falls back to an
    // unrelated row.
    const match = await findPersonalizationRule(parsed.data);
    if (!match) {
      return NextResponse.json({ error: 'No recommendation found for this profile.' }, { status: 404 });
    }

    return NextResponse.json({ ...match.rule, matchedOn: match.matchedOn, ignored: match.ignored });
  } catch (error) {
    console.error('Error querying personalization rule:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
