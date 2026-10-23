import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAdminSession } from '@/lib/auth';
import { adminColorRuleSchema } from '@/lib/validation';
import { invalidateEngineCache } from '@/lib/rule-engine/catalog';
import { revalidatePublicContent } from '@/lib/revalidate';
import { clientErrorResponse, prismaErrorCode } from '@/lib/api-errors';

// Curated color-pair rules. They override the color-wheel math for that
// pair everywhere (outfit scores, color scanner, color guide).

export async function GET() {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const [rules, colors] = await Promise.all([
    prisma.colorCompatibilityRule.findMany({
      include: { colorA: true, colorB: true },
      orderBy: [{ score: 'desc' }, { createdAt: 'asc' }],
    }),
    prisma.color.findMany({ select: { id: true, name: true, slug: true, hex: true }, orderBy: { name: 'asc' } }),
  ]);
  return NextResponse.json({ rules, colors });
}

export async function POST(request: NextRequest) {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const parsed = adminColorRuleSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }
  const { colorA, colorB, score, harmony, reason } = parsed.data;
  const [a, b] = await Promise.all([
    prisma.color.findUnique({ where: { slug: colorA } }),
    prisma.color.findUnique({ where: { slug: colorB } }),
  ]);
  if (!a || !b) return NextResponse.json({ error: 'Unknown color.' }, { status: 400 });

  // One rule per pair, whichever order it was entered in.
  // An existing rule keeps its ruleType tag; new ones are 'curated'.
  const data = { score, harmony, reason };
  const findPair = () =>
    prisma.colorCompatibilityRule.findFirst({
      where: { OR: [{ colorAId: a.id, colorBId: b.id }, { colorAId: b.id, colorBId: a.id }] },
    });

  try {
    let existing = await findPair();
    let rule;
    if (existing) {
      rule = await prisma.colorCompatibilityRule.update({ where: { id: existing.id }, data });
    } else {
      try {
        rule = await prisma.colorCompatibilityRule.create({ data: { colorAId: a.id, colorBId: b.id, ruleType: 'curated', ...data } });
      } catch (error) {
        // Someone created the same pair concurrently: update that one instead.
        if (prismaErrorCode(error) !== 'P2002') throw error;
        existing = await findPair();
        if (!existing) return NextResponse.json({ error: 'A rule for this pair already exists.' }, { status: 409 });
        rule = await prisma.colorCompatibilityRule.update({ where: { id: existing.id }, data });
      }
    }

    invalidateEngineCache();
    revalidatePublicContent('garments');
    return NextResponse.json(rule, { status: existing ? 200 : 201 });
  } catch (error) {
    const clientError = clientErrorResponse(error, {
      unique: 'A rule for this pair already exists.',
      foreignKey: 'One of the colors no longer exists.',
      notFound: 'Rule not found.',
    });
    if (clientError) return clientError;
    console.error('Error saving color rule:', error);
    return NextResponse.json({ error: 'Failed to save the color rule.' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const id = new URL(request.url).searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'ID is required' }, { status: 400 });

  const { count } = await prisma.colorCompatibilityRule.deleteMany({ where: { id } });
  if (count === 0) return NextResponse.json({ error: 'Rule not found' }, { status: 404 });
  invalidateEngineCache();
  revalidatePublicContent('garments');
  return NextResponse.json({ success: true });
}
