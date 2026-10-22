'use client';

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';

interface OutfitScoreDisplayProps {
  totalScore: number;
  breakdown: {
    colorHarmony: number;
    garmentCompatibility: number;
    occasionMatch: number;
    seasonSuitability: number;
    bodyTypeSuitability: number;
    skinToneSuitability: number;
  };
  // Which dimensions actually counted. Dimensions that don't apply (no
  // occasion picked, no profile saved) are left out of the total entirely.
  dimensions?: Record<string, { score: number; max: number; applied: boolean; note?: string }>;
  rating: string;
  suggestions?: string[];
  highlights?: string[];
  className?: string;
}

const dimensionLabels: Record<string, { label: string; max: number; color: string }> = {
  colorHarmony: { label: 'Color Harmony', max: 30, color: 'from-purple-600 to-indigo-600' },
  garmentCompatibility: { label: 'Garment Compatibility', max: 25, color: 'from-blue-600 to-cyan-600' },
  occasionMatch: { label: 'Occasion Match', max: 15, color: 'from-emerald-600 to-teal-600' },
  seasonSuitability: { label: 'Season Suitability', max: 10, color: 'from-amber-600 to-orange-600' },
  bodyTypeSuitability: { label: 'Body Type', max: 10, color: 'from-rose-600 to-pink-600' },
  skinToneSuitability: { label: 'Skin Tone', max: 10, color: 'from-amber-600 to-red-600' },
};

export function OutfitScoreDisplay({
  totalScore,
  breakdown,
  dimensions,
  rating,
  suggestions = [],
  highlights = [],
  className,
}: OutfitScoreDisplayProps) {
  const safeTotalScore = Number.isNaN(Number(totalScore)) ? 0 : Number(totalScore);
  const [animatedScore, setAnimatedScore] = useState(0);

  useEffect(() => {
    const duration = 1500;
    const startTime = Date.now();
    const animate = () => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      const calculated = Math.round(eased * safeTotalScore);
      setAnimatedScore(Number.isNaN(calculated) ? 0 : calculated);
      if (progress < 1) requestAnimationFrame(animate);
    };
    requestAnimationFrame(animate);
  }, [safeTotalScore]);

  const ratingColors: Record<string, string> = {
    excellent: 'text-emerald-700 dark:text-emerald-400',
    good: 'text-blue-700 dark:text-blue-400',
    risky: 'text-amber-700 dark:text-amber-400',
    avoid: 'text-red-700 dark:text-red-400',
  };

  const circumference = 2 * Math.PI * 54;
  const strokeOffset = circumference - (animatedScore / 100) * circumference;

  return (
    <div className={cn('flex flex-col items-center gap-6', className)}>
      {/* Circular Score */}
      <div className="relative w-40 h-40">
        <svg className="w-full h-full -rotate-90" viewBox="0 0 120 120">
          <circle
            cx="60"
            cy="60"
            r="54"
            fill="none"
            className="stroke-slate-200 dark:stroke-zinc-800"
            strokeWidth="8"
          />
          <circle
            cx="60"
            cy="60"
            r="54"
            fill="none"
            stroke="url(#scoreGradient)"
            strokeWidth="8"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={strokeOffset}
            className="transition-all duration-1000 ease-out"
          />
          <defs>
            <linearGradient id="scoreGradient" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#d97706" />
              <stop offset="100%" stopColor="#ea580c" />
            </linearGradient>
          </defs>
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-4xl font-extrabold text-slate-900 dark:text-white">{animatedScore}</span>
          <span className="text-xs text-slate-500 dark:text-zinc-400 uppercase tracking-widest font-semibold">/ 100</span>
        </div>
      </div>

      {/* Rating label */}
      <span className={cn('text-lg font-bold capitalize', ratingColors[rating])}>
        {rating} Outfit
      </span>

      {/* Breakdown bars */}
      <div className="w-full max-w-md space-y-3">
        {Object.entries(breakdown).map(([key, value]) => {
          const dim = dimensionLabels[key];
          if (!dim) return null;
          const detail = dimensions?.[key];
          if (detail && !detail.applied) {
            return (
              <div key={key} className="space-y-1 opacity-70">
                <div className="flex justify-between text-sm">
                  <span className="text-slate-500 dark:text-zinc-500 font-medium">{dim.label}</span>
                  <span className="text-xs text-slate-500 dark:text-zinc-500 font-semibold">Not included</span>
                </div>
                {detail.note && <p className="text-xs text-slate-500 dark:text-zinc-500">{detail.note}</p>}
              </div>
            );
          }
          const percentage = (value / dim.max) * 100;
          return (
            <div key={key} className="space-y-1">
              <div className="flex justify-between text-sm">
                <span className="text-slate-600 dark:text-zinc-400 font-medium">{dim.label}</span>
                <span className="text-slate-900 dark:text-white font-bold">
                  {value}/{dim.max}
                </span>
              </div>
              <div className="h-2 bg-slate-200 dark:bg-zinc-800 rounded-full overflow-hidden">
                <div
                  className={cn('h-full rounded-full bg-gradient-to-r transition-all duration-1000 ease-out', dim.color)}
                  style={{ width: `${percentage}%` }}
                />
              </div>
              {detail?.note && <p className="text-xs text-slate-500 dark:text-zinc-400">{detail.note}</p>}
            </div>
          );
        })}
      </div>

      {highlights.length > 0 && (
        <div className="w-full max-w-md p-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/25 border border-emerald-200 dark:border-emerald-900/40">
          <h4 className="text-sm font-bold text-emerald-900 dark:text-emerald-300 mb-2">What works</h4>
          <ul className="space-y-1">
            {highlights.map((h, i) => (
              <li key={i} className="text-sm text-emerald-800 dark:text-emerald-200/90">
                {h}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Suggestions */}
      {suggestions.length > 0 && (
        <div className="w-full max-w-md mt-4 p-4 rounded-xl bg-amber-50 dark:bg-amber-950/25 border border-amber-200 dark:border-amber-900/40">
          <h4 className="text-sm font-bold text-amber-900 dark:text-amber-300 mb-2">💡 Suggestions</h4>
          <ul className="space-y-1">
            {suggestions.map((s, i) => (
              <li key={i} className="text-sm text-amber-800 dark:text-amber-200/90 flex items-start gap-2">
                <span className="text-amber-600 dark:text-amber-400 font-bold mt-0.5">•</span>
                {s}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
