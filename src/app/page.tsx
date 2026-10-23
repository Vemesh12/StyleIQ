import { prisma } from '@/lib/prisma';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { StarRating } from '@/components/star-rating';
import { compatibilityTypeForRating } from '@/lib/rule-engine/rating';
import {
  Shirt,
  Sparkles,
  Layers,
  Palette,
  BookOpen,
  ArrowRight,
  ShieldCheck,
  Award,
  Zap,
} from 'lucide-react';
import Link from 'next/link';

export const revalidate = 60;

export default async function HomePage() {
  const [garmentCount, ruleCount, colorRuleCount, guideCount, featuredRules, featuredGuides] =
    await Promise.all([
      prisma.garment.count({ where: { ownerId: null } }),
      prisma.compatibilityRule.count(),
      prisma.colorCompatibilityRule.count(),
      prisma.guide.count({ where: { published: true } }),
      prisma.compatibilityRule.findMany({
        where: { rating: { gte: 4.5 } },
        include: {
          garmentA: { include: { garmentType: true, colors: { include: { color: true }, where: { isPrimary: true } } } },
          garmentB: { include: { garmentType: true, colors: { include: { color: true }, where: { isPrimary: true } } } },
        },
        take: 3,
        orderBy: { rating: 'desc' },
      }),
      prisma.guide.findMany({
        where: { published: true },
        take: 3,
        orderBy: { createdAt: 'desc' },
      }),
    ]);

  const stats = [
    { label: 'Clothing Items', value: garmentCount, icon: Shirt },
    { label: 'Matching Rules', value: ruleCount, icon: ShieldCheck },
    { label: 'Color Matches', value: colorRuleCount, icon: Palette },
    { label: 'Style Guides', value: guideCount, icon: BookOpen },
  ];

  const features = [
    {
      icon: Layers,
      title: 'Outfit Score & Matching',
      description: 'Finds matching outfits with a clear score based on color match, occasion, season, body shape, and skin tone.',
      href: '/outfit-builder',
      cta: 'Build an Outfit',
    },
    {
      icon: BookOpen,
      title: 'Clothing Directory',
      description: 'Explore all types of shirts, pants, shoes, coats, and belts with easy matching rules.',
      href: '/encyclopedia',
      cta: 'Explore Catalog',
    },
    {
      icon: Palette,
      title: 'Color Matching System',
      description: 'Learn simple color matching rules, contrast combinations, and color wheel tools.',
      href: '/colors',
      cta: 'Color Guide',
    },
    {
      icon: Shirt,
      title: 'Style Tips & Mistakes',
      description: 'Learn simple everyday style rules: belt & shoe matching, shirt fitting, and simple dress codes.',
      href: '/style-mistakes',
      cta: 'View Style Tips',
    },
  ];

  return (
    <div className="space-y-20 pb-20 bg-slate-50 dark:bg-zinc-950 transition-colors duration-300">
      {/* HERO SECTION */}
      <section className="relative overflow-hidden pt-12 pb-20 border-b border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 transition-colors duration-300">
        <div className="absolute top-10 left-1/4 w-96 h-96 bg-amber-200/40 dark:bg-amber-500/10 rounded-full blur-3xl" />
        <div className="absolute bottom-10 right-1/4 w-64 h-64 bg-orange-200/40 dark:bg-orange-500/10 rounded-full blur-3xl" />

        <div className="relative w-full px-4 sm:px-8 lg:px-12">
          <div className="text-center space-y-8 max-w-4xl mx-auto">
            {/* Pill badge */}
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-amber-100 dark:bg-amber-500/10 border border-amber-300 dark:border-amber-500/20 text-amber-900 dark:text-amber-400 text-sm font-semibold shadow-2xs">
              <Sparkles className="w-4 h-4 text-amber-600 dark:text-amber-400" />
              Smart & Simple Outfit & Color Guide
            </div>

            {/* Main Title */}
            <h1 className="text-5xl md:text-7xl font-extrabold tracking-tight text-slate-900 dark:text-white leading-[1.1]">
              Learn How to{' '}
              <span className="bg-gradient-to-r from-amber-600 via-orange-600 to-amber-700 dark:from-amber-400 dark:to-orange-400 bg-clip-text text-transparent">
                Dress Well
              </span>
              <br />
              Every Single Day.
            </h1>

            <p className="text-lg md:text-xl text-slate-600 dark:text-zinc-400 max-w-2xl mx-auto font-medium">
              Don&apos;t know fashion? Don&apos;t worry. Tell us what you&apos;re doing today and we&apos;ll hand you a complete outfit — free, no fashion sense required.
            </p>

            {/* CTAs */}
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4">
              <Link href="/quick-pick">
                <Button size="lg" className="w-full sm:w-auto text-base">
                  <Zap className="w-5 h-5" /> What Should I Wear?
                </Button>
              </Link>
              <Link href="/outfit-builder">
                <Button size="lg" variant="outline" className="w-full sm:w-auto text-base">
                  <Layers className="w-5 h-5" /> Try Outfit Builder
                </Button>
              </Link>
            </div>

            {/* Stats Bar */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-12 max-w-3xl mx-auto">
              {stats.map((stat, i) => (
                <div key={i} className="p-4 rounded-xl bg-slate-50 dark:bg-zinc-800/80 border border-slate-200 dark:border-zinc-700 text-center shadow-2xs">
                  <div className="inline-flex p-2 rounded-lg bg-amber-100 dark:bg-amber-500/20 mb-2">
                    <stat.icon className="w-5 h-5 text-amber-700 dark:text-amber-400" />
                  </div>
                  <div className="text-2xl font-extrabold text-slate-900 dark:text-white">{stat.value}+</div>
                  <div className="text-xs text-slate-500 dark:text-zinc-400 uppercase tracking-wider font-bold">{stat.label}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* FEATURES SECTION */}
      <section className="w-full px-4 sm:px-8 lg:px-12">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-extrabold text-slate-900 dark:text-white mb-3">Everything You Need to Dress Better</h2>
          <p className="text-slate-600 dark:text-zinc-400 max-w-xl mx-auto text-base">
            No algorithm guessing. Every rule in StyleIQ is backed by classic menswear principles.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {features.map((feature, i) => (
            <Card key={i} className="group hover:border-amber-500/50 hover:shadow-xl transition-all duration-300 bg-white dark:bg-zinc-900 border-slate-200/90 dark:border-zinc-800">
              <CardHeader>
                <div className="w-12 h-12 rounded-xl bg-amber-100 dark:bg-amber-500/20 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                  <feature.icon className="w-6 h-6 text-amber-700 dark:text-amber-400" />
                </div>
                <CardTitle className="text-xl text-slate-900 dark:text-white group-hover:text-amber-700 dark:group-hover:text-amber-400 transition-colors">
                  {feature.title}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm text-slate-600 dark:text-zinc-400 leading-relaxed font-medium">{feature.description}</p>
                <Link href={feature.href} className="inline-flex items-center gap-1 text-xs font-bold text-amber-700 dark:text-amber-400 hover:underline">
                  {feature.cta} <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      {/* TOP COMBINATIONS SECTION */}
      {featuredRules.length > 0 && (
        <section className="w-full px-4 sm:px-8 lg:px-12 py-16 bg-white dark:bg-zinc-900 border-y border-slate-200 dark:border-zinc-800">
          <div className="flex items-center justify-between mb-12">
            <div>
              <div className="flex items-center gap-2 text-amber-700 dark:text-amber-400 text-sm font-bold mb-1">
                <Award className="w-4 h-4" />
                Proven Combinations
              </div>
              <h2 className="text-3xl font-extrabold text-slate-900 dark:text-white">Highest-Rated Garment Pairings</h2>
            </div>
            <Link href="/encyclopedia">
              <Button variant="ghost" size="sm">
                View All <ArrowRight className="w-4 h-4" />
              </Button>
            </Link>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {featuredRules.map((rule) => (
              <Card key={rule.id} className="bg-slate-50 dark:bg-zinc-800/60 border-slate-200 dark:border-zinc-700 p-6 space-y-4">
                <div className="flex items-center justify-between">
                  <Badge variant={compatibilityTypeForRating(rule.rating)}>{rule.rating.toFixed(1)} Star Rating</Badge>
                  <StarRating rating={rule.rating} size="sm" />
                </div>

                <div className="flex items-center justify-between gap-3 pt-2">
                  <div className="flex-1 text-center p-3 rounded-lg bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700">
                    <p className="text-sm font-bold text-slate-900 dark:text-white line-clamp-1">{rule.garmentA.name}</p>
                    <p className="text-xs text-slate-500 dark:text-zinc-400 font-semibold">{rule.garmentA.garmentType.name}</p>
                  </div>
                  <span className="text-xl font-bold text-slate-400 dark:text-zinc-500">+</span>
                  <div className="flex-1 text-center p-3 rounded-lg bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700">
                    <p className="text-sm font-bold text-slate-900 dark:text-white line-clamp-1">{rule.garmentB.name}</p>
                    <p className="text-xs text-slate-500 dark:text-zinc-400 font-semibold">{rule.garmentB.garmentType.name}</p>
                  </div>
                </div>

                <p className="text-xs text-slate-600 dark:text-zinc-400 italic pt-2 border-t border-slate-200 dark:border-zinc-700">&ldquo;{rule.reason}&rdquo;</p>
              </Card>
            ))}
          </div>
        </section>
      )}

      {/* GUIDES HUB PREVIEW */}
      <section className="w-full px-4 sm:px-8 lg:px-12">
        <div className="flex items-center justify-between mb-12">
          <div>
            <h2 className="text-3xl font-extrabold text-slate-900 dark:text-white">Style Guides</h2>
            <p className="text-slate-600 dark:text-zinc-400 mt-1 font-medium">Comprehensive guides for every occasion.</p>
          </div>
          <Link href="/guides">
            <Button variant="ghost" size="sm">
              All Guides <ArrowRight className="w-4 h-4" />
            </Button>
          </Link>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {featuredGuides.map((guide) => (
            <Link key={guide.id} href={`/guides/${guide.slug}`}>
              <Card className="group hover:border-amber-500/50 hover:shadow-xl transition-all duration-300 h-full bg-white dark:bg-zinc-900 border-slate-200 dark:border-zinc-800">
                <CardHeader>
                  <div className="w-10 h-10 rounded-lg bg-amber-100 dark:bg-amber-500/20 flex items-center justify-center mb-3">
                    <Sparkles className="w-5 h-5 text-amber-700 dark:text-amber-400" />
                  </div>
                  <Badge variant="outline" className="w-fit text-xs uppercase tracking-wider mb-2">
                    {guide.category}
                  </Badge>
                  <CardTitle className="font-bold text-slate-900 dark:text-white group-hover:text-amber-700 dark:group-hover:text-amber-400 transition-colors line-clamp-2">
                    {guide.title}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-xs text-slate-600 dark:text-zinc-400 line-clamp-2 font-medium">{guide.excerpt}</p>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      </section>

      {/* CALL TO ACTION */}
      <section className="w-full px-4 sm:px-8 lg:px-12">
        <Card className="bg-gradient-to-r from-amber-600 to-orange-600 dark:from-amber-700 dark:to-orange-800 border-none text-white text-center p-12 shadow-xl">
          <div className="max-w-2xl mx-auto space-y-6">
            <h2 className="text-3xl md:text-4xl font-extrabold">Ready to Level Up Your Style?</h2>
            <p className="text-amber-100 text-base font-medium">
              Start building your digital closet, get personalized styling advice, and master color combinations today.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-2">
              <Link href="/style-advisor">
                <Button size="lg" className="bg-white text-slate-900 hover:bg-slate-100 shadow-md">
                  <Sparkles className="w-4 h-4 text-amber-600" /> Open Style Advisor
                </Button>
              </Link>
              <Link href="/wardrobe">
                <Button size="lg" className="bg-slate-900 dark:bg-zinc-950 text-white hover:bg-slate-800 dark:hover:bg-zinc-900 border border-amber-400/40 shadow-md">
                  <Shirt className="w-4 h-4 text-amber-400" /> Open My Closet
                </Button>
              </Link>
            </div>
          </div>
        </Card>
      </section>
    </div>
  );
}
