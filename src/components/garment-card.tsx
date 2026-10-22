import Link from 'next/link';
import { StarRating } from '@/components/star-rating';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { GarmentIllustration } from '@/components/garment-illustration';

// Fuzzy-matched (like CategoryIcon/GarmentIllustration) instead of an
// exact-match lookup table, so new garment types (T-Shirt, Polo Shirt,
// Sweater, Cardigan, Hoodie, Tie, Pocket Square, ...) get a real themed
// gradient instead of silently falling back to the "shirt" color scheme.
function gradientForType(garmentType: string): string {
  const t = garmentType.toLowerCase();
  if (t.includes('trouser') || t.includes('pant') || t.includes('chino') || t.includes('jean') || t.includes('short'))
    return 'from-emerald-500/10 to-teal-500/10 dark:from-emerald-500/20 dark:to-teal-500/20 border-emerald-200 dark:border-emerald-900/40 text-emerald-700 dark:text-emerald-400';
  if (t.includes('shoe') || t.includes('boot') || t.includes('loafer') || t.includes('sneaker'))
    return 'from-blue-500/10 to-cyan-500/10 dark:from-blue-500/20 dark:to-cyan-500/20 border-blue-200 dark:border-blue-900/40 text-blue-700 dark:text-blue-400';
  if (t.includes('belt'))
    return 'from-rose-500/10 to-orange-500/10 dark:from-rose-500/20 dark:to-orange-500/20 border-rose-200 dark:border-rose-900/40 text-rose-700 dark:text-rose-400';
  if (t.includes('jacket') || t.includes('blazer') || t.includes('coat') || t.includes('suit'))
    return 'from-violet-500/10 to-purple-500/10 dark:from-violet-500/20 dark:to-purple-500/20 border-violet-200 dark:border-violet-900/40 text-violet-700 dark:text-violet-400';
  if (t.includes('watch'))
    return 'from-sky-500/10 to-indigo-500/10 dark:from-sky-500/20 dark:to-indigo-500/20 border-sky-200 dark:border-sky-900/40 text-sky-700 dark:text-sky-400';
  if (t.includes('sweater') || t.includes('cardigan') || t.includes('hoodie') || t.includes('knitwear'))
    return 'from-pink-500/10 to-rose-500/10 dark:from-pink-500/20 dark:to-rose-500/20 border-pink-200 dark:border-pink-900/40 text-pink-700 dark:text-pink-400';
  if (t.includes('tie') || t.includes('pocket') || t.includes('square') || t.includes('accessory'))
    return 'from-yellow-500/10 to-amber-500/10 dark:from-yellow-500/20 dark:to-amber-500/20 border-yellow-200 dark:border-yellow-900/40 text-yellow-700 dark:text-yellow-400';
  // Shirt / T-Shirt / Polo Shirt / Top — default
  return 'from-amber-500/10 to-orange-500/10 dark:from-amber-500/20 dark:to-orange-500/20 border-amber-200 dark:border-amber-900/40 text-amber-700 dark:text-amber-400';
}

interface GarmentCardProps {
  name: string;
  slug: string;
  garmentType: string;
  formalityLevel: number;
  colors: { name: string; hex: string }[];
  imageUrl?: string;
  rating?: number;
  compatibilityType?: string;
  reason?: string;
  // false for items without a public encyclopedia page (a user's own items)
  linkable?: boolean;
  badge?: string;
}

export function GarmentCard({
  name,
  slug,
  garmentType,
  formalityLevel,
  colors,
  rating,
  compatibilityType,
  reason,
  linkable = true,
  badge,
}: GarmentCardProps) {
  const styleClass = gradientForType(garmentType);

  const card = (
      <Card className="group hover:border-amber-500/50 hover:shadow-xl hover:-translate-y-1 transition-all duration-300 overflow-hidden h-full bg-white dark:bg-zinc-900 border border-slate-200/90 dark:border-zinc-800 flex flex-col justify-between">
        {/* Header: colored garment illustration in the item's actual color(s) */}
        <div className={`h-28 bg-gradient-to-br ${styleClass} p-4 flex items-center justify-center relative overflow-hidden border-b`}>
          <div className="p-2 rounded-2xl bg-white/90 dark:bg-zinc-950/90 backdrop-blur-md shadow-md group-hover:scale-110 transition-transform duration-500">
            <GarmentIllustration category={garmentType} colors={colors} size={56} />
          </div>

          {badge && (
            <div className="absolute top-2 left-2">
              <Badge variant="outline" className="bg-white/90 dark:bg-zinc-950/80 text-xs">{badge}</Badge>
            </div>
          )}
          {compatibilityType && (
            <div className="absolute top-2 right-2">
              <Badge variant={compatibilityType as 'excellent' | 'good' | 'acceptable' | 'avoid'}>
                {compatibilityType}
              </Badge>
            </div>
          )}
        </div>

        {/* Card Body */}
        <div className="p-4 space-y-3 flex-1 flex flex-col justify-between">
          <div>
            <span className="text-[10px] text-slate-500 dark:text-zinc-400 uppercase tracking-widest font-bold block mb-1">
              {garmentType}
            </span>
            <h3 className="font-extrabold text-slate-900 dark:text-zinc-100 group-hover:text-amber-600 dark:group-hover:text-amber-400 transition-colors line-clamp-2 text-sm md:text-base">
              {name}
            </h3>
          </div>

          {/* BOTTOM: Formality Star Rating */}
          <div className="pt-2 border-t border-slate-100 dark:border-zinc-800 flex items-center justify-between">
            <span className="text-xs text-slate-500 dark:text-zinc-400 font-semibold uppercase tracking-wider">Formality</span>
            <StarRating rating={formalityLevel} size="sm" />
          </div>

          {/* Optional Expert Score & Reason */}
          {rating !== undefined && (
            <div className="pt-2 border-t border-slate-100 dark:border-zinc-800">
              <div className="flex items-center gap-2">
                <StarRating rating={rating} size="sm" showValue />
              </div>
              {reason && (
                <p className="text-xs text-slate-600 dark:text-zinc-400 mt-1 line-clamp-2 italic">&ldquo;{reason}&rdquo;</p>
              )}
            </div>
          )}
        </div>
      </Card>
  );
  return linkable ? <Link href={`/encyclopedia/${slug}`}>{card}</Link> : card;
}
