import { getAdminSession, ADMIN_COOKIE_NAME } from '@/lib/auth';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import {
  LayoutDashboard,
  Shirt,
  GitCompare,
  LogOut,
  ArrowLeft,
  BookOpen,
  Lightbulb,
  Palette,
  FileUp,
} from 'lucide-react';

const adminLinks = [
  { href: '/admin', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/admin/garments', label: 'Garments', icon: Shirt },
  { href: '/admin/compatibility', label: 'Compatibility Rules', icon: GitCompare },
  { href: '/admin/color-rules', label: 'Color Rules', icon: Palette },
  { href: '/admin/guides', label: 'Style Guides', icon: BookOpen },
  { href: '/admin/style-rules', label: 'Style Rules & Tips', icon: Lightbulb },
  { href: '/admin/import', label: 'Bulk Import', icon: FileUp },
];

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Real authorization gate for every admin page (the login page lives
  // outside this route group). proxy.ts only does an optimistic cookie check
  // in front of this; the API routes check the session independently too.
  const session = await getAdminSession();
  if (!session) {
    redirect('/admin/login');
  }

  return (
    <div className="flex min-h-screen bg-zinc-950">
      {/* Sidebar */}
      <aside className="w-64 border-r border-zinc-800 bg-zinc-900/50 p-6 flex flex-col">
        <div className="mb-8">
          <div className="flex items-center gap-2 mb-1">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center">
              <span className="text-white font-bold text-sm">S</span>
            </div>
            <span className="text-lg font-bold text-white">Admin</span>
          </div>
          <p className="text-xs text-zinc-500">Welcome, {session.name || session.email}</p>
        </div>

        <nav className="space-y-1 flex-1">
          {adminLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-zinc-400 hover:text-white hover:bg-zinc-800 transition-all"
            >
              <link.icon className="w-4 h-4" />
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="space-y-2 pt-4 border-t border-zinc-800">
          <Link
            href="/"
            className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-zinc-500 hover:text-white hover:bg-zinc-800 transition-all"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Site
          </Link>
          <form
            action={async () => {
              'use server';
              const { cookies } = await import('next/headers');
              const cookieStore = await cookies();
              cookieStore.delete(ADMIN_COOKIE_NAME);
              redirect('/admin/login');
            }}
          >
            <button
              type="submit"
              className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-zinc-500 hover:text-red-400 hover:bg-red-500/10 transition-all"
            >
              <LogOut className="w-4 h-4" />
              Logout
            </button>
          </form>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 p-8 overflow-auto">{children}</main>
    </div>
  );
}
