import { prisma } from '@/lib/prisma';
import { getAdminSession } from '@/lib/auth';
import { NextRequest, NextResponse } from 'next/server';
import { adminGuideSchema, adminGuideUpdateSchema } from '@/lib/validation';
import { clientErrorResponse } from '@/lib/api-errors';
import { revalidatePublicContent } from '@/lib/revalidate';
import { slugify } from '@/lib/utils';

const ERRORS = { unique: 'Another guide already uses that slug.', notFound: 'Guide not found.' };

/** First free slug of `base`, `base-2`, `base-3`… (ignoring `exceptId`). */
async function uniqueGuideSlug(base: string, exceptId?: string): Promise<string> {
  const taken = new Set(
    (
      await prisma.guide.findMany({
        where: { slug: { startsWith: base }, ...(exceptId ? { NOT: { id: exceptId } } : {}) },
        select: { slug: true },
      })
    ).map((g) => g.slug)
  );
  if (!taken.has(base)) return base;
  for (let n = 2; ; n++) if (!taken.has(`${base}-${n}`)) return `${base}-${n}`;
}

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
    const parsed = adminGuideSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
    }

    const { title, slug, category, content, excerpt, published } = parsed.data;
    const requested = slugify(slug || '');
    const base = requested || slugify(title);
    if (!base) return NextResponse.json({ error: 'Title must contain at least one letter or digit.' }, { status: 400 });

    // A typed slug must be free (409 otherwise); a title-derived one gets a suffix.
    const finalSlug = requested || (await uniqueGuideSlug(base));
    const guide = await prisma.guide.create({
      data: { title, slug: finalSlug, category, content, excerpt, published },
    });

    revalidatePublicContent('guides');

    return NextResponse.json(guide, { status: 201 });
  } catch (error) {
    const clientError = clientErrorResponse(error, ERRORS);
    if (clientError) return clientError;
    console.error('Error creating guide:', error);
    return NextResponse.json({ error: 'Failed to create guide' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const parsed = adminGuideUpdateSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
    }
    const { id, title, slug, category, content, excerpt, published } = parsed.data;
    const data: { title: string; category: string; content: string; excerpt: string; published: boolean; slug?: string } = {
      title,
      category,
      content,
      excerpt,
      published,
    };
    // Slug only changes when one is given; editing the title never silently
    // changes a published URL.
    if (slug) {
      data.slug = slugify(slug);
      if (!data.slug) return NextResponse.json({ error: 'Slug must contain at least one letter or digit.' }, { status: 400 });
    }

    const guide = await prisma.guide.update({ where: { id }, data });
    revalidatePublicContent('guides');
    return NextResponse.json(guide);
  } catch (error) {
    const clientError = clientErrorResponse(error, ERRORS);
    if (clientError) return clientError;
    console.error('Error updating guide:', error);
    return NextResponse.json({ error: 'Failed to update guide' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'ID is required' }, { status: 400 });

  const { count } = await prisma.guide.deleteMany({ where: { id } });
  if (count === 0) return NextResponse.json({ error: ERRORS.notFound }, { status: 404 });
  revalidatePublicContent('guides');
  return NextResponse.json({ success: true });
}
