import { prisma } from '@/lib/prisma';
import { getAdminSession } from '@/lib/auth';
import { NextRequest, NextResponse } from 'next/server';
import { adminStyleRuleSchema } from '@/lib/validation';

export async function GET() {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const rules = await prisma.styleRule.findMany({
    orderBy: { createdAt: 'desc' },
  });

  return NextResponse.json(rules);
}

export async function POST(request: NextRequest) {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const body = await request.json();
    const parsed = adminStyleRuleSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
    }

    const { title, ruleType, category, explanation } = parsed.data;

    const rule = await prisma.styleRule.create({
      data: {
        title,
        ruleType,
        category,
        explanation,
      },
    });

    return NextResponse.json(rule, { status: 201 });
  } catch (error) {
    console.error('Error creating style rule:', error);
    return NextResponse.json({ error: 'Failed to create style rule' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'ID is required' }, { status: 400 });

  await prisma.styleRule.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
