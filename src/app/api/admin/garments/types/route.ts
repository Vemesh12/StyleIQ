import { prisma } from '@/lib/prisma';
import { getAdminSession } from '@/lib/auth';
import { NextResponse } from 'next/server';

export async function GET() {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const types = await prisma.garmentType.findMany({
    orderBy: { name: 'asc' },
  });
  return NextResponse.json(types);
}
