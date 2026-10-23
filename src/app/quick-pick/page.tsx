'use client';

import { useRef, useState } from 'react';
import { Card, CardTitle } from '@/components/ui/card';
import { SelectableCard } from '@/components/ui/selectable-card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { GarmentIllustration } from '@/components/garment-illustration';
import Link from 'next/link';
import { AuthModal } from '@/components/auth-modal';
import { loadStyleProfile, type SavedStyleProfile } from '@/lib/style-profile';
import { OutfitActions } from '@/components/outfit-actions';
import { Sparkles, RotateCcw, Briefcase, Coffee, Heart, PartyPopper, Bookmark, Check } from 'lucide-react';

interface QuickPickItem {
  id: string;
  name: string;
  slug?: string;
  typeSlug?: string;
  colors: { name: string; hex: string }[];
  /** The person's own custom garment — it has no encyclopedia page. */
  isOwn?: boolean;
}

interface QuickPickOutfit {
  score: number;
  shirt: QuickPickItem;
  trouser: QuickPickItem;
  shoe: QuickPickItem;
  layer: QuickPickItem | null;
  belt: QuickPickItem | null;
  /** Locked accessories other than the belt; may be missing. */
  accessories?: QuickPickItem[];
  highlights: string[];
}

// Pieces in wearing order; layer and belt only when the engine added them.
function outfitPieces(o: QuickPickOutfit) {
  return [
    { category: o.shirt.typeSlug || 'shirt', item: o.shirt },
    o.layer && { category: o.layer.typeSlug || 'jacket', item: o.layer },
    { category: 'trouser', item: o.trouser },
    { category: 'shoe', item: o.shoe },
    o.belt && { category: 'belt', item: o.belt },
    ...(o.accessories ?? []).map((a) => ({ category: a.typeSlug || 'accessory', item: a })),
  ].filter((p): p is { category: string; item: QuickPickItem } => !!p);
}

const PROFILE_KEYS: (keyof SavedStyleProfile)[] = [
  'hairColor',
  'eyeColor',
  'skinTone',
  'underTone',
  'torsoLength',
  'bodyProportion',
];

// The saved profile with only known, non-empty keys in a fixed order, so the
// same profile always produces the same request (and server cache key).
function normalizedProfile(): SavedStyleProfile | undefined {
  const raw = loadStyleProfile();
  if (!raw) return undefined;
  const out: SavedStyleProfile = {};
  for (const key of PROFILE_KEYS) {
    const v = raw[key];
    if (typeof v === 'string' && v.trim()) out[key] = v.trim();
  }
  return Object.keys(out).length > 0 ? out : undefined;
}

