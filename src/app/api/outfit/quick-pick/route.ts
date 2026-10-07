import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { findBestOutfits } from '@/lib/rule-engine/outfit-finder';
import { quickPickSchema as bodySchema } from '@/lib/validation';

// The zero-effort path for someone who "doesn't know what to wear": tap one
// occasion, get one confident outfit — no colors, no wizard, no vocabulary.
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = bodySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
    }
    const { occasionSlug } = parsed.data;

    const occasion = await prisma.occasion.findUnique({ where: { slug: occasionSlug } });
    if (!occasion) {
      return NextResponse.json({ error: 'Unknown occasion.' }, { status: 400 });
    }

    const picks = await findBestOutfits({ occasionId: occasion.id, topN: 3 });

    return NextResponse.json({
      occasion: { name: occasion.name, slug: occasion.slug },
      outfits: picks.map((pick) => ({
        score: pick.score,
        shirt: { id: pick.shirt.id, name: pick.shirt.name, slug: pick.shirt.slug, colors: pick.shirt.colors },
        trouser: { id: pick.trouser.id, name: pick.trouser.name, slug: pick.trouser.slug, colors: pick.trouser.colors },
        shoe: { id: pick.shoe.id, name: pick.shoe.name, slug: pick.shoe.slug, colors: pick.shoe.colors },
      })),
    });
  } catch (error) {
    console.error('Error computing quick pick:', error);
    return NextResponse.json({ error: 'Failed to find a quick outfit pick.' }, { status: 500 });
  }
}
