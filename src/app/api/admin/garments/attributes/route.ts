import { prisma } from '@/lib/prisma';
import { getAdminSession } from '@/lib/auth';
import { NextResponse } from 'next/server';

export async function GET() {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const [fits, materials, patterns] = await Promise.all([
    prisma.fit.findMany({ orderBy: { name: 'asc' } }),
    prisma.material.findMany({ orderBy: { name: 'asc' } }),
    prisma.pattern.findMany({ orderBy: { name: 'asc' } }),
  ]);

  return NextResponse.json({ fits, materials, patterns });
}
