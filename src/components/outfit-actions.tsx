'use client';

import { useState } from 'react';
import { ThumbsDown, ThumbsUp, CalendarCheck } from 'lucide-react';
import { addGuestWear } from '@/lib/guest-wardrobe';

const today = () => new Date().toLocaleDateString('en-CA'); // local YYYY-MM-DD

/**
 * Thumbs up/down and "I'm wearing this today" for a suggested outfit.
 * Ratings need an account (they re-rank that account's suggestions); wearing
 * works for everyone — guests' history is kept in this browser.
 */
export function OutfitActions({
  garmentIds,
  score,
  onRequireLogin,
  onWorn,
}: {
  garmentIds: string[];
  score?: number;
  onRequireLogin?: () => void;
  onWorn?: () => void;
}) {
  const [rating, setRating] = useState<0 | 1 | -1>(0);
  const [worn, setWorn] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const rate = async (value: 1 | -1) => {
    const next = rating === value ? 0 : value; // clicking again clears the vote
    setBusy(true);
    setStatus(null);
    try {
      const res = await fetch('/api/user/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ garmentIds, rating: next }),
      });
      if (res.status === 401) {
        setStatus('Sign in to rate outfits — your ratings tune future suggestions.');
        onRequireLogin?.();
      } else if (res.ok) {
        setRating(next);
        setStatus(next === 1 ? "Noted — you'll see more like this." : next === -1 ? "Got it — we won't suggest this again." : null);
      } else {
        setStatus('Could not save your rating.');
      }
    } catch {
      setStatus('Could not save your rating.');
    }
    setBusy(false);
  };

  const wearToday = async () => {
    setBusy(true);
    setStatus(null);
    try {
      const res = await fetch('/api/user/wear-log', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ garmentIds, wornOn: today(), outfitScore: score }),
      });
      if (res.status === 401) addGuestWear(garmentIds, today()); // guest: keep it in this browser
      else if (!res.ok) throw new Error(String(res.status));
      setWorn(true);
      setStatus("Added to your history — tomorrow's suggestion will mix things up.");
      onWorn?.();
    } catch {
      setStatus('Could not save to your history.');
    }
    setBusy(false);
  };

  const button =
    'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500';
  return (
    <div className="space-y-1.5">
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          disabled={busy}
          onClick={() => rate(1)}
          aria-pressed={rating === 1}
          aria-label="I like this outfit"
          className={`${button} ${rating === 1 ? 'bg-emerald-600 text-white border-emerald-600' : 'border-slate-300 dark:border-zinc-700 text-slate-600 dark:text-zinc-300 hover:border-emerald-500'}`}
        >
          <ThumbsUp className="w-3.5 h-3.5" />
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => rate(-1)}
          aria-pressed={rating === -1}
          aria-label="Not for me"
          className={`${button} ${rating === -1 ? 'bg-rose-600 text-white border-rose-600' : 'border-slate-300 dark:border-zinc-700 text-slate-600 dark:text-zinc-300 hover:border-rose-500'}`}
        >
          <ThumbsDown className="w-3.5 h-3.5" />
        </button>
        <button
          type="button"
          disabled={busy || worn}
          onClick={wearToday}
          className={`${button} ${worn ? 'bg-amber-600 text-white border-amber-600' : 'border-slate-300 dark:border-zinc-700 text-slate-600 dark:text-zinc-300 hover:border-amber-500'}`}
        >
          <CalendarCheck className="w-3.5 h-3.5" /> {worn ? 'Wearing today' : "I'm wearing this today"}
        </button>
      </div>
      {status && (
        <p role="status" className="text-xs text-slate-500 dark:text-zinc-400">
          {status}
        </p>
      )}
    </div>
  );
}
