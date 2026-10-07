import { prisma } from '@/lib/prisma';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Sparkles, ArrowRight, BookOpen } from 'lucide-react';
import Link from 'next/link';

export const revalidate = 60;

export default async function GuidesHubPage() {
  const guides = await prisma.guide.findMany({
    where: { published: true },
    orderBy: { createdAt: 'desc' },
  });

  const categories = [...new Set(guides.map((g) => g.category))];

  return (
    <div className="w-full px-4 sm:px-8 lg:px-12 py-12 bg-slate-50 dark:bg-zinc-950 transition-colors duration-300">
      {/* Header */}
      <div className="mb-12">
        <div className="flex items-center gap-2 text-amber-700 dark:text-amber-400 text-sm font-semibold mb-2">
          <BookOpen className="w-4 h-4" />
          StyleIQ Editorial
        </div>
        <h1 className="text-4xl font-extrabold text-slate-900 dark:text-white mb-2">Menswear Style Guides</h1>
        <p className="text-slate-600 dark:text-zinc-400 max-w-2xl text-base font-medium">
          Comprehensive, expert-written guides covering dress codes, garment fits, tailoring rules, and seasonal wardrobes.
        </p>
      </div>

      {/* Guides Grid by Category */}
      <div className="space-y-12">
        {categories.map((cat) => {
          const categoryGuides = guides.filter((g) => g.category === cat);

          return (
            <div key={cat} className="space-y-6">
              <h2 className="text-2xl font-bold text-slate-900 dark:text-white capitalize flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-amber-600 dark:text-amber-400" />
                {cat} Guides ({categoryGuides.length})
              </h2>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {categoryGuides.map((guide) => (
                  <Link key={guide.id} href={`/guides/${guide.slug}`}>
                    <Card className="group hover:border-amber-500/50 hover:shadow-xl transition-all duration-300 h-full bg-white dark:bg-zinc-900 border-slate-200 dark:border-zinc-800">
                      <CardHeader>
                        <Badge variant="outline" className="w-fit text-xs uppercase tracking-wider mb-2">
                          {guide.category}
                        </Badge>
                        <CardTitle className="font-bold text-slate-900 dark:text-white group-hover:text-amber-700 dark:group-hover:text-amber-400 transition-colors line-clamp-2">
                          {guide.title}
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <p className="text-sm text-slate-600 dark:text-zinc-400 line-clamp-3 leading-relaxed font-medium">
                          {guide.excerpt}
                        </p>
                        <span className="inline-flex items-center gap-1 text-xs font-bold text-amber-700 dark:text-amber-400 group-hover:underline">
                          Read Full Guide <ArrowRight className="w-3.5 h-3.5" />
                        </span>
                      </CardContent>
                    </Card>
                  </Link>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
