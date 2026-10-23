import { prisma } from '@/lib/prisma';
import { getAdminSession } from '@/lib/auth';
import { NextRequest, NextResponse } from 'next/server';
import { adminStyleRuleSchema, adminStyleRuleUpdateSchema } from '@/lib/validation';
import { clientErrorResponse } from '@/lib/api-errors';
import { revalidatePublicContent } from '@/lib/revalidate';

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
    const parsed = adminStyleRuleSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
    }

    const rule = await prisma.styleRule.create({ data: parsed.data });
    revalidatePublicContent('styleRules');
    return NextResponse.json(rule, { status: 201 });
  } catch (error) {
    console.error('Error creating style rule:', error);
    return NextResponse.json({ error: 'Failed to create style rule' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const parsed = adminStyleRuleUpdateSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
    }
    const { id, ...data } = parsed.data;

    const rule = await prisma.styleRule.update({ where: { id }, data });
    revalidatePublicContent('styleRules');
    return NextResponse.json(rule);
  } catch (error) {
    const clientError = clientErrorResponse(error, { notFound: 'Style rule not found.' });
    if (clientError) return clientError;
    console.error('Error updating style rule:', error);
    return NextResponse.json({ error: 'Failed to update style rule' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'ID is required' }, { status: 400 });

  const { count } = await prisma.styleRule.deleteMany({ where: { id } });
  if (count === 0) return NextResponse.json({ error: 'Style rule not found.' }, { status: 404 });
  revalidatePublicContent('styleRules');
  return NextResponse.json({ success: true });
}
