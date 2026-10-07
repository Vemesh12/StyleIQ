import Link from 'next/link';
import { BookOpen, Palette, Shirt, Sparkles, Layers, Mail, Globe } from 'lucide-react';

export function Footer() {
  return (
    <footer className="border-t border-zinc-800 bg-zinc-950">
      <div className="w-full px-4 sm:px-8 lg:px-12 py-12">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          {/* Brand */}
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center">
                <span className="text-white font-bold text-sm">S</span>
              </div>
              <span className="text-xl font-bold bg-gradient-to-r from-amber-400 to-orange-400 bg-clip-text text-transparent">
                StyleIQ
              </span>
            </div>
            <p className="text-sm text-zinc-500 max-w-xs">
              The world&apos;s best men&apos;s fashion knowledge platform. Expert-curated rules, not AI guesses.
            </p>
          </div>

          {/* Explore */}
          <div>
            <h4 className="text-sm font-semibold text-zinc-300 uppercase tracking-wider mb-4">Explore</h4>
            <ul className="space-y-2">
              {[
                { href: '/encyclopedia', label: 'Fashion Encyclopedia', icon: BookOpen },
                { href: '/outfit-builder', label: 'Outfit Builder', icon: Layers },
                { href: '/guides', label: 'Style Guides', icon: Sparkles },
              ].map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="flex items-center gap-2 text-sm text-zinc-500 hover:text-amber-400 transition-colors"
                  >
                    <link.icon className="w-3.5 h-3.5" />
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Learn */}
          <div>
            <h4 className="text-sm font-semibold text-zinc-300 uppercase tracking-wider mb-4">Learn</h4>
            <ul className="space-y-2">
              {[
                { href: '/colors', label: 'Color Guide', icon: Palette },
                { href: '/style-mistakes', label: 'Style Mistakes', icon: Shirt },
              ].map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="flex items-center gap-2 text-sm text-zinc-500 hover:text-amber-400 transition-colors"
                  >
                    <link.icon className="w-3.5 h-3.5" />
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Connect */}
          <div>
            <h4 className="text-sm font-semibold text-zinc-300 uppercase tracking-wider mb-4">Connect</h4>
            <ul className="space-y-2">
              <li>
                <a href="mailto:hello@styleiq.com" className="flex items-center gap-2 text-sm text-zinc-500 hover:text-amber-400 transition-colors">
                  <Mail className="w-3.5 h-3.5" />
                  hello@styleiq.com
                </a>
              </li>
              <li>
                <a href="#" className="flex items-center gap-2 text-sm text-zinc-500 hover:text-amber-400 transition-colors">
                  <Globe className="w-3.5 h-3.5" />
                  Website
                </a>
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom */}
        <div className="mt-12 pt-8 border-t border-zinc-800/50 flex flex-col md:flex-row justify-between items-center gap-4">
          <p className="text-xs text-zinc-600">
            © {new Date().getFullYear()} StyleIQ. Knowledge-driven fashion for men.
          </p>
          <p className="text-xs text-zinc-700">
            Expert-curated • No AI • Structured knowledge
          </p>
        </div>
      </div>
    </footer>
  );
}
