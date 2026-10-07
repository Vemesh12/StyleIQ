import { prisma } from '@/lib/prisma';
import { getAdminSession } from '@/lib/auth';
import { NextRequest, NextResponse } from 'next/server';
import { adminCompatibilityRuleSchema } from '@/lib/validation';

export async function GET() {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const rules = await prisma.compatibilityRule.findMany({
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
    const body = await request.json();
    const parsed = adminCompatibilityRuleSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
    }
    const { garmentAId, garmentBId, rating, reason, compatibilityType } = parsed.data;

    const rule = await prisma.compatibilityRule.upsert({
      where: {
        garmentAId_garmentBId: { garmentAId, garmentBId },
      },
      update: { rating, reason, compatibilityType },
      create: { garmentAId, garmentBId, rating, reason, compatibilityType },
    });

    return NextResponse.json(rule, { status: 201 });
  } catch (error) {
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

  await prisma.compatibilityRule.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
