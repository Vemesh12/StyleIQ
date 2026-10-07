import { prisma } from '@/lib/prisma';
import { Prisma } from '@prisma/client';
import { GarmentCard } from '@/components/garment-card';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { BookOpen, Filter, Shirt } from 'lucide-react';
import Link from 'next/link';

export const revalidate = 60;

interface PageProps {
  searchParams: Promise<{ type?: string; color?: string; occasion?: string; q?: string }>;
}

export default async function EncyclopediaPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const typeFilter = params.type;
  const colorFilter = params.color;
  const occasionFilter = params.occasion;
  const searchQuery = params.q;

  const [types, colors, occasions] = await Promise.all([
    prisma.garmentType.findMany({ orderBy: { name: 'asc' } }),
    prisma.color.findMany({ orderBy: { name: 'asc' } }),
    prisma.occasion.findMany({ orderBy: { formalityLevel: 'desc' } }),
  ]);

  const where: Prisma.GarmentWhereInput = {};
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
    where.OR = [
      { name: { contains: searchQuery } },
      { description: { contains: searchQuery } },
    ];
  }

  const garments = await prisma.garment.findMany({
    where,
    include: {
      garmentType: true,
      colors: { include: { color: true }, where: { isPrimary: true } },
    },
    orderBy: { formalityLevel: 'desc' },
  });

  return (
    <div className="w-full px-4 sm:px-8 lg:px-12 py-12 bg-slate-50 dark:bg-zinc-950 min-h-screen transition-colors duration-300">
      {/* Header & Search Bar */}
      <div className="mb-8 flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-amber-700 dark:text-amber-400 text-sm font-semibold mb-2">
            <BookOpen className="w-4 h-4" />
            Clothes & Styles Directory ({garments.length} Items)
          </div>
          <h1 className="text-4xl font-extrabold text-slate-900 dark:text-white mb-2">Clothing Encyclopedia</h1>
          <p className="text-slate-600 dark:text-zinc-400 max-w-2xl text-base font-medium">
            Browse all types of shirts, pants, shoes, coats, and belts with simple guidelines and color matching ideas.
          </p>
        </div>

        {/* Search Bar */}
        <form action="/encyclopedia" method="GET" className="w-full md:w-80 shrink-0">
          <div className="relative">
            <input
              type="text"
              name="q"
              defaultValue={searchQuery || ''}
              placeholder="Search clothes (e.g. Linen, Chinos, Boots)..."
              className="w-full pl-4 pr-10 py-2.5 rounded-xl border border-slate-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 shadow-2xs"
            />
            {typeFilter && <input type="hidden" name="type" value={typeFilter} />}
            {colorFilter && <input type="hidden" name="color" value={colorFilter} />}
            {occasionFilter && <input type="hidden" name="occasion" value={occasionFilter} />}
            <button type="submit" className="absolute right-3 top-3 text-slate-400 hover:text-slate-600 dark:hover:text-zinc-200">
              🔍
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
                {(typeFilter || colorFilter || occasionFilter) && (
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
                  <Link href={`/encyclopedia?${colorFilter ? `color=${colorFilter}` : ''}${occasionFilter ? `&occasion=${occasionFilter}` : ''}`}>
                    <Badge variant={!typeFilter ? 'default' : 'outline'} className="cursor-pointer">
                      All Types
                    </Badge>
                  </Link>
                  {types.map((t) => (
                    <Link key={t.id} href={`/encyclopedia?type=${t.slug}${colorFilter ? `&color=${colorFilter}` : ''}${occasionFilter ? `&occasion=${occasionFilter}` : ''}`}>
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
                  <Link href={`/encyclopedia?${typeFilter ? `type=${typeFilter}` : ''}${occasionFilter ? `&occasion=${occasionFilter}` : ''}`}>
                    <Badge variant={!colorFilter ? 'default' : 'outline'} className="cursor-pointer">
                      All Colors
                    </Badge>
                  </Link>
                  {colors.map((c) => (
                    <Link key={c.id} href={`/encyclopedia?${typeFilter ? `type=${typeFilter}&` : ''}color=${c.slug}${occasionFilter ? `&occasion=${occasionFilter}` : ''}`}>
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
                  <Link href={`/encyclopedia?${typeFilter ? `type=${typeFilter}` : ''}${colorFilter ? `&color=${colorFilter}` : ''}`}>
                    <Badge variant={!occasionFilter ? 'default' : 'outline'} className="cursor-pointer">
                      All Occasions
                    </Badge>
                  </Link>
                  {occasions.map((o) => (
                    <Link key={o.id} href={`/encyclopedia?${typeFilter ? `type=${typeFilter}&` : ''}${colorFilter ? `color=${colorFilter}&` : ''}occasion=${o.slug}`}>
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
              Showing <span className="text-slate-900 dark:text-white font-bold">{garments.length}</span> master garments
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
          ) : (
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
