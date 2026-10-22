import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAdminSession } from '@/lib/auth';
import { adminColorRuleSchema } from '@/lib/validation';
import { invalidateEngineCache } from '@/lib/rule-engine/catalog';
import { revalidatePublicContent } from '@/lib/revalidate';

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
  const data = { score, harmony, reason, ruleType: 'curated' };
  const existing = await prisma.colorCompatibilityRule.findFirst({
    where: { OR: [{ colorAId: a.id, colorBId: b.id }, { colorAId: b.id, colorBId: a.id }] },
  });
  const rule = existing
    ? await prisma.colorCompatibilityRule.update({ where: { id: existing.id }, data })
    : await prisma.colorCompatibilityRule.create({ data: { colorAId: a.id, colorBId: b.id, ...data } });

  invalidateEngineCache();
  revalidatePublicContent('garments');
  return NextResponse.json(rule, { status: existing ? 200 : 201 });
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
