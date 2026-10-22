'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Palette, Plus, Save, Trash2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';

interface ColorOption {
  id: string;
  name: string;
  slug: string;
  hex: string;
}
interface ColorRule {
  id: string;
  score: number;
  harmony: string;
  reason: string;
  colorA: ColorOption;
  colorB: ColorOption;
}

const EMPTY = { colorA: '', colorB: '', score: 9, harmony: 'Classic Pairing', reason: '' };
const HARMONY_SUGGESTIONS = ['Classic Pairing', 'Neutral Anchor', 'Perfect Contrast', 'Rich Contrast', 'Neighbour Colors', 'Tonal Neutrals', 'Near-Miss Neutrals', 'Clash'];

const loadRules = async (): Promise<{ rules: ColorRule[]; colors: ColorOption[] }> => {
  const res = await fetch('/api/admin/color-rules');
  if (!res.ok) throw new Error(`Failed to load (${res.status})`);
  return res.json();
};

/** Curated color pairs — they override the color-wheel math for that pair everywhere. */
export default function AdminColorRulesPage() {
  const [rules, setRules] = useState<ColorRule[]>([]);
  const [colors, setColors] = useState<ColorOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const [formError, setFormError] = useState<string | null>(null);
  const [filter, setFilter] = useState('');

  const apply = useCallback((data: { rules: ColorRule[]; colors: ColorOption[] }) => {
    setRules(data.rules);
    setColors(data.colors);
    setLoadError(null);
  }, []);

  useEffect(() => {
    let active = true;
    loadRules()
      .then((d) => active && apply(d))
      .catch(() => active && setLoadError('Could not load color rules. Refresh to try again.'))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [apply]);

  const refresh = async () => {
    try {
      apply(await loadRules());
    } catch {
      setLoadError('Could not reload color rules.');
    }
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    const res = await fetch('/api/admin/color-rules', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setFormError(data.error || 'Could not save the rule.');
      return;
    }
    setShowForm(false);
    setForm(EMPTY);
    refresh();
  };

  const edit = (r: ColorRule) => {
    setForm({ colorA: r.colorA.slug, colorB: r.colorB.slug, score: r.score, harmony: r.harmony, reason: r.reason });
    setFormError(null);
    setShowForm(true);
  };

  const remove = async (id: string) => {
    if (!confirm('Delete this color rule? The pair will fall back to color-wheel math.')) return;
    const res = await fetch(`/api/admin/color-rules?id=${id}`, { method: 'DELETE' });
    if (res.ok || res.status === 404) setRules((prev) => prev.filter((r) => r.id !== id));
  };

  const visible = useMemo(() => {
    const q = filter.trim().toLowerCase();
    return q ? rules.filter((r) => `${r.colorA.name} ${r.colorB.name} ${r.harmony}`.toLowerCase().includes(q)) : rules;
  }, [rules, filter]);

  const select = 'flex h-10 w-full rounded-lg border border-zinc-700 bg-zinc-800/50 px-3 py-2 text-sm text-zinc-100';
  const swatch = (c: ColorOption) => <span className="inline-block w-4 h-4 rounded-full border border-zinc-600 align-middle mr-1.5" style={{ backgroundColor: c.hex }} aria-hidden="true" />;

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-white flex items-center gap-2">
            <Palette className="w-8 h-8 text-amber-500" /> Color Rules ({rules.length})
          </h1>
          <p className="text-zinc-400 text-sm mt-1">Curated color pairs override the color-wheel math everywhere. Below 6 counts as a clash.</p>
        </div>
        <Button onClick={() => { setShowForm(!showForm); setForm(EMPTY); setFormError(null); }}>
          {showForm ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />} {showForm ? 'Cancel' : 'Add Rule'}
        </Button>
      </div>

      {loadError && <p className="mb-6 text-sm text-red-400 bg-red-500/10 px-3 py-2 rounded-lg">{loadError}</p>}

      {showForm && (
        <Card className="mb-8 border-amber-500/30">
          <CardHeader>
            <CardTitle>Color rule</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={save} className="space-y-4">
              {formError && <p className="text-sm text-red-400 bg-red-500/10 px-3 py-2 rounded-lg">{formError}</p>}
              <p className="text-xs text-zinc-500">A pair is one rule in either order — saving an existing pair updates it.</p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {(['colorA', 'colorB'] as const).map((key, i) => (
                  <div key={key}>
                    <label className="block text-sm font-medium text-zinc-400 mb-1" htmlFor={key}>Color {i === 0 ? 'A' : 'B'}</label>
                    <select id={key} required className={select} value={form[key]} onChange={(e) => setForm({ ...form, [key]: e.target.value })}>
                      <option value="">Select a color...</option>
                      {colors.map((c) => (
                        <option key={c.slug} value={c.slug}>{c.name}</option>
                      ))}
                    </select>
                  </div>
                ))}
                <div>
                  <label className="block text-sm font-medium text-zinc-400 mb-1" htmlFor="score">Score (0-10)</label>
                  <Input id="score" type="number" min={0} max={10} step={0.1} required value={form.score} onChange={(e) => setForm({ ...form, score: Number(e.target.value) })} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-zinc-400 mb-1" htmlFor="harmony">Label</label>
                  <Input id="harmony" list="harmony-options" required maxLength={60} value={form.harmony} onChange={(e) => setForm({ ...form, harmony: e.target.value })} />
                  <datalist id="harmony-options">
                    {HARMONY_SUGGESTIONS.map((h) => <option key={h} value={h} />)}
                  </datalist>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-zinc-400 mb-1" htmlFor="reason">Why (shown to users)</label>
                <textarea id="reason" maxLength={500} value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} className="flex min-h-[70px] w-full rounded-lg border border-zinc-700 bg-zinc-800/50 px-3 py-2 text-sm text-zinc-100" />
              </div>
              <Button type="submit"><Save className="w-4 h-4" /> Save Rule</Button>
            </form>
          </CardContent>
        </Card>
      )}

      <Input value={filter} onChange={(e) => setFilter(e.target.value)} placeholder="Filter by color or label..." className="mb-4 max-w-sm" aria-label="Filter rules" />

      {loading ? (
        <div className="py-20 text-center text-zinc-400">Loading color rules...</div>
      ) : (
        <div className="space-y-2">
          {visible.map((r) => (
            <Card key={r.id}>
              <CardContent className="p-4 flex items-center justify-between gap-4">
                <div className="min-w-0 space-y-1">
                  <div className="flex items-center gap-2 flex-wrap text-zinc-100 font-semibold">
                    <span>{swatch(r.colorA)}{r.colorA.name}</span>
                    <span className="text-zinc-500">+</span>
                    <span>{swatch(r.colorB)}{r.colorB.name}</span>
                    <Badge variant={r.score < 6 ? 'avoid' : r.score >= 9 ? 'excellent' : 'good'}>{r.score.toFixed(1)} · {r.harmony}</Badge>
                  </div>
                  {r.reason && <p className="text-xs text-zinc-400 truncate">{r.reason}</p>}
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <Button variant="ghost" size="sm" onClick={() => edit(r)}>Edit</Button>
                  <Button variant="ghost" size="icon" onClick={() => remove(r.id)} aria-label={`Delete ${r.colorA.name} + ${r.colorB.name}`}>
                    <Trash2 className="w-4 h-4 text-red-400" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
          {visible.length === 0 && <p className="text-zinc-500 text-sm">No rules match.</p>}
        </div>
      )}
    </div>
  );
}
