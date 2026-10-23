'use client';

import { useState } from 'react';
import { Lock, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { OutfitActions } from '@/components/outfit-actions';
import { OutfitPieces, piecesOf, type SuggestedOutfit } from '@/components/outfit-pieces';
import { readGuestWearLog } from '@/lib/guest-wardrobe';
import { loadStyleProfile } from '@/lib/style-profile';
import type { WardrobeItem } from './wardrobe-data';

const OCCASIONS = [
  { slug: '', label: 'Any occasion' },
  { slug: 'casual', label: 'Casual' },
  { slug: 'smart-casual', label: 'Smart casual' },
  { slug: 'business-casual', label: 'Business casual' },
  { slug: 'business-formal', label: 'Business formal' },
  { slug: 'wedding-guest', label: 'Wedding / event' },
];

/** "Complete my outfit": lock one or two pieces, get outfits built around them. */
export function CompleteOutfit({
  wardrobe,
  isLoggedIn,
  onRequireLogin,
}: {
  wardrobe: WardrobeItem[];
  isLoggedIn: boolean;
  onRequireLogin: () => void;
}) {
  const [locked, setLocked] = useState<string[]>([]);
  const [occasionSlug, setOccasionSlug] = useState('');
  const [outfits, setOutfits] = useState<SuggestedOutfit[] | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const toggle = (garmentId: string) => {
    setOutfits(null);
    setMessage(null);
    setLocked((prev) => (prev.includes(garmentId) ? prev.filter((id) => id !== garmentId) : prev.length < 2 ? [...prev, garmentId] : prev));
  };

  const build = async () => {
    setLoading(true);
    setMessage(null);
    setOutfits(null);
    try {
      const res = await fetch('/api/wardrobe/complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          garmentIds: wardrobe.map((w) => w.garmentId),
          lockedIds: locked,
          occasionSlug: occasionSlug || undefined,
          localDate: new Date().toLocaleDateString('en-CA'),
          profile: loadStyleProfile() ?? undefined,
          recentlyWorn: isLoggedIn ? undefined : readGuestWearLog(),
        }),
      });
      const data = await res.json();
      if (!res.ok) setMessage(data.error || 'Could not build an outfit.');
      else {
        setOutfits(data.outfits);
        if (data.message) setMessage(data.message);
      }
    } catch {
      setMessage('Could not build an outfit — check your connection.');
    }
    setLoading(false);
  };

  return (
    <Card className="bg-white dark:bg-zinc-900 border-slate-200 dark:border-zinc-800">
      <CardContent className="p-6 space-y-4">
        <div>
          <h2 className="text-lg font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
            <Lock className="w-5 h-5 text-amber-600" /> Complete my outfit
          </h2>
          <p className="text-sm text-slate-600 dark:text-zinc-400">
            Pick one or two pieces you want to wear — we&apos;ll build the rest from your closet.
          </p>
        </div>

        <div className="flex flex-wrap gap-2 max-h-40 overflow-y-auto pr-1" role="group" aria-label="Pieces to build around">
          {wardrobe.map((w) => {
            const selected = locked.includes(w.garmentId);
            const disabled = !selected && locked.length >= 2;
            return (
              <button
                key={w.garmentId}
                type="button"
                onClick={() => toggle(w.garmentId)}
                disabled={disabled}
                aria-pressed={selected}
                className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 ${
                  selected
                    ? 'bg-amber-600 text-white border-amber-600'
                    : 'border-slate-300 dark:border-zinc-700 text-slate-700 dark:text-zinc-300 hover:border-amber-500'
                }`}
              >
                {selected && <Lock className="inline w-3 h-3 mr-1 -mt-0.5" />}
                {w.garment.name}
              </button>
            );
          })}
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <label className="text-sm text-slate-600 dark:text-zinc-400 flex items-center gap-2">
            For
            <select
              value={occasionSlug}
              onChange={(e) => setOccasionSlug(e.target.value)}
              className="px-3 py-1.5 rounded-lg border border-slate-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-sm text-slate-900 dark:text-white"
            >
              {OCCASIONS.map((o) => (
                <option key={o.slug} value={o.slug}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>
          <Button onClick={build} disabled={locked.length === 0 || loading}>
            <Sparkles className="w-4 h-4" /> {loading ? 'Building...' : 'Build my outfit'}
          </Button>
          {locked.length === 0 && <span className="text-xs text-slate-500 dark:text-zinc-400">Select at least one piece.</span>}
        </div>

        {message && <p className="text-sm text-slate-600 dark:text-zinc-400">{message}</p>}

        {outfits && outfits.length > 0 && (
          <div className="space-y-4 pt-2">
            {outfits.map((o, i) => (
              <div key={i} className="p-4 rounded-xl bg-slate-50 dark:bg-zinc-800/50 border border-slate-200 dark:border-zinc-800 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-bold text-slate-500 dark:text-zinc-400">{i === 0 ? 'Best match' : `Option ${i + 1}`}</span>
                  {o.scorable === false ? (
                    <Badge variant="outline">Not enough to score</Badge>
                  ) : (
                    <Badge variant={o.score >= 85 ? 'excellent' : o.score >= 70 ? 'good' : 'acceptable'}>{o.score}% match</Badge>
                  )}
                </div>
                <OutfitPieces pieces={piecesOf(o)} />
                {o.highlights?.[0] && <p className="text-xs text-emerald-700 dark:text-emerald-400">{o.highlights[0]}</p>}
                <OutfitActions garmentIds={piecesOf(o).map((p) => p.id)} score={o.score} onRequireLogin={onRequireLogin} />
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
