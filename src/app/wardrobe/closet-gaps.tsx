'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ShoppingBag } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { GarmentIllustration } from '@/components/garment-illustration';
import { loadStyleProfile } from '@/lib/style-profile';

interface GapSuggestion {
  id: string;
  name: string;
  slug: string;
  typeSlug: string;
  colors: { name: string; hex: string }[];
  newOutfits: number;
  goodPairs: number;
  pairsWith: string[];
}

/** "What should I buy next?" — the items that unlock the most new outfits. */
export function ClosetGaps({ garmentIds }: { garmentIds: string[] }) {
  const [result, setResult] = useState<{ currentGoodOutfits: number; suggestions: GapSuggestion[] } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const analyse = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/wardrobe/gaps', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ garmentIds, profile: loadStyleProfile() ?? undefined }),
      });
      const data = await res.json();
      if (!res.ok) setError(data.error || 'Could not analyse your closet.');
      else setResult(data);
    } catch {
      setError('Could not analyse your closet — check your connection.');
    }
    setLoading(false);
  };

  return (
    <Card className="bg-white dark:bg-zinc-900 border-slate-200 dark:border-zinc-800">
      <CardContent className="p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
              <ShoppingBag className="w-5 h-5 text-amber-600" /> What should I buy next?
            </h2>
            <p className="text-sm text-slate-600 dark:text-zinc-400">
              The pieces that would unlock the most new outfits with what you already own.
            </p>
          </div>
          <Button variant="outline" onClick={analyse} disabled={loading || garmentIds.length === 0}>
            {loading ? 'Analysing...' : result ? 'Refresh' : 'Analyse my closet'}
          </Button>
        </div>

        {error && <p className="text-sm text-rose-600 dark:text-rose-400">{error}</p>}

        {result && (
          <>
            <p className="text-sm text-slate-600 dark:text-zinc-400">
              Right now you can make <strong className="text-slate-900 dark:text-white">{result.currentGoodOutfits}</strong> strong
              shirt-trouser-shoe outfit{result.currentGoodOutfits === 1 ? '' : 's'}.
            </p>
            {result.suggestions.length === 0 ? (
              <p className="text-sm text-slate-500 dark:text-zinc-400">Your closet already covers the catalog well — nothing stands out.</p>
            ) : (
              <ol className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {result.suggestions.map((s) => (
                  <li key={s.id}>
                    <Link
                      href={`/encyclopedia/${s.slug}`}
                      className="flex items-start gap-3 p-3 rounded-xl border border-slate-200 dark:border-zinc-800 hover:border-amber-500 transition-colors"
                    >
                      <GarmentIllustration category={s.typeSlug} colors={s.colors} size={44} />
                      <div className="min-w-0">
                        <p className="text-sm font-bold text-slate-900 dark:text-white">{s.name}</p>
                        <p className="text-xs font-semibold text-emerald-700 dark:text-emerald-400">
                          {s.newOutfits > 0
                            ? `+${s.newOutfits} new outfit${s.newOutfits === 1 ? '' : 's'}`
                            : `Pairs well with ${s.goodPairs} of your pieces`}
                        </p>
                        {s.pairsWith.length > 0 && (
                          <p className="text-xs text-slate-500 dark:text-zinc-400 truncate">With: {s.pairsWith.join(', ')}</p>
                        )}
                      </div>
                    </Link>
                  </li>
                ))}
              </ol>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
