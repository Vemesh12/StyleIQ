import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    // Logging every query floods the dev console (hundreds of lines per
    // page); opt in with PRISMA_LOG_QUERIES=1 when debugging SQL.
    log: process.env.PRISMA_LOG_QUERIES === '1' ? ['query', 'warn', 'error'] : ['warn', 'error'],
  });

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;
