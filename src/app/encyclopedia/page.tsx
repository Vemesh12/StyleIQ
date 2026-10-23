import { prisma } from '@/lib/prisma';
import { Prisma } from '@prisma/client';
import { GarmentCard } from '@/components/garment-card';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { BookOpen, Filter, Shirt } from 'lucide-react';
import Link from 'next/link';

export const revalidate = 60;

interface PageProps {
  searchParams: Promise<{ type?: string; color?: string; occasion?: string; q?: string; page?: string }>;
}

// Rendering every garment card at once produced ~1.9 MB of HTML; pages of
// 24 keep the page light.
const PAGE_SIZE = 24;

type Filters = { type?: string; color?: string; occasion?: string; q?: string; page?: number };

/** Builds an /encyclopedia URL from filters, dropping empty ones. */
function encyclopediaHref(filters: Filters): string {
  const qs = new URLSearchParams();
  for (const [key, value] of Object.entries(filters)) {
    if (value !== undefined && value !== '' && !(key === 'page' && value === 1)) qs.set(key, String(value));
  }
  const query = qs.toString();
  return query ? `/encyclopedia?${query}` : '/encyclopedia';
}

export default async function EncyclopediaPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const typeFilter = params.type;
  const colorFilter = params.color;
  const occasionFilter = params.occasion;
  const searchQuery = params.q?.trim() || undefined;
  const page = Math.max(1, parseInt(params.page || '1') || 1);
  const current: Filters = { type: typeFilter, color: colorFilter, occasion: occasionFilter, q: searchQuery };

  const [types, colors, occasions] = await Promise.all([
    prisma.garmentType.findMany({ orderBy: { name: 'asc' } }),
    // Only colors some garment actually uses — listing all ~210 palette
    // colors made a long filter of mostly empty results.
    prisma.color.findMany({ where: { garmentColors: { some: { garment: { ownerId: null } } } }, orderBy: { name: 'asc' } }),
    prisma.occasion.findMany({ orderBy: { formalityLevel: 'desc' } }),
  ]);

  // Catalog only — users' own items are private.
  const where: Prisma.GarmentWhereInput = { ownerId: null };
  if (typeFilter) {
    where.garmentType = { slug: typeFilter };
  }
  if (colorFilter) {
    where.colors = { some: { color: { slug: colorFilter } } };
  }
  if (occasionFilter) {
    where.occasions = { some: { occasion: { slug: occasionFilter } } };
  }
  if (searchQuery) {
    // Case-insensitive: "linen" should find "White Linen Shirt".
    where.OR = [
      { name: { contains: searchQuery, mode: 'insensitive' } },
      { description: { contains: searchQuery, mode: 'insensitive' } },
    ];
  }

  const [total, garments] = await Promise.all([
    prisma.garment.count({ where }),
    prisma.garment.findMany({
      where,
      include: {
        garmentType: true,
        colors: { include: { color: true }, where: { isPrimary: true } },
      },
      orderBy: [{ formalityLevel: 'desc' }, { name: 'asc' }],
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
  ]);
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="w-full px-4 sm:px-8 lg:px-12 py-12 bg-slate-50 dark:bg-zinc-950 min-h-screen transition-colors duration-300">
      {/* Header & Search Bar */}
      <div className="mb-8 flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-amber-700 dark:text-amber-400 text-sm font-semibold mb-2">
            <BookOpen className="w-4 h-4" />
            Clothes & Styles Directory ({total} Items)
          </div>
          <h1 className="text-4xl font-extrabold text-slate-900 dark:text-white mb-2">Clothing Encyclopedia</h1>
          <p className="text-slate-600 dark:text-zinc-400 max-w-2xl text-base font-medium">
            Browse all types of shirts, pants, shoes, coats, and belts with simple guidelines and color matching ideas.
          </p>
        </div>

        {/* Search Bar */}
        <form action="/encyclopedia" method="GET" role="search" className="w-full md:w-80 shrink-0">
          <label htmlFor="encyclopedia-search" className="sr-only">
            Search the encyclopedia
          </label>
          <div className="relative">
            <input
              id="encyclopedia-search"
              // Remount when the query changes (e.g. "Clear All"), so the
              // uncontrolled input doesn't keep showing the old search text.
              key={searchQuery || ''}
              type="search"
              name="q"
              defaultValue={searchQuery || ''}
              placeholder="Search clothes (e.g. Linen, Chinos, Boots)..."
              className="w-full pl-4 pr-10 py-2.5 rounded-xl border border-slate-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 shadow-2xs"
            />
            {typeFilter && <input type="hidden" name="type" value={typeFilter} />}
            {colorFilter && <input type="hidden" name="color" value={colorFilter} />}
            {occasionFilter && <input type="hidden" name="occasion" value={occasionFilter} />}
            <button type="submit" aria-label="Search" className="absolute right-3 top-3 text-slate-400 hover:text-slate-600 dark:hover:text-zinc-200">
              <span aria-hidden="true">🔍</span>
            </button>
          </div>
        </form>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Sidebar Filters */}
        <div className="lg:col-span-3 space-y-6">
          <Card className="bg-white dark:bg-zinc-900 border-slate-200 dark:border-zinc-800 shadow-2xs">
            <CardHeader className="pb-3 border-b border-slate-100 dark:border-zinc-800">
              <CardTitle className="flex items-center justify-between text-base text-slate-900 dark:text-white">
                <span className="flex items-center gap-2">
                  <Filter className="w-4 h-4 text-amber-600 dark:text-amber-400" /> Filters
                </span>
                {(typeFilter || colorFilter || occasionFilter || searchQuery) && (
                  <Link href="/encyclopedia" className="text-xs text-amber-700 dark:text-amber-400 hover:underline font-semibold">
                    Clear All
                  </Link>
                )}
              </CardTitle>
            </CardHeader>

            <CardContent className="space-y-6 pt-4">
              {/* Type filter */}
              <div className="space-y-2">
                <h3 className="text-xs font-bold text-slate-500 dark:text-zinc-400 uppercase tracking-wider">Garment Category</h3>
                <div className="flex flex-wrap gap-1.5">
                  <Link href={encyclopediaHref({ ...current, type: undefined })}>
                    <Badge variant={!typeFilter ? 'default' : 'outline'} className="cursor-pointer">
                      All Types
                    </Badge>
                  </Link>
                  {types.map((t) => (
                    <Link key={t.id} href={encyclopediaHref({ ...current, type: t.slug })}>
                      <Badge variant={typeFilter === t.slug ? 'default' : 'outline'} className="cursor-pointer">
                        {t.name}
                      </Badge>
                    </Link>
                  ))}
                </div>
              </div>

              {/* Color filter */}
              <div className="space-y-2">
                <h3 className="text-xs font-bold text-slate-500 dark:text-zinc-400 uppercase tracking-wider">
                  Color {colorFilter && <span className="text-amber-600 dark:text-amber-400">(1 selected)</span>}
                </h3>
                <div className="flex flex-wrap gap-1.5 max-h-64 overflow-y-auto pr-1">
                  <Link href={encyclopediaHref({ ...current, color: undefined })}>
                    <Badge variant={!colorFilter ? 'default' : 'outline'} className="cursor-pointer">
                      All Colors
                    </Badge>
                  </Link>
                  {colors.map((c) => (
                    <Link key={c.id} href={encyclopediaHref({ ...current, color: c.slug })}>
                      <Badge
                        variant={colorFilter === c.slug ? 'default' : 'outline'}
                        className="cursor-pointer gap-1.5"
                      >
                        <span
                          className="w-3 h-3 rounded-full border border-slate-300 dark:border-zinc-600 inline-block shadow-2xs"
                          style={{ backgroundColor: c.hex }}
                        />
                        {c.name}
                      </Badge>
                    </Link>
                  ))}
                </div>
              </div>

              {/* Occasion filter */}
              <div className="space-y-2">
                <h3 className="text-xs font-bold text-slate-500 dark:text-zinc-400 uppercase tracking-wider">Occasion</h3>
                <div className="flex flex-wrap gap-1.5">
                  <Link href={encyclopediaHref({ ...current, occasion: undefined })}>
                    <Badge variant={!occasionFilter ? 'default' : 'outline'} className="cursor-pointer">
                      All Occasions
                    </Badge>
                  </Link>
                  {occasions.map((o) => (
                    <Link key={o.id} href={encyclopediaHref({ ...current, occasion: o.slug })}>
                      <Badge variant={occasionFilter === o.slug ? 'default' : 'outline'} className="cursor-pointer">
                        {o.name}
                      </Badge>
                    </Link>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Main Catalogue Grid */}
        <div className="lg:col-span-9">
          <div className="flex items-center justify-between mb-4">
            <span className="text-sm text-slate-600 dark:text-zinc-400 font-semibold">
              Showing <span className="text-slate-900 dark:text-white font-bold">{garments.length}</span> of{' '}
              <span className="text-slate-900 dark:text-white font-bold">{total}</span> garments
              {pageCount > 1 && ` — page ${page} of ${pageCount}`}
            </span>
          </div>

          {garments.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
              {garments.map((garment) => (
                <GarmentCard
                  key={garment.id}
                  name={garment.name}
                  slug={garment.slug}
                  garmentType={garment.garmentType.name}
                  formalityLevel={garment.formalityLevel}
                  colors={garment.colors.map((gc) => ({
                    name: gc.color.name,
                    hex: gc.color.hex,
                  }))}
                />
              ))}
            </div>
          ) : null}

          {pageCount > 1 && (
            <nav aria-label="Encyclopedia pages" className="flex items-center justify-center gap-3 pt-8">
              {page > 1 ? (
                <Link href={encyclopediaHref({ ...current, page: page - 1 })} rel="prev">
                  <Badge variant="outline" className="cursor-pointer py-1.5 px-4">← Previous</Badge>
                </Link>
              ) : (
                <Badge variant="outline" className="py-1.5 px-4 opacity-40" aria-disabled="true">← Previous</Badge>
              )}
              <span className="text-sm text-slate-600 dark:text-zinc-400 font-semibold">
                Page {page} of {pageCount}
              </span>
              {page < pageCount ? (
                <Link href={encyclopediaHref({ ...current, page: page + 1 })} rel="next">
                  <Badge variant="outline" className="cursor-pointer py-1.5 px-4">Next →</Badge>
                </Link>
              ) : (
                <Badge variant="outline" className="py-1.5 px-4 opacity-40" aria-disabled="true">Next →</Badge>
              )}
            </nav>
          )}

          {garments.length === 0 && (
            <Card className="text-center py-16 bg-white dark:bg-zinc-900 border-slate-200 dark:border-zinc-800">
              <CardContent className="space-y-4">
                <Shirt className="w-12 h-12 text-slate-300 dark:text-zinc-600 mx-auto" />
                <h3 className="text-xl font-bold text-slate-800 dark:text-white">No Garments Found</h3>
                <p className="text-sm text-slate-500 dark:text-zinc-400 max-w-sm mx-auto">
                  Try clearing your filters to see more results.
                </p>
                <Link href="/encyclopedia">
                  <Badge variant="default" className="cursor-pointer py-1.5 px-4">
                    Clear Filters
                  </Badge>
                </Link>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
