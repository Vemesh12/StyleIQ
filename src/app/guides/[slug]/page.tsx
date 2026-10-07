import { prisma } from '@/lib/prisma';
import { notFound } from 'next/navigation';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Clock, Calendar } from 'lucide-react';
import Link from 'next/link';

export const revalidate = 60;

interface PageProps {
  params: Promise<{ slug: string }>;
}

export default async function GuideDetailPage({ params }: PageProps) {
  const { slug } = await params;
  const guide = await prisma.guide.findUnique({
    where: { slug },
  });

  if (!guide || !guide.published) {
    notFound();
  }

  // Schema.org Article JSON-LD
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: guide.title,
    description: guide.excerpt,
    datePublished: guide.createdAt.toISOString(),
    author: {
      '@type': 'Organization',
      name: 'StyleIQ Menswear Experts',
    },
  };

  return (
    <div className="w-full px-4 sm:px-8 lg:px-12 py-12 bg-slate-50 dark:bg-zinc-950 transition-colors duration-300">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <div className="max-w-4xl mx-auto space-y-8">
        {/* Back Link */}
        <Link href="/guides">
          <Button variant="ghost" size="sm" className="mb-4">
            <ArrowLeft className="w-4 h-4" /> Back to Guides
          </Button>
        </Link>

        {/* Article Header */}
        <div className="space-y-4 border-b border-slate-200 dark:border-zinc-800 pb-8">
          <Badge variant="default" className="text-xs uppercase tracking-wider">
            {guide.category}
          </Badge>
          <h1 className="text-4xl md:text-5xl font-extrabold text-slate-900 dark:text-white leading-tight">
            {guide.title}
          </h1>
          <p className="text-lg text-slate-600 dark:text-zinc-400 font-medium leading-relaxed">
            {guide.excerpt}
          </p>

          <div className="flex items-center gap-6 text-xs text-slate-500 dark:text-zinc-500 pt-2 font-medium">
            <span className="flex items-center gap-1.5">
              <Calendar className="w-4 h-4 text-amber-600 dark:text-amber-400" />
              {new Date(guide.createdAt).toLocaleDateString('en-US', {
                month: 'long',
                day: 'numeric',
                year: 'numeric',
              })}
            </span>
            <span className="flex items-center gap-1.5">
              <Clock className="w-4 h-4 text-amber-600 dark:text-amber-400" />
              5 min read
            </span>
          </div>
        </div>

        {/* Article Body */}
        <Card className="bg-white dark:bg-zinc-900 border-slate-200 dark:border-zinc-800">
          <CardContent className="p-8 space-y-6 text-slate-800 dark:text-zinc-200 leading-relaxed font-normal text-base">
            {guide.content.split('\n\n').map((paragraph, index) => (
              <p key={index}>{paragraph}</p>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
