import { Card, CardTitle } from '@/components/ui/card';
import { GarmentIllustration } from '@/components/garment-illustration';
import { StarRating } from '@/components/star-rating';

export interface GarmentOption {
  id: string;
  name: string;
  slug: string;
  formalityLevel: number;
  garmentType: string;
  colors: { name: string; hex: string }[];
}

const ACCENTS = {
  amber: 'bg-amber-500/10 border-amber-200 dark:border-amber-900/40',
  purple: 'bg-purple-500/10 border-purple-200 dark:border-purple-900/40',
  emerald: 'bg-emerald-500/10 border-emerald-200 dark:border-emerald-900/40',
  blue: 'bg-blue-500/10 border-blue-200 dark:border-blue-900/40',
} as const;

/**
 * One selectable card per garment, used by every builder step (shirt, layer,
 * trouser, shoe, belt). Renders cards only — the step owns the grid, so it can
 * put a "skip" card first.
 */
export function GarmentChoiceCards({
  items,
  selectedId,
  onSelect,
  category,
  accent,
}: {
  items: GarmentOption[];
  selectedId: string | undefined;
  onSelect: (item: GarmentOption) => void;
  category: string;
  accent: keyof typeof ACCENTS;
}) {
  return (
    <>
      {items.map((item) => {
        const selected = selectedId === item.id;
        return (
          <Card
            key={item.id}
            role="button"
            tabIndex={0}
            aria-pressed={selected}
            aria-label={`${item.name}, formality ${item.formalityLevel} of 5`}
            onClick={() => onSelect(item)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onSelect(item);
              }
            }}
            className={`cursor-pointer hover:border-amber-500 hover:shadow-xl transition-all p-5 bg-white dark:bg-zinc-900 border-slate-200 dark:border-zinc-800 flex flex-col justify-between focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 ${
              selected ? 'border-amber-600 dark:border-amber-500 ring-2 ring-amber-500/20 bg-amber-500/5' : ''
            }`}
          >
            {/* Colored garment illustration in this item's actual color(s) */}
            <div className="flex items-center justify-center mb-4">
              <div className={`p-3 rounded-xl border ${ACCENTS[accent]}`}>
                <GarmentIllustration category={category} colors={item.colors} size={48} />
              </div>
            </div>

            <CardTitle className="text-base font-extrabold text-slate-900 dark:text-white mb-3 line-clamp-2">{item.name}</CardTitle>

            <div className="pt-2 border-t border-slate-100 dark:border-zinc-800 flex items-center justify-between">
              <span className="text-xs text-slate-500 dark:text-zinc-400 font-semibold uppercase tracking-wider">Formality</span>
              <StarRating rating={item.formalityLevel} size="sm" />
            </div>
          </Card>
        );
      })}
    </>
  );
}
