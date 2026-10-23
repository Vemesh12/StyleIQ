'use client';

import { useEffect, useState } from 'react';
import { CalendarDays, Trash2 } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { OutfitPieces, type OutfitPiece } from '@/components/outfit-pieces';
import { readGuestWearLog } from '@/lib/guest-wardrobe';
import type { AllGarment } from './wardrobe-data';

interface Entry {
  id: string;
  wornOn: string;
  outfitScore?: number | null;
  items: OutfitPiece[];
}

const formatDay = (iso: string) =>
  new Date(`${iso}T12:00:00`).toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' });

/**
 * Outfit calendar: what was worn, by day. Signed-in users' history comes from
 * their account (and can be edited); guests see what this browser remembers.
 */
export function WearHistory({ isLoggedIn, allGarments }: { isLoggedIn: boolean; allGarments: AllGarment[] }) {
  const [entries, setEntries] = useState<Entry[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [removeError, setRemoveError] = useState<string | null>(null);
  const [removingId, setRemovingId] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    if (!isLoggedIn) {
      // Guests: rebuild entries from the browser's log (one entry per day).
      const byId = new Map(allGarments.map((g) => [g.id, g]));
      const byDay = new Map<string, OutfitPiece[]>();
      for (const w of readGuestWearLog()) {
        const g = byId.get(w.garmentId);
        if (!g) continue;
        const list = byDay.get(w.wornOn) ?? [];
        if (!list.some((p) => p.id === g.id)) list.push({ id: g.id, name: g.name, slug: g.slug, typeSlug: g.garmentTypeSlug, colors: g.colors });
        byDay.set(w.wornOn, list);
      }
      const guestEntries = [...byDay.entries()].sort(([a], [b]) => b.localeCompare(a)).map(([wornOn, items]) => ({ id: wornOn, wornOn, items }));
      Promise.resolve().then(() => active && setEntries(guestEntries));
    } else {
      fetch('/api/user/wear-log?days=60')
        .then((res) => {
          if (!res.ok) throw new Error(String(res.status));
          return res.json();
        })
        .then((data: Entry[]) => active && setEntries(data))
        .catch(() => active && setError('Could not load your history.'));
    }
    return () => {
      active = false;
    };
  }, [isLoggedIn, allGarments]);

  const remove = async (id: string) => {
    setRemoveError(null);
    setRemovingId(id);
    try {
      const res = await fetch(`/api/user/wear-log?id=${encodeURIComponent(id)}`, { method: 'DELETE' });
      if (res.ok || res.status === 404) setEntries((prev) => prev?.filter((e) => e.id !== id) ?? null);
      else setRemoveError('Could not remove that day — please try again.');
    } catch {
      setRemoveError('Could not remove that day — check your connection and try again.');
    } finally {
      setRemovingId(null);
    }
  };

  if (error) return <p className="text-sm text-rose-600 dark:text-rose-400">{error}</p>;
  if (!entries) return <p className="text-sm text-slate-500 dark:text-zinc-400">Loading your history...</p>;
  if (entries.length === 0) {
    return (
      <Card className="text-center py-12 bg-white dark:bg-zinc-900 border-slate-200 dark:border-zinc-800">
        <CardContent className="space-y-3">
          <CalendarDays className="w-10 h-10 text-slate-400 dark:text-zinc-600 mx-auto" />
          <h3 className="text-lg font-semibold text-slate-800 dark:text-white">No outfits logged yet</h3>
          <p className="text-sm text-slate-500 dark:text-zinc-400 max-w-md mx-auto">
            Tap &quot;I&apos;m wearing this today&quot; on a suggestion. Your history keeps daily suggestions from repeating the same pieces.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      {removeError && (
        <p role="alert" className="mb-4 text-sm font-medium text-rose-600 dark:text-rose-400">
          {removeError}
        </p>
      )}
      <ol className="space-y-4">
        {entries.map((e) => (
          <li key={e.id}>
            <Card className="p-4 bg-white dark:bg-zinc-900 border-slate-200 dark:border-zinc-800 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <CalendarDays className="w-4 h-4 text-amber-600" /> {formatDay(e.wornOn)}
                </h3>
                <div className="flex items-center gap-2">
                  {e.outfitScore != null && <span className="text-xs text-slate-500 dark:text-zinc-400">{e.outfitScore}% match</span>}
                  {isLoggedIn && (
                    <button type="button" onClick={() => remove(e.id)} disabled={removingId === e.id} aria-label={`Remove ${formatDay(e.wornOn)} from history`} className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/20">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
              <OutfitPieces pieces={e.items} size={32} />
            </Card>
          </li>
        ))}
      </ol>
    </>
  );
}