// Today's date in the person's own timezone (YYYY-MM-DD), not UTC.
function localDate() {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

// Maps a plain "what are you doing today" question directly to a real
// Occasion row, so there's zero fashion vocabulary between the user and an
// answer — no colors, no formality levels, no wizard steps.
const OCCASIONS = [
  { slug: 'casual', label: 'Just Hanging Out', icon: Coffee, description: 'Weekend errands, coffee, relaxed days' },
  { slug: 'business-casual', label: 'Work / Office', icon: Briefcase, description: 'Office days, meetings, client calls' },
  { slug: 'smart-casual', label: 'Date Night', icon: Heart, description: 'Dinner dates, nice dinners out' },
  { slug: 'wedding-guest', label: 'A Big Event', icon: PartyPopper, description: 'Weddings, parties, celebrations' },
];

export default function QuickPickPage() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [occasionLabel, setOccasionLabel] = useState<string | null>(null);
  const [occasionSlug, setOccasionSlug] = useState<string | null>(null);
  const [outfits, setOutfits] = useState<QuickPickOutfit[] | null>(null);
  const [savedIndexes, setSavedIndexes] = useState<number[]>([]);
  const [savingIndex, setSavingIndex] = useState<number | null>(null);
  const [saveErrors, setSaveErrors] = useState<Record<number, string>>({});
  const [authModalOpen, setAuthModalOpen] = useState(false);
  // The save that was interrupted by the login prompt, retried after sign-in.
  const pendingSaveRef = useRef<number | null>(null);
  // Only the latest pick's response is shown.
  const requestIdRef = useRef(0);

  const setSaveError = (index: number, message: string | null) =>
    setSaveErrors((prev) => {
      const next = { ...prev };
      if (message) next[index] = message;
      else delete next[index];
      return next;
    });

  const saveOutfit = async (outfit: QuickPickOutfit, index: number) => {
    setSavingIndex(index);
    setSaveError(index, null);
    try {
      const res = await fetch('/api/user/outfits', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: occasionLabel ? `${occasionLabel} Look` : 'Quick Pick Outfit',
          garmentIds: outfitPieces(outfit).map((p) => p.item.id),
          // Same context as the shown score; the server recomputes it.
          occasionSlug: occasionSlug ?? undefined,
          profile: normalizedProfile(),
        }),
      });

      if (res.status === 401) {
        pendingSaveRef.current = index;
        setAuthModalOpen(true);
        return;
      }

      if (res.ok) {
        setSavedIndexes((prev) => [...prev, index]);
      } else {
        const data = await res.json().catch(() => ({}));
        setSaveError(index, data.error || 'Could not save this outfit — please try again.');
      }
    } catch (err) {
      console.error(err);
      setSaveError(index, 'Could not save this outfit — check your connection and try again.');
    } finally {
      setSavingIndex(null);
    }
  };

  // Saved/error marks are per result index, so they never carry over to new results.
  const clearSaveState = () => {
    setSavedIndexes([]);
    setSaveErrors({});
    pendingSaveRef.current = null;
  };

  const pick = async (slug: string, label: string) => {
    const requestId = ++requestIdRef.current;
    setLoading(true);
    setError(null);
    setOutfits(null);
    clearSaveState();
    setOccasionLabel(label);
    setOccasionSlug(slug);
    try {
      const res = await fetch('/api/outfit/quick-pick', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ occasionSlug: slug, profile: normalizedProfile(), localDate: localDate() }),
      });
      const data = await res.json().catch(() => ({}));
      if (requestId !== requestIdRef.current) return;
      if (!res.ok) {
        setError(data.error || 'Something went wrong.');
      } else {
        clearSaveState();
        setOutfits(data.outfits ?? []);
      }
    } catch {
      if (requestId !== requestIdRef.current) return;
      setError('Something went wrong — try again.');
    } finally {
      if (requestId === requestIdRef.current) setLoading(false);
    }
  };

  const reset = () => {
    requestIdRef.current++;
    setLoading(false);
    clearSaveState();
    setOutfits(null);
    setError(null);
    setOccasionLabel(null);
    setOccasionSlug(null);
  };

  return (
    <div className="w-full px-4 sm:px-6 py-12 bg-slate-50 dark:bg-zinc-950 min-h-screen transition-colors duration-300">
      <div className="max-w-2xl mx-auto space-y-8">
        <div className="text-center space-y-3">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/10 text-amber-700 dark:text-amber-400 text-xs font-bold uppercase tracking-wider border border-amber-200 dark:border-amber-900/50">
            <Sparkles className="w-3.5 h-3.5" />
            Quick Pick
          </div>
          <h1 className="text-3xl md:text-4xl font-extrabold text-slate-900 dark:text-white">
            What are you doing today?
          </h1>
          <p className="text-slate-600 dark:text-zinc-400 text-base">
            Tap one — we&apos;ll hand you a complete outfit, no questions asked.
          </p>
        </div>

        {!outfits && !loading && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {OCCASIONS.map((occ) => (
              <SelectableCard
                key={occ.slug}
                selected={occasionSlug === occ.slug}
                onSelect={() => pick(occ.slug, occ.label)}
                className="hover:border-amber-500 hover:shadow-xl transition-all p-6 text-center bg-white dark:bg-zinc-900 border-slate-200 dark:border-zinc-800"
              >
                <occ.icon className="w-8 h-8 text-amber-600 dark:text-amber-400 mx-auto mb-3" />
                <CardTitle className="text-base text-slate-900 dark:text-white mb-1">{occ.label}</CardTitle>
                <p className="text-xs text-slate-500 dark:text-zinc-400">{occ.description}</p>
              </SelectableCard>
            ))}
          </div>
        )}

        {loading && (
          <Card className="p-12 text-center bg-white dark:bg-zinc-900 border-slate-200 dark:border-zinc-800">
            <div className="w-12 h-12 rounded-full border-4 border-amber-600 border-t-transparent animate-spin mx-auto mb-4" />
            <p className="text-slate-600 dark:text-zinc-400 font-medium">Picking your outfit...</p>
          </Card>
        )}

        {error && (
          <Card className="p-6 text-center bg-white dark:bg-zinc-900 border-rose-200 dark:border-rose-900/50">
            <p className="text-sm font-semibold text-rose-600 dark:text-rose-400">{error}</p>
            <Button variant="outline" size="sm" onClick={reset} className="mt-4">
              Try Again
            </Button>
          </Card>
        )}

        {outfits && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                For: {occasionLabel}
              </h2>
              <Button variant="outline" size="sm" onClick={reset}>
                <RotateCcw className="w-3.5 h-3.5" /> Start Over
              </Button>
            </div>

            {outfits.length === 0 && (
              <Card className="p-8 text-center bg-white dark:bg-zinc-900 border-slate-200 dark:border-zinc-800">
                <p className="text-slate-600 dark:text-zinc-400">
                  Not enough catalog items yet to build a full outfit for this occasion.
                </p>
              </Card>
            )}

            {outfits.map((outfit, i) => {
              const isSaved = savedIndexes.includes(i);
              const isSaving = savingIndex === i;

              return (
                <Card key={i} className="p-5 bg-white dark:bg-zinc-900 border-slate-200 dark:border-zinc-800 space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-bold text-slate-500 dark:text-zinc-400">
                      {i === 0 ? 'Top Pick' : `Option ${i + 1}`}
                    </span>
                    <Badge variant={outfit.score >= 85 ? 'excellent' : outfit.score >= 70 ? 'good' : 'acceptable'}>
                      {outfit.score}% Match
                    </Badge>
                  </div>
                  <div className="flex flex-wrap gap-4">
                    {outfitPieces(outfit).map(({ category, item }) =>
                      // The person's own garments have no encyclopedia page.
                      item.isOwn ? (
                        <div
                          key={item.id}
                          className="flex items-center gap-3 bg-slate-50 dark:bg-zinc-800/60 rounded-xl p-3 flex-1 min-w-[10rem]"
                        >
                          <GarmentIllustration category={category} colors={item.colors} size={40} />
                          <div>
                            <span className="text-sm font-bold text-slate-900 dark:text-white block">{item.name}</span>
                            <span className="text-[10px] text-slate-400 dark:text-zinc-500">From your closet</span>
                          </div>
                        </div>
                      ) : (
                        <Link
                          key={item.id}
                          href={item.slug ? `/encyclopedia/${item.slug}` : '/encyclopedia'}
                          className="flex items-center gap-3 bg-slate-50 dark:bg-zinc-800/60 rounded-xl p-3 flex-1 min-w-[10rem] hover:ring-2 hover:ring-amber-500/30 transition-all group"
                        >
                          <GarmentIllustration category={category} colors={item.colors} size={40} />
                          <div>
                            <span className="text-sm font-bold text-slate-900 dark:text-white group-hover:text-amber-600 dark:group-hover:text-amber-400 transition-colors block">
                              {item.name}
                            </span>
                            <span className="text-[10px] text-slate-400 dark:text-zinc-500">View details →</span>
                          </div>
                        </Link>
                      )
                    )}
                  </div>

                  {outfit.highlights?.[0] && (
                    <p className="text-xs font-medium text-emerald-700 dark:text-emerald-400">{outfit.highlights[0]}</p>
                  )}

                  <OutfitActions
                    garmentIds={outfitPieces(outfit).map((p) => p.item.id)}
                    score={outfit.score}
                    onRequireLogin={() => setAuthModalOpen(true)}
                  />

                  <div className="flex items-center justify-end gap-3 pt-2 border-t border-slate-100 dark:border-zinc-800">
                    {saveErrors[i] && (
                      <p role="alert" className="text-xs font-medium text-rose-600 dark:text-rose-400">
                        {saveErrors[i]}
                      </p>
                    )}
                    <Button
                      variant={isSaved ? 'outline' : 'default'}
                      size="sm"
                      onClick={() => saveOutfit(outfit, i)}
                      disabled={isSaving || isSaved}
                      className={isSaved ? 'text-emerald-600 dark:text-emerald-400 border-emerald-300 dark:border-emerald-800' : ''}
                    >
                      {isSaved ? (
                        <>
                          <Check className="w-3.5 h-3.5 mr-1.5" /> Saved to Closet
                        </>
                      ) : isSaving ? (
                        'Saving...'
                      ) : (
                        <>
                          <Bookmark className="w-3.5 h-3.5 mr-1.5" /> Save to My Closet
                        </>
                      )}
                    </Button>
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      <AuthModal
        isOpen={authModalOpen}
        onClose={() => setAuthModalOpen(false)}
        onSuccess={() => {
          setAuthModalOpen(false);
          // Now signed in: retry the save that asked for login. (The session
          // cookie is set, so the request re-checks auth on the server.)
          const index = pendingSaveRef.current;
          pendingSaveRef.current = null;
          if (index !== null && outfits && outfits[index]) {
            void saveOutfit(outfits[index], index);
          }
        }}
      />
    </div>
  );
}
