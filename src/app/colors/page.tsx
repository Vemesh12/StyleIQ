import { prisma } from '@/lib/prisma';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ColorWheel } from '@/components/color-wheel';
import { ImageColorPicker } from '@/components/image-color-picker';
import { Palette, CheckCircle2, AlertTriangle } from 'lucide-react';
import { evaluateColorPairHarmony } from '@/lib/rule-engine/color-rules';
import { buildColorRuleLookup } from '@/lib/rule-engine/picker-scoring';

export const revalidate = 60;

interface DisplayPair {
  id: string;
  colorA: { name: string; hex: string };
  colorB: { name: string; hex: string };
  score: number;
  harmony: string;
  reason: string;
}

export default async function ColorGuidePage() {
  const [colorRules, allColors] = await Promise.all([
    prisma.colorCompatibilityRule.findMany({
      include: { colorA: true, colorB: true },
      orderBy: { score: 'desc' },
    }),
    prisma.color.findMany(),
  ]);

  const avoidPairs: DisplayPair[] = colorRules
    .filter((r) => r.harmony === 'avoid')
    .map((r) => ({ id: r.id, colorA: r.colorA, colorB: r.colorB, score: r.score, harmony: r.harmony, reason: r.reason }));

  // Compute pairwise harmony across the ENTIRE color palette (DB rule where
  // curated, live HSL-wheel math otherwise) so "top pairings" reflects the
  // full catalog instead of only the handful of hand-seeded rules — this
  // scales automatically as more colors are added, no re-curation needed.
  const ruleLookup = buildColorRuleLookup(colorRules);
  const allPairs: DisplayPair[] = [];
  for (let i = 0; i < allColors.length; i++) {
    for (let j = i + 1; j < allColors.length; j++) {
      const cA = allColors[i];
      const cB = allColors[j];
      const dbRule = ruleLookup.get(cA.slug, cB.slug);
      const computed = dbRule
        ? { score: dbRule.score, harmony: dbRule.harmony, reason: dbRule.reason }
        : (() => {
            const r = evaluateColorPairHarmony(cA, cB);
            return { score: r.pairScore, harmony: r.harmony, reason: r.reason };
          })();
      allPairs.push({ id: `${cA.id}-${cB.id}`, colorA: cA, colorB: cB, ...computed });
    }
  }
  allPairs.sort((a, b) => b.score - a.score);

  // Cap how many pairs of any one harmony "type" can appear, so the top list
  // isn't just neutral-anchored pairs (which mathematically always score
  // highest) crowding out genuinely varied color-wheel combinations.
  const topPairs: DisplayPair[] = [];
  const typeCounts: Record<string, number> = {};
  for (const pair of allPairs) {
    if (pair.score < 8) break;
    const count = typeCounts[pair.harmony] || 0;
    if (count >= 2) continue;
    typeCounts[pair.harmony] = count + 1;
    topPairs.push(pair);
    if (topPairs.length >= 9) break;
  }

  return (
    <div className="w-full px-4 sm:px-8 lg:px-12 py-12 bg-slate-50 dark:bg-zinc-950 min-h-screen transition-colors duration-300 space-y-12">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2 text-amber-700 dark:text-amber-400 text-sm font-semibold mb-2">
          <Palette className="w-4 h-4" />
          Color Matching Guide
        </div>
        <h1 className="text-4xl font-extrabold text-slate-900 dark:text-white mb-2">Easy Color Matching & Wheel Tool</h1>
        <p className="text-slate-600 dark:text-zinc-400 max-w-2xl text-base font-medium">
          Learn easy color matching, contrast rules, and how to pick matching pants, shirts, and shoes for any occasion.
        </p>
      </div>

      {/* AI & Camera Color Scanner */}
      <ImageColorPicker />

      {/* Interactive 360 Color Wheel Tool */}
      <ColorWheel />

      {/* 60-30-10 Rule Card */}
      <Card className="bg-white dark:bg-zinc-900 border-amber-200 dark:border-amber-900/50 p-6">
        <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-4">The 60-30-10 Simple Color Secret</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="p-4 rounded-xl bg-slate-50 dark:bg-zinc-800/80 border border-slate-200 dark:border-zinc-700 space-y-2">
            <span className="text-3xl font-extrabold text-amber-700 dark:text-amber-400">60%</span>
            <h3 className="font-bold text-slate-900 dark:text-white text-base">Main Pants or Coat Color</h3>
            <p className="text-xs text-slate-600 dark:text-zinc-400 leading-relaxed font-medium">
              Your main base item — typically your pants or coat. Use easy match colors like Navy Blue, Black, White, Cream, or Khaki.
            </p>
          </div>

          <div className="p-4 rounded-xl bg-slate-50 dark:bg-zinc-800/80 border border-slate-200 dark:border-zinc-700 space-y-2">
            <span className="text-3xl font-extrabold text-blue-700 dark:text-blue-400">30%</span>
            <h3 className="font-bold text-slate-900 dark:text-white text-base">Secondary Shirt / T-Shirt Color</h3>
            <p className="text-xs text-slate-600 dark:text-zinc-400 leading-relaxed font-medium">
              Your shirt, polo, or sweater. Creates a clean contrast with your pants.
            </p>
          </div>

          <div className="p-4 rounded-xl bg-slate-50 dark:bg-zinc-800/80 border border-slate-200 dark:border-zinc-700 space-y-2">
            <span className="text-3xl font-extrabold text-emerald-700 dark:text-emerald-400">10%</span>
            <h3 className="font-bold text-slate-900 dark:text-white text-base">Shoes & Belt Touch</h3>
            <p className="text-xs text-slate-600 dark:text-zinc-400 leading-relaxed font-medium">
              Your shoes, belt, or watch. Completes the look cleanly without looking loud.
            </p>
          </div>
        </div>
      </Card>

      {/* Top Color Pairings Grid */}
      <div className="space-y-12">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-6 flex items-center gap-2">
            <CheckCircle2 className="w-6 h-6 text-emerald-600 dark:text-emerald-400" />
            Highest Rated Color Harmonies
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {topPairs.map((rule) => (
              <Card key={rule.id} className="bg-white dark:bg-zinc-900 border-slate-200 dark:border-zinc-800">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <Badge variant="excellent">{rule.harmony.toUpperCase()}</Badge>
                    <span className="text-xs font-bold text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/50 px-2 py-1 rounded-md border border-emerald-200 dark:border-emerald-800">
                      Score: {rule.score.toFixed(1)}/10
                    </span>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between gap-4 p-3 rounded-xl bg-slate-50 dark:bg-zinc-800/80 border border-slate-200 dark:border-zinc-700">
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-full border border-slate-400 dark:border-zinc-600 shadow-xs" style={{ backgroundColor: rule.colorA.hex }} />
                      <span className="text-sm font-bold text-slate-900 dark:text-white">{rule.colorA.name}</span>
                    </div>
                    <span className="text-slate-400 dark:text-zinc-500 font-bold">+</span>
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-full border border-slate-400 dark:border-zinc-600 shadow-xs" style={{ backgroundColor: rule.colorB.hex }} />
                      <span className="text-sm font-bold text-slate-900 dark:text-white">{rule.colorB.name}</span>
                    </div>
                  </div>
                  <p className="text-xs text-slate-600 dark:text-zinc-400 italic font-medium">&ldquo;{rule.reason}&rdquo;</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>

        {/* Avoid Pairs */}
        {avoidPairs.length > 0 && (
          <div>
            <h2 className="text-2xl font-bold text-red-800 dark:text-red-400 mb-6 flex items-center gap-2">
              <AlertTriangle className="w-6 h-6 text-red-600 dark:text-red-400" />
              Colors to Avoid Pairing
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {avoidPairs.map((rule) => (
                <Card key={rule.id} className="bg-white dark:bg-zinc-900 border-red-200 dark:border-red-900/50">
                  <CardHeader className="pb-3">
                    <Badge variant="avoid">CLASHING</Badge>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex items-center justify-between gap-4 p-3 rounded-xl bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900/50">
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-full border border-slate-400 dark:border-zinc-600 shadow-xs" style={{ backgroundColor: rule.colorA.hex }} />
                        <span className="text-sm font-bold text-slate-900 dark:text-white">{rule.colorA.name}</span>
                      </div>
                      <span className="text-red-400 font-bold">+</span>
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-full border border-slate-400 dark:border-zinc-600 shadow-xs" style={{ backgroundColor: rule.colorB.hex }} />
                        <span className="text-sm font-bold text-slate-900 dark:text-white">{rule.colorB.name}</span>
                      </div>
                    </div>
                    <p className="text-xs text-slate-600 dark:text-zinc-400 italic font-medium">&ldquo;{rule.reason}&rdquo;</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
