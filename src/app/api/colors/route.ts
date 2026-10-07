import { prisma } from '@/lib/prisma';
import { NextResponse } from 'next/server';

export async function GET() {
  const colors = await prisma.color.findMany({
    orderBy: [{ family: 'asc' }, { name: 'asc' }],
  });

  const grouped: Record<string, typeof colors> = {};
  for (const c of colors) {
    if (!grouped[c.family]) grouped[c.family] = [];
    grouped[c.family].push(c);
  }

  return NextResponse.json({ colors, groupedByFamily: grouped, total: colors.length });
}
