'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { AuthModal } from '@/components/auth-modal';
import { reconcileStyleProfile } from '@/lib/style-profile';
import { ThemeToggle } from '@/components/theme-toggle';
import { AUTH_CHANGED_EVENT, clearLocalUserState, notifyAuthChanged } from '@/components/auth-events';
import {
  BookOpen,
  Palette,
  Shirt,
  Sparkles,
  Menu,
  X,
  Layers,
  UserCheck,
  FolderHeart,
  User,
  LogOut,
  Zap,
} from 'lucide-react';

const navLinks = [
  { href: '/quick-pick', label: 'Quick Pick', icon: Zap },
  { href: '/wardrobe', label: 'My Closet', icon: FolderHeart },
  { href: '/style-advisor', label: 'Style Advisor', icon: UserCheck },
  { href: '/encyclopedia', label: 'Encyclopedia', icon: BookOpen },
  { href: '/outfit-builder', label: 'Outfit Builder', icon: Layers },
  { href: '/guides', label: 'Guides', icon: Sparkles },
  { href: '/colors', label: 'Colors', icon: Palette },
  { href: '/style-mistakes', label: 'Style Tips', icon: Shirt },
];

export function Navbar() {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [user, setUser] = useState<{ id: string; name: string; email: string } | null>(null);

  useEffect(() => {
    let active = true;
    fetch('/api/auth/me')
      .then((res) => (res.ok ? res.json() : { user: null }))
      .then((data) => {
        if (!active) return;
        setUser(data.user ?? null);
        // Signed in: make this browser use the account's style profile.
        if (data.user) void reconcileStyleProfile(data.styleProfile);
      })
      .catch(() => active && setUser(null));

    // Sign-in/out from any auth modal or page updates the navbar too.
    const onAuthChanged = (e: Event) => {
      const detail = (e as CustomEvent<{ user: { id: string; name: string; email: string } | null }>).detail;
      setUser(detail?.user ?? null);
    };
    window.addEventListener(AUTH_CHANGED_EVENT, onAuthChanged);
    return () => {
      active = false;
      window.removeEventListener(AUTH_CHANGED_EVENT, onAuthChanged);
    };
  }, []);

  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
    } catch {
      // Still clear this browser's copy of the person's data below.
    }
    // Don't leave this person's style profile / history for the next user of
    // this browser.
    clearLocalUserState();
    setUser(null);
    setMobileOpen(false);
    notifyAuthChanged(null);
    // Pages hold per-user data in memory (closet, saved outfits); start clean.
    window.location.reload();
  };

  if (pathname?.startsWith('/admin')) return null;

  return (
    <>
      <nav className="sticky top-0 z-50 border-b border-slate-200/90 dark:border-zinc-800 bg-white/90 dark:bg-zinc-950/90 backdrop-blur-xl shadow-2xs">
        <div className="w-full px-4 sm:px-8 lg:px-12">
          <div className="flex items-center justify-between h-16">
            {/* Logo */}
            <Link href="/" className="flex items-center gap-2 group shrink-0">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-amber-600 to-orange-600 flex items-center justify-center shadow-md shadow-amber-600/20">
                <span className="text-white font-bold text-sm">S</span>
              </div>
              <span className="text-xl font-bold bg-gradient-to-r from-amber-600 to-orange-600 bg-clip-text text-transparent group-hover:from-amber-700 group-hover:to-orange-700 transition-all">
                StyleIQ
              </span>
            </Link>

            {/* Desktop nav */}
            <div className="hidden lg:flex items-center gap-1">
              {navLinks.map((link) => {
                const isActive = pathname === link.href || pathname?.startsWith(link.href + '/');
                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    className={cn(
                      'flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-semibold transition-all duration-200',
                      isActive
                        ? 'bg-amber-100/80 dark:bg-amber-500/10 text-amber-800 dark:text-amber-400'
                        : 'text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-zinc-800'
                    )}
                  >
                    <link.icon className="w-4 h-4" />
                    {link.label}
                  </Link>
                );
              })}
            </div>

            {/* User Profile & Theme Toggle */}
            <div className="hidden md:flex items-center gap-3">
              <ThemeToggle />

              {user ? (
                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-100 dark:bg-zinc-800 border border-slate-300 dark:border-zinc-700 text-xs font-bold text-slate-800 dark:text-zinc-200">
                    <User className="w-3.5 h-3.5 text-amber-600" />
                    {user.name || user.email}
                  </div>
                  <button
                    type="button"
                    onClick={handleLogout}
                    aria-label="Logout"
                    className="p-2 rounded-lg text-slate-500 dark:text-zinc-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors"
                    title="Logout"
                  >
                    <LogOut className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setAuthModalOpen(true)}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg bg-amber-600 text-white text-sm font-semibold hover:bg-amber-700 transition-all cursor-pointer shadow-md shadow-amber-600/20"
                >
                  <User className="w-4 h-4" />
                  Sign In / Register
                </button>
              )}
            </div>

            {/* Mobile menu button */}
            <div className="flex items-center gap-2 lg:hidden">
              <ThemeToggle />
              <button
                type="button"
                onClick={() => setMobileOpen(!mobileOpen)}
                aria-label={mobileOpen ? 'Close menu' : 'Open menu'}
                aria-expanded={mobileOpen}
                aria-controls="mobile-nav"
                className="p-2 rounded-lg text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-zinc-800 transition-colors"
              >
                {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
              </button>
            </div>
          </div>
        </div>

        {/* Mobile nav */}
        {mobileOpen && (
          <div id="mobile-nav" className="lg:hidden border-t border-slate-200 dark:border-zinc-800 bg-white/98 dark:bg-zinc-950/98 backdrop-blur-xl">
            <div className="px-4 py-3 space-y-1">
              {navLinks.map((link) => {
                const isActive = pathname === link.href || pathname?.startsWith(link.href + '/');
                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    onClick={() => setMobileOpen(false)}
                    className={cn(
                      'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-semibold transition-all duration-200',
                      isActive
                        ? 'bg-amber-100 dark:bg-amber-500/10 text-amber-800 dark:text-amber-400'
                        : 'text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-zinc-800'
                    )}
                  >
                    <link.icon className="w-4 h-4" />
                    {link.label}
                  </Link>
                );
              })}

              <div className="pt-3 border-t border-slate-200 dark:border-zinc-800 mt-2">
                {user ? (
                  <div className="flex items-center justify-between px-3 py-2 text-sm text-slate-800 dark:text-zinc-200">
                    <span>{user.name || user.email}</span>
                    <button onClick={handleLogout} className="text-red-600 text-xs font-bold">
                      Logout
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => { setMobileOpen(false); setAuthModalOpen(true); }}
                    className="w-full text-center px-4 py-2.5 rounded-lg bg-amber-600 text-white font-semibold text-sm shadow-md"
                  >
                    Sign In / Register
                  </button>
                )}
              </div>
            </div>
          </div>
        )}
      </nav>

      {/* Auth Modal */}
      <AuthModal
        isOpen={authModalOpen}
        onClose={() => setAuthModalOpen(false)}
        onSuccess={(u) => {
          // The modal also fires the auth-changed event, which pages listen to.
          setUser(u);
        }}
      />
    </>
  );
}
