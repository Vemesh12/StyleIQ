import { prisma } from '@/lib/prisma';
import { notFound } from 'next/navigation';
import { GarmentCard } from '@/components/garment-card';
import { CategoryIcon } from '@/components/category-icon';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { StarRating } from '@/components/star-rating';
import { ArrowLeft, Layers } from 'lucide-react';
import Link from 'next/link';

export const revalidate = 60;

interface PageProps {
  params: Promise<{ slug: string }>;
}

export default async function GarmentDetailPage({ params }: PageProps) {
  const { slug } = await params;
  const garment = await prisma.garment.findUnique({
    where: { slug },
    include: {
      garmentType: true,
      colors: { include: { color: true } },
      fits: { include: { fit: true } },
      materials: { include: { material: true } },
      occasions: { include: { occasion: true } },
      seasons: { include: { season: true } },
      compatibilityAsA: {
        include: {
          garmentB: {
            include: {
              garmentType: true,
              colors: { include: { color: true }, where: { isPrimary: true } },
            },
          },
        },
        orderBy: { rating: 'desc' },
      },
      // CompatibilityRule is a two-sided relation (A<->B) — a garment that's
      // only ever seeded as the "B" side of a curated rule would otherwise
      // show zero compatible items despite the relationship being real
      // (every scoring engine in this app already checks both directions).
      compatibilityAsB: {
        include: {
          garmentA: {
            include: {
              garmentType: true,
              colors: { include: { color: true }, where: { isPrimary: true } },
            },
          },
        },
        orderBy: { rating: 'desc' },
      },
    },
  });

  if (!garment) {
    notFound();
  }

  const compatibleGarments = [
    ...garment.compatibilityAsA.map((rule) => ({
      id: rule.id,
      rating: rule.rating,
      reason: rule.reason,
      compatibilityType: rule.compatibilityType,
      other: rule.garmentB,
    })),
    ...garment.compatibilityAsB.map((rule) => ({
      id: rule.id,
      rating: rule.rating,
      reason: rule.reason,
      compatibilityType: rule.compatibilityType,
      other: rule.garmentA,
    })),
  ].sort((a, b) => b.rating - a.rating);

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: garment.name,
    description: garment.description,
    category: garment.garmentType.name,
  };

  return (
    <div className="w-full px-4 sm:px-8 lg:px-12 py-12 bg-slate-50 dark:bg-zinc-950 transition-colors duration-300">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <div className="max-w-6xl mx-auto space-y-12">
        {/* Back Link */}
        <Link href="/encyclopedia">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="w-4 h-4" /> Back to Encyclopedia
          </Button>
        </Link>

        {/* Hero Card */}
        <Card className="bg-white dark:bg-zinc-900 border-slate-200 dark:border-zinc-800 overflow-hidden shadow-xl">
          <div className="grid grid-cols-1 md:grid-cols-12">
            {/* Flaticon Vector Icon Header */}
            <div className="md:col-span-4 bg-gradient-to-br from-amber-500/10 to-orange-500/10 dark:from-amber-950/40 dark:to-orange-950/40 flex items-center justify-center p-12 border-b md:border-b-0 md:border-r border-slate-200 dark:border-zinc-800">
              <div className="p-6 rounded-3xl bg-white/90 dark:bg-zinc-950/90 backdrop-blur-md shadow-xl text-amber-700 dark:text-amber-400">
                <CategoryIcon category={garment.garmentType.name} size={64} />
              </div>
            </div>

            {/* Main Info */}
            <div className="md:col-span-8 p-8 space-y-6">
              <div>
                <Badge variant="outline" className="text-xs uppercase tracking-wider mb-2 font-semibold">
                  {garment.garmentType.name}
                </Badge>
                <h1 className="text-3xl md:text-4xl font-extrabold text-slate-900 dark:text-white">
                  {garment.name}
                </h1>
                <p className="text-slate-600 dark:text-zinc-400 mt-2 leading-relaxed font-medium">
                  {garment.description}
                </p>
              </div>

              {/* Formality Level */}
              <div className="flex items-center gap-4 p-4 rounded-xl bg-slate-50 dark:bg-zinc-800/80 border border-slate-200 dark:border-zinc-700">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-zinc-400">
                  Formality Level:
                </span>
                <StarRating rating={garment.formalityLevel} size="lg" showValue />
              </div>

              {/* Color Swatches */}
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-zinc-400 block mb-2">
                  Classic Colors:
                </span>
                <div className="flex flex-wrap gap-2">
                  {garment.colors.map((gc) => (
                    <div
                      key={gc.colorId}
                      className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-zinc-800 border border-slate-300 dark:border-zinc-700 text-xs font-bold text-slate-900 dark:text-zinc-100"
                    >
                      <div
                        className="w-4 h-4 rounded-full border border-slate-400 dark:border-zinc-500"
                        style={{ backgroundColor: gc.color.hex }}
                      />
                      {gc.color.name}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </Card>

        {/* Compatible Items Section */}
        <div className="space-y-6">
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Layers className="w-6 h-6 text-amber-600 dark:text-amber-400" />
            Expert Compatible Garments
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
            {compatibleGarments.map((rule) => (
              <GarmentCard
                key={rule.id}
                name={rule.other.name}
                slug={rule.other.slug}
                garmentType={rule.other.garmentType.name}
                formalityLevel={rule.other.formalityLevel}
                colors={rule.other.colors.map((gc) => ({
                  name: gc.color.name,
                  hex: gc.color.hex,
                }))}
                rating={rule.rating}
                compatibilityType={rule.compatibilityType}
                reason={rule.reason}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
