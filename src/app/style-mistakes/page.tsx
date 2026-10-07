import { prisma } from '@/lib/prisma';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { CheckCircle, Lightbulb, Shirt, ShieldAlert } from 'lucide-react';

export const revalidate = 60;

export default async function StyleMistakesPage() {
  const rules = await prisma.styleRule.findMany({
    orderBy: { createdAt: 'desc' },
  });

  const dos = rules.filter((r) => r.ruleType === 'dos');
  const donts = rules.filter((r) => r.ruleType === 'donts');
  const proTips = rules.filter((r) => r.ruleType === 'pro-tip');

  return (
    <div className="w-full px-4 sm:px-8 lg:px-12 py-12 bg-slate-50 dark:bg-zinc-950 transition-colors duration-300">
      {/* Header */}
      <div className="mb-12">
        <div className="flex items-center gap-2 text-amber-700 dark:text-amber-400 text-sm font-semibold mb-2">
          <Shirt className="w-4 h-4" />
          The Golden Rules of Menswear
        </div>
        <h1 className="text-4xl font-extrabold text-slate-900 dark:text-white mb-2">Style Tips & Common Mistakes</h1>
        <p className="text-slate-600 dark:text-zinc-400 max-w-2xl text-base font-medium">
          Avoid classic menswear blunders. Learn expert guidelines on tailoring, color coordination, and dress code etiquette.
        </p>
      </div>

      <div className="space-y-12">
        {/* DO'S SECTION */}
        <div>
          <h2 className="text-2xl font-bold text-emerald-800 dark:text-emerald-400 mb-6 flex items-center gap-2">
            <CheckCircle className="w-6 h-6 text-emerald-600 dark:text-emerald-400" />
            Always Do
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {dos.map((rule) => (
              <Card key={rule.id} className="border-emerald-200 dark:border-emerald-900/50 bg-white dark:bg-zinc-900">
                <CardHeader className="pb-3">
                  <Badge variant="excellent" className="w-fit mb-2">
                    {rule.category}
                  </Badge>
                  <CardTitle className="text-lg font-bold text-slate-900 dark:text-white">
                    {rule.title}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-slate-600 dark:text-zinc-400 leading-relaxed font-medium">
                    {rule.explanation}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>

        {/* DON'TS SECTION */}
        <div>
          <h2 className="text-2xl font-bold text-red-800 dark:text-red-400 mb-6 flex items-center gap-2">
            <ShieldAlert className="w-6 h-6 text-red-600 dark:text-red-400" />
            Never Do (Common Mistakes)
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {donts.map((rule) => (
              <Card key={rule.id} className="border-red-200 dark:border-red-900/50 bg-white dark:bg-zinc-900">
                <CardHeader className="pb-3">
                  <Badge variant="avoid" className="w-fit mb-2">
                    {rule.category}
                  </Badge>
                  <CardTitle className="text-lg font-bold text-slate-900 dark:text-white">
                    {rule.title}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-slate-600 dark:text-zinc-400 leading-relaxed font-medium">
                    {rule.explanation}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>

        {/* PRO TIPS */}
        <div>
          <h2 className="text-2xl font-bold text-amber-800 dark:text-amber-400 mb-6 flex items-center gap-2">
            <Lightbulb className="w-6 h-6 text-amber-600 dark:text-amber-400" />
            Pro Tips & Secrets
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {proTips.map((rule) => (
              <Card key={rule.id} className="border-amber-200 dark:border-amber-900/50 bg-white dark:bg-zinc-900">
                <CardHeader className="pb-3">
                  <Badge variant="default" className="w-fit mb-2">
                    {rule.category}
                  </Badge>
                  <CardTitle className="text-lg font-bold text-slate-900 dark:text-white">
                    {rule.title}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-slate-600 dark:text-zinc-400 leading-relaxed font-medium">
                    {rule.explanation}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
