'use client';

import { useState } from 'react';
import { PlusCircle, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';

interface Option {
  slug: string;
  name: string;
}
interface ColorOption extends Option {
  hex: string;
  family: string;
}

const EMPTY = {
  name: '',
  typeSlug: '',
  colorSlugs: [] as string[],
  formalityLevel: 3,
  patternSlug: 'solid',
  materialSlug: '',
  fitSlug: '',
  seasonProfile: 'all' as 'light' | 'heavy' | 'all',
};

const FORMALITY_LABELS = ['', 'Very casual (gym, lounge)', 'Casual (weekend)', 'Smart casual', 'Business', 'Formal / black tie'];

/**
 * "Add your own item": describe something you own that isn't in the catalog.
 * It's scored like any catalog item but stays private to your account.
 */
export function CustomGarmentForm({ onCreated }: { onCreated: () => void }) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const [options, setOptions] = useState<{
    types: Option[];
    colors: ColorOption[];
    fits: Option[];
    materials: Option[];
    patterns: Option[];
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [colorSearch, setColorSearch] = useState('');

  const openForm = async () => {
    setOpen(true);
    if (options) return;
    try {
      const [types, colors, attrs] = await Promise.all([
        fetch('/api/garments?listTypes=true').then((r) => r.json()),
        fetch('/api/colors').then((r) => r.json()),
        fetch('/api/garments?listAttributes=true').then((r) => r.json()),
      ]);
      setOptions({ types, colors: colors.colors, fits: attrs.fits, materials: attrs.materials, patterns: attrs.patterns });
      setForm((f) => ({ ...f, typeSlug: f.typeSlug || types[0]?.slug || '' }));
    } catch {
      setError('Could not load the form options. Refresh and try again.');
    }
  };

  const toggleColor = (slug: string) =>
    setForm((f) => ({
      ...f,
      colorSlugs: f.colorSlugs.includes(slug) ? f.colorSlugs.filter((c) => c !== slug) : f.colorSlugs.length < 3 ? [...f.colorSlugs, slug] : f.colorSlugs,
    }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const res = await fetch('/api/user/garments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          materialSlug: form.materialSlug || undefined,
          fitSlug: form.fitSlug || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) setError(data.error || 'Could not add the item.');
      else {
        setForm({ ...EMPTY, typeSlug: form.typeSlug });
        setOpen(false);
        onCreated();
      }
    } catch {
      setError('Could not add the item — check your connection.');
    }
    setSaving(false);
  };

  if (!open) {
    return (
      <Button variant="outline" onClick={openForm}>
        <PlusCircle className="w-4 h-4" /> Add my own item
      </Button>
    );
  }

  const select = 'w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-sm text-slate-900 dark:text-white';
  const label = 'block text-xs font-semibold text-slate-600 dark:text-zinc-400 mb-1';
  const visibleColors = (options?.colors ?? []).filter((c) => !colorSearch || c.name.toLowerCase().includes(colorSearch.toLowerCase()));

  return (
    <Card className="mb-8 border-amber-200 dark:border-amber-900/50">
      <CardContent className="p-6">
        <form onSubmit={submit} className="space-y-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-lg font-extrabold text-slate-900 dark:text-white">Add your own item</h2>
              <p className="text-sm text-slate-600 dark:text-zinc-400">Something you own that isn&apos;t in our catalog. Only you can see it.</p>
            </div>
            <button type="button" onClick={() => setOpen(false)} aria-label="Close" className="text-slate-400 hover:text-slate-700 dark:hover:text-white">
              <X className="w-5 h-5" />
            </button>
          </div>

          {error && <p role="alert" className="text-sm text-rose-600 dark:text-rose-400">{error}</p>}
          {!options ? (
            <p className="text-sm text-slate-500 dark:text-zinc-400">Loading options...</p>
          ) : (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className={label} htmlFor="cg-name">Name</label>
                  <Input id="cg-name" required maxLength={80} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. My navy linen shirt" />
                </div>
                <div>
                  <label className={label} htmlFor="cg-type">Type</label>
                  <select id="cg-type" className={select} value={form.typeSlug} onChange={(e) => setForm({ ...form, typeSlug: e.target.value })}>
                    {options.types.map((t) => (
                      <option key={t.slug} value={t.slug}>{t.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className={label} htmlFor="cg-formality">How dressy is it?</label>
                  <select id="cg-formality" className={select} value={form.formalityLevel} onChange={(e) => setForm({ ...form, formalityLevel: Number(e.target.value) })}>
                    {[1, 2, 3, 4, 5].map((n) => (
                      <option key={n} value={n}>{n} — {FORMALITY_LABELS[n]}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className={label} htmlFor="cg-season">Season</label>
                  <select id="cg-season" className={select} value={form.seasonProfile} onChange={(e) => setForm({ ...form, seasonProfile: e.target.value as typeof form.seasonProfile })}>
                    <option value="all">All year</option>
                    <option value="light">Warm weather (light)</option>
                    <option value="heavy">Cold weather (heavy)</option>
                  </select>
                </div>
                <div>
                  <label className={label} htmlFor="cg-pattern">Pattern</label>
                  <select id="cg-pattern" className={select} value={form.patternSlug} onChange={(e) => setForm({ ...form, patternSlug: e.target.value })}>
                    {options.patterns.map((p) => (
                      <option key={p.slug} value={p.slug}>{p.name}</option>
                    ))}
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={label} htmlFor="cg-material">Fabric</label>
                    <select id="cg-material" className={select} value={form.materialSlug} onChange={(e) => setForm({ ...form, materialSlug: e.target.value })}>
                      <option value="">Not sure</option>
                      {options.materials.map((m) => (
                        <option key={m.slug} value={m.slug}>{m.name}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className={label} htmlFor="cg-fit">Fit</label>
                    <select id="cg-fit" className={select} value={form.fitSlug} onChange={(e) => setForm({ ...form, fitSlug: e.target.value })}>
                      <option value="">Not sure</option>
                      {options.fits.map((f) => (
                        <option key={f.slug} value={f.slug}>{f.name}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              <fieldset>
                <legend className={label}>Colors (up to 3, main color first) — {form.colorSlugs.length} selected</legend>
                <Input value={colorSearch} onChange={(e) => setColorSearch(e.target.value)} placeholder="Search colors..." className="mb-2" aria-label="Search colors" />
                <div className="flex flex-wrap gap-1.5 max-h-36 overflow-y-auto pr-1">
                  {visibleColors.map((c) => {
                    const index = form.colorSlugs.indexOf(c.slug);
                    return (
                      <button
                        key={c.slug}
                        type="button"
                        onClick={() => toggleColor(c.slug)}
                        aria-pressed={index >= 0}
                        className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-xs border ${index >= 0 ? 'border-amber-500 bg-amber-500/15 text-amber-900 dark:text-amber-300' : 'border-slate-300 dark:border-zinc-700 text-slate-600 dark:text-zinc-400'}`}
                      >
                        <span className="w-3 h-3 rounded-full border border-black/10" style={{ backgroundColor: c.hex }} aria-hidden="true" />
                        {index >= 0 && <strong>{index + 1}.</strong>}
                        {c.name}
                      </button>
                    );
                  })}
                </div>
              </fieldset>

              <Button type="submit" disabled={saving || !form.name.trim() || form.colorSlugs.length === 0}>
                {saving ? 'Adding...' : 'Add to my closet'}
              </Button>
            </>
          )}
        </form>
      </CardContent>
    </Card>
  );
}
