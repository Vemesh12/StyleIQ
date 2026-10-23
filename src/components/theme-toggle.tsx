'use client';

import { useLayoutEffect, useSyncExternalStore } from 'react';
import { Sun, Moon } from 'lucide-react';
import { THEME_STORAGE_KEY } from '@/components/theme-script';

type Theme = 'light' | 'dark';
const THEME_EVENT = 'styleiq-theme-change';

function readStoredTheme(): Theme {
  try {
    return localStorage.getItem(THEME_STORAGE_KEY) === 'dark' ? 'dark' : 'light';
  } catch {
    return 'light';
  }
}

function applyTheme(theme: Theme) {
  document.documentElement.classList.toggle('dark', theme === 'dark');
}

// The <html> class is the source of truth; every toggle instance (desktop and
// mobile navbar) re-reads it when it changes.
const subscribe = (onChange: () => void) => {
  window.addEventListener(THEME_EVENT, onChange);
  return () => window.removeEventListener(THEME_EVENT, onChange);
};
const getSnapshot = (): Theme => (document.documentElement.classList.contains('dark') ? 'dark' : 'light');
// The server can't know the saved theme, so it (and hydration) render "light";
// React then switches to the real value right after mount without a mismatch.
const getServerSnapshot = (): Theme => 'light';

export function ThemeToggle() {
  const theme = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  // In development React's remount can drop the class the inline script set;
  // re-apply it before paint. No-op in production.
  useLayoutEffect(() => {
    const stored = readStoredTheme();
    if (getSnapshot() !== stored) {
      applyTheme(stored);
      window.dispatchEvent(new Event(THEME_EVENT));
    }
  }, []);

  const toggleTheme = () => {
    const newTheme: Theme = theme === 'light' ? 'dark' : 'light';
    try {
      localStorage.setItem(THEME_STORAGE_KEY, newTheme);
    } catch {
      // Storage unavailable — the theme just won't persist.
    }
    applyTheme(newTheme);
    window.dispatchEvent(new Event(THEME_EVENT));
  };

  const label = `Switch to ${theme === 'light' ? 'dark' : 'light'} mode`;
  return (
    <button
      type="button"
      onClick={toggleTheme}
      className="p-2 rounded-lg border border-slate-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-slate-700 dark:text-zinc-200 hover:bg-slate-100 dark:hover:bg-zinc-700 transition-all cursor-pointer shadow-2xs"
      title={label}
      aria-label={label}
    >
      {theme === 'light' ? (
        <Moon className="w-4 h-4 text-zinc-700" />
      ) : (
        <Sun className="w-4 h-4 text-amber-400" />
      )}
    </button>
  );
}
