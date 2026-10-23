import { prisma } from '@/lib/prisma';
import { getAdminSession } from '@/lib/auth';
import { NextRequest, NextResponse } from 'next/server';
import { adminCompatibilityRuleSchema } from '@/lib/validation';
import { invalidateEngineCache } from '@/lib/rule-engine/catalog';
import { clientErrorResponse } from '@/lib/api-errors';
import { revalidatePublicContent } from '@/lib/revalidate';
import { compatibilityTypeForRating } from '@/lib/rule-engine/rating';

export async function GET() {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const rules = await prisma.compatibilityRule.findMany({
    where: { garmentA: { ownerId: null }, garmentB: { ownerId: null } },
    include: {
      garmentA: { select: { id: true, name: true } },
      garmentB: { select: { id: true, name: true } },
    },
    orderBy: { rating: 'desc' },
  });

  return NextResponse.json(rules);
}

export async function POST(request: NextRequest) {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const parsed = adminCompatibilityRuleSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
    }
    const { garmentAId, garmentBId, rating, reason } = parsed.data;
    if (garmentAId === garmentBId) {
      return NextResponse.json({ error: 'Pick two different garments.' }, { status: 400 });
    }
    // Rules are for the shared catalog only; users' private items stay private.
    const catalogCount = await prisma.garment.count({ where: { id: { in: [garmentAId, garmentBId] }, ownerId: null } });
    if (catalogCount !== 2) {
      return NextResponse.json({ error: 'Both garments must be catalog items.' }, { status: 400 });
    }
    const compatibilityType = compatibilityTypeForRating(rating);
    const data = { rating, reason: reason ?? '', compatibilityType };

    // A pair is one rule regardless of direction: if B->A already exists,
    // update it instead of creating a second, possibly contradicting, A->B.
    const rule = await prisma.$transaction(async (tx) => {
      const existing = await tx.compatibilityRule.findMany({
        where: {
          OR: [
            { garmentAId, garmentBId },
            { garmentAId: garmentBId, garmentBId: garmentAId },
          ],
        },
        orderBy: { createdAt: 'asc' },
      });
      if (existing.length === 0) {
        return tx.compatibilityRule.create({ data: { garmentAId, garmentBId, ...data } });
      }
      const [keep, ...duplicates] = existing;
      if (duplicates.length) await tx.compatibilityRule.deleteMany({ where: { id: { in: duplicates.map((d) => d.id) } } });
      return tx.compatibilityRule.update({ where: { id: keep.id }, data });
    });

    invalidateEngineCache();
    revalidatePublicContent('compatibility');
    return NextResponse.json(rule, { status: 201 });
  } catch (error) {
    const clientError = clientErrorResponse(error, { foreignKey: 'One of the selected garments no longer exists.' });
    if (clientError) return clientError;
    console.error('Error adding compatibility rule:', error);
    return NextResponse.json({ error: 'Failed to create rule' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'ID required' }, { status: 400 });

  const { count } = await prisma.compatibilityRule.deleteMany({ where: { id } });
  if (count === 0) return NextResponse.json({ error: 'Rule not found' }, { status: 404 });
  invalidateEngineCache();
  revalidatePublicContent('compatibility');
  return NextResponse.json({ success: true });
}
