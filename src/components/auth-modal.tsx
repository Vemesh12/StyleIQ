'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { X, LogIn, UserPlus, Lock } from 'lucide-react';
import { readGuestWardrobe, clearGuestWardrobe } from '@/lib/guest-wardrobe';
import { reconcileStyleProfile } from '@/lib/style-profile';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (user: { id: string; name: string; email: string }) => void;
  initialMode?: 'login' | 'register';
}


export function AuthModal({ isOpen, onClose, onSuccess, initialMode = 'login' }: AuthModalProps) {
  const [mode, setMode] = useState<'login' | 'register'>(initialMode);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  // Moves a guest's closet (kept in localStorage) into their account in one
  // request. The local copy is only cleared once the server has accepted it,
  // so a failed sync doesn't lose the guest's items.
  const syncGuestWardrobe = async () => {
    try {
      const guestIds = readGuestWardrobe();
      if (guestIds.length === 0) return;
      const res = await fetch('/api/user/wardrobe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ garmentIds: guestIds.slice(0, 200) }),
      });
      // 404 = none of the saved ids exist any more; nothing left worth keeping.
      if (res.ok || res.status === 404) clearGuestWardrobe();
    } catch (e) {
      console.error('Error syncing guest wardrobe:', e);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const endpoint = mode === 'login' ? '/api/auth/login' : '/api/auth/register';
      const body = mode === 'login' ? { email, password } : { name, email, password };

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      const data = await res.json();

      if (res.ok && data.user) {
        await syncGuestWardrobe();
        // Bring the account's style profile to this browser (or upload this
        // browser's one if the account doesn't have one yet).
        try {
          const me = await fetch('/api/auth/me').then((r) => r.json());
          await reconcileStyleProfile(me.styleProfile);
        } catch {
          // Non-fatal: personalization just keeps using the local profile.
        }
        onSuccess(data.user);
        onClose();
      } else {
        setError(data.error || 'Authentication failed');
      }
    } catch {
      setError('Network error');
    }
    setLoading(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-fade-in">
      <Card className="w-full max-w-md border-slate-200 relative shadow-2xl bg-white">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-slate-400 hover:text-slate-700 p-1 rounded-lg transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        <CardHeader className="text-center pb-2">
          <div className="mx-auto w-12 h-12 rounded-xl bg-gradient-to-br from-amber-600 to-orange-600 flex items-center justify-center mb-3 shadow-md shadow-amber-600/20">
            <Lock className="w-6 h-6 text-white" />
          </div>
          <CardTitle className="text-2xl text-slate-900">
            {mode === 'login' ? 'Welcome Back to StyleIQ' : 'Create Your StyleIQ Account'}
          </CardTitle>
          <p className="text-xs text-slate-500 mt-1">
            {mode === 'login'
              ? 'Sign in to access your saved wardrobe and outfits'
              : 'Save your digital wardrobe and get personalized style rules'}
          </p>
        </CardHeader>

        <CardContent>
          <div className="flex rounded-lg bg-slate-100 p-1 mb-6 border border-slate-200">
            <button
              type="button"
              onClick={() => { setMode('login'); setError(''); }}
              className={`flex-1 py-1.5 text-xs font-bold rounded-md transition-all flex items-center justify-center gap-1.5 ${
                mode === 'login'
                  ? 'bg-amber-600 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <LogIn className="w-3.5 h-3.5" /> Sign In
            </button>
            <button
              type="button"
              onClick={() => { setMode('register'); setError(''); }}
              className={`flex-1 py-1.5 text-xs font-bold rounded-md transition-all flex items-center justify-center gap-1.5 ${
                mode === 'register'
                  ? 'bg-amber-600 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <UserPlus className="w-3.5 h-3.5" /> Register
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === 'register' && (
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">
                  Full Name
                </label>
                <Input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="John Doe"
                  required
                />
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">
                Email Address
              </label>
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">
                Password
              </label>
              <Input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
              />
            </div>

            {error && (
              <p className="text-xs text-red-600 bg-red-50 border border-red-200 px-3 py-2 rounded-lg font-medium">
                {error}
              </p>
            )}

            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? 'Processing...' : mode === 'login' ? 'Sign In' : 'Create Account'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
