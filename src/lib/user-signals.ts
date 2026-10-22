import { prisma } from '@/lib/prisma';
import { emptySignals, outfitKey, type UserSignals } from '@/lib/rule-engine/signals';

/** Calendar date (YYYY-MM-DD) -> UTC midnight Date for @db.Date columns. */
export function toDateOnly(isoDate: string): Date {
  return new Date(`${isoDate}T00:00:00.000Z`);
}

const daysBetween = (later: Date, earlier: Date) => Math.round((later.getTime() - earlier.getTime()) / 86_400_000);

/**
 * Wear history (last 7 days) and outfit feedback for a user. Guests have no
 * server history; they pass `guestRecentlyWorn` (from this browser) instead.
 */
export async function loadUserSignals(
  userId: string | null,
  today: string,
  guestRecentlyWorn: { garmentId: string; wornOn: string }[] = []
): Promise<UserSignals> {
  const signals = emptySignals();
  const todayDate = toDateOnly(today);
  const remember = (garmentId: string, wornOn: Date) => {
    const days = daysBetween(todayDate, wornOn);
    if (days < 0 || days > 7) return;
    const prev = signals.recentlyWorn.get(garmentId);
    if (prev === undefined || days < prev) signals.recentlyWorn.set(garmentId, days);
  };

  for (const w of guestRecentlyWorn) {
    if (/^\d{4}-\d{2}-\d{2}$/.test(w.wornOn)) remember(w.garmentId, toDateOnly(w.wornOn));
  }

  if (userId) {
    const since = new Date(todayDate.getTime() - 7 * 86_400_000);
    const [logs, feedback] = await Promise.all([
      prisma.wearLog.findMany({ where: { userId, wornOn: { gte: since } } }),
      prisma.outfitFeedback.findMany({ where: { userId }, orderBy: { updatedAt: 'desc' }, take: 500 }),
    ]);
    for (const log of logs) for (const id of log.garmentIds) remember(id, log.wornOn);
    for (const f of feedback) signals.feedback.set(f.outfitKey, f.rating);
  }
  return signals;
}

export { outfitKey };
