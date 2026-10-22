import { prisma } from '@/lib/prisma';
import { getAdminSession } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Shirt, GitCompare, Palette, BookOpen, Lightbulb, Users } from 'lucide-react';
import Link from 'next/link';

export default async function AdminDashboard() {
  const session = await getAdminSession();
  if (!session) redirect('/admin/login');

  const [
    garmentCount,
    ruleCount,
    colorRuleCount,
    guideCount,
    styleRuleCount,
    garmentTypeCount,
  ] = await Promise.all([
    prisma.garment.count({ where: { ownerId: null } }),
    prisma.compatibilityRule.count(),
    prisma.colorCompatibilityRule.count(),
    prisma.guide.count(),
    prisma.styleRule.count(),
    prisma.garmentType.count(),
  ]);

  const stats = [
    { label: 'Garments', value: garmentCount, icon: Shirt, href: '/admin/garments', color: 'from-blue-500/20 to-indigo-500/20', textColor: 'text-blue-400' },
    { label: 'Compatibility Rules', value: ruleCount, icon: GitCompare, href: '/admin/compatibility', color: 'from-amber-500/20 to-orange-500/20', textColor: 'text-amber-400' },
    { label: 'Guides', value: guideCount, icon: BookOpen, href: '/admin/guides', color: 'from-emerald-500/20 to-teal-500/20', textColor: 'text-emerald-400' },
    { label: 'Style Rules', value: styleRuleCount, icon: Lightbulb, href: '/admin/style-rules', color: 'from-rose-500/20 to-pink-500/20', textColor: 'text-rose-400' },
    { label: 'Color Rules', value: colorRuleCount, icon: Palette, href: '/admin/color-rules', color: 'from-violet-500/20 to-purple-500/20', textColor: 'text-violet-400' },
    { label: 'Garment Types', value: garmentTypeCount, icon: Users, href: '/admin/garments', color: 'from-cyan-500/20 to-sky-500/20', textColor: 'text-cyan-400' },
  ];

  return (
    <div>
      <h1 className="text-3xl font-bold text-white mb-2">Admin Dashboard</h1>
      <p className="text-zinc-400 mb-8">Manage the StyleIQ fashion knowledge base.</p>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {stats.map((stat) => {
          const card = (
            <Card className={stat.href ? 'hover:border-amber-500/30 group' : 'opacity-80'}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-zinc-400">
                  {stat.label}
                </CardTitle>
                <div className={`p-2 rounded-lg bg-gradient-to-br ${stat.color}`}>
                  <stat.icon className={`w-5 h-5 ${stat.textColor}`} />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-white">{stat.value}</div>
                <p className="text-xs text-zinc-500 mt-1 group-hover:text-amber-400 transition-colors">
                  {stat.href ? 'Click to manage →' : 'Managed via seed data'}
                </p>
              </CardContent>
            </Card>
          );
          return stat.href ? (
            <Link key={stat.label} href={stat.href}>{card}</Link>
          ) : (
            <div key={stat.label}>{card}</div>
          );
        })}
      </div>
    </div>
  );
}
