import { prisma } from '@/lib/prisma';
import { getAdminSession } from '@/lib/auth';
import { NextRequest, NextResponse } from 'next/server';
import { adminGuideSchema } from '@/lib/validation';

export async function GET() {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const guides = await prisma.guide.findMany({
    orderBy: { createdAt: 'desc' },
  });

  return NextResponse.json(guides);
}

export async function POST(request: NextRequest) {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const body = await request.json();
    const parsed = adminGuideSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
    }

    const { title, slug, category, content, excerpt, published } = parsed.data;
    const finalSlug = slug || title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

    const guide = await prisma.guide.create({
      data: {
        title,
        slug: finalSlug,
        category,
        content,
        excerpt,
        published,
      },
    });

    return NextResponse.json(guide, { status: 201 });
  } catch (error) {
    console.error('Error creating guide:', error);
    return NextResponse.json({ error: 'Failed to create guide' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'ID is required' }, { status: 400 });

  await prisma.guide.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
