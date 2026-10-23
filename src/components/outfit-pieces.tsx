import Link from 'next/link';
import { GarmentIllustration } from '@/components/garment-illustration';

export interface OutfitPiece {
  id: string;
  name: string;
  slug?: string;
  typeSlug?: string;
  colors: { name: string; hex: string }[];
  /** The person's own (private) garment — no encyclopedia page. */
  isOwn?: boolean;
}

/** API outfit shape (quick pick, daily suggestion, complete my outfit). */
export interface SuggestedOutfit {
  score: number;
  rating?: string;
  /** False when nothing could be judged — don't show the number. */
  scorable?: boolean;
  shirt: OutfitPiece;
  trouser: OutfitPiece;
  shoe: OutfitPiece;
  layer: OutfitPiece | null;
  belt: OutfitPiece | null;
  /** Locked accessories other than the belt (tie, watch...). May be missing. */
  accessories?: OutfitPiece[];
  highlights?: string[];
  suggestions?: string[];
}

/** Pieces in wearing order; layer, belt and accessories only when present. */
export function piecesOf(o: SuggestedOutfit): OutfitPiece[] {
  return [o.shirt, o.layer, o.trouser, o.shoe, o.belt, ...(o.accessories ?? [])].filter(
    (p): p is OutfitPiece => !!p
  );
}

const categoryFor = (p: OutfitPiece, fallback: string) => p.typeSlug || fallback;

/**
 * An outfit's pieces as small cards. Catalog items link to their encyclopedia
 * page; a user's own items (private, no slug) render without a link.
 */
export function OutfitPieces({ pieces, size = 40 }: { pieces: OutfitPiece[]; size?: number }) {
  return (
    <div className="flex flex-wrap gap-3">
      {pieces.map((item) => {
        const linkable = !!item.slug && !item.isOwn;
        const body = (
          <>
            <GarmentIllustration category={categoryFor(item, 'shirt')} colors={item.colors} size={size} />
            <div className="min-w-0">
              <span className="text-sm font-bold text-slate-900 dark:text-white block max-w-44 truncate group-hover:text-amber-600 transition-colors">
                {item.name}
              </span>
              <span className="text-[10px] text-slate-400 dark:text-zinc-500">{linkable ? 'View details →' : 'Your item'}</span>
            </div>
          </>
        );
        const className =
          'flex items-center gap-3 bg-white dark:bg-zinc-900 rounded-xl p-3 border border-slate-200 dark:border-zinc-800 shadow-2xs transition-colors group';
        return linkable ? (
          <Link key={item.id} href={`/encyclopedia/${item.slug}`} className={`${className} hover:border-amber-500`}>
            {body}
          </Link>
        ) : (
          <div key={item.id} className={className}>
            {body}
          </div>
        );
      })}
    </div>
  );
}
