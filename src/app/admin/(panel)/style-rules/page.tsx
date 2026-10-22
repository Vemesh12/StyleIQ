'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Plus, Trash2, Lightbulb, CheckCircle2, ShieldAlert, X, Pencil } from 'lucide-react';

interface StyleRule {
  id: string;
  title: string;
  ruleType: 'dos' | 'donts' | 'pro-tip';
  category: string;
  explanation: string;
  createdAt: string;
}

export default function AdminStyleRulesPage() {
  const [rules, setRules] = useState<StyleRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [form, setForm] = useState<{
    title: string;
    ruleType: 'dos' | 'donts' | 'pro-tip';
    category: string;
    explanation: string;
  }>({
    title: '',
    ruleType: 'dos',
    category: 'general',
    explanation: '',
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);

  const EMPTY_FORM = { title: '', ruleType: 'dos' as const, category: 'general', explanation: '' };

  const openCreate = () => {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setError(null);
    setShowCreateModal(true);
  };

  const openEdit = (rule: StyleRule) => {
    setEditingId(rule.id);
    setForm({ title: rule.title, ruleType: rule.ruleType, category: rule.category, explanation: rule.explanation });
    setError(null);
    setShowCreateModal(true);
  };

  const [loadError, setLoadError] = useState<string | null>(null);

  const loadRules = async (): Promise<StyleRule[]> => {
    const res = await fetch('/api/admin/style-rules');
    if (!res.ok) throw new Error(`Failed to load style rules (${res.status})`);
    return res.json();
  };

  const fetchRules = async () => {
    setLoading(true);
    try {
      setRules(await loadRules());
      setLoadError(null);
    } catch (err) {
      console.error(err);
      setLoadError('Could not load style rules. Refresh to try again.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let active = true;
    loadRules()
      .then((data) => active && setRules(data))
      .catch((err) => {
        console.error(err);
        if (active) setLoadError('Could not load style rules. Refresh to try again.');
      })
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch('/api/admin/style-rules', {
        method: editingId ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editingId ? { ...form, id: editingId } : form),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Failed to save style rule');
      } else {
        setShowCreateModal(false);
        setEditingId(null);
        setForm(EMPTY_FORM);
        fetchRules();
      }
    } catch {
      setError('An unexpected error occurred');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this style rule?')) return;
    try {
      const res = await fetch(`/api/admin/style-rules?id=${id}`, { method: 'DELETE' });
      if (!res.ok && res.status !== 404) {
        alert('Could not delete the style rule.');
        return;
      }
      setRules((prev) => prev.filter((r) => r.id !== id));
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white flex items-center gap-2">
            <Lightbulb className="w-8 h-8 text-amber-500" />
            Style Rules & Tips ({rules.length})
          </h1>
          <p className="text-zinc-400 text-sm mt-1">
            Manage Dos, Don&apos;ts, and Pro-tips displayed across the site.
          </p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="w-4 h-4 mr-1" /> New Rule
        </Button>
      </div>

      {loadError && <p className="text-sm text-red-400 bg-red-500/10 px-3 py-2 rounded-lg">{loadError}</p>}

      {loading ? (
        <div className="text-zinc-400 text-center py-12">Loading style rules...</div>
      ) : rules.length === 0 ? (
        <Card className="bg-zinc-900 border-zinc-800 p-8 text-center">
          <p className="text-zinc-400">No style rules found. Click &quot;New Rule&quot; to add one.</p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {rules.map((rule) => {
            const isDo = rule.ruleType === 'dos';
            const isDont = rule.ruleType === 'donts';

            return (
              <Card key={rule.id} className="bg-zinc-900 border-zinc-800 flex flex-col justify-between">
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between mb-1">
                    <Badge variant="outline" className="text-xs uppercase text-zinc-300 border-zinc-700">
                      {rule.category}
                    </Badge>
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded flex items-center gap-1 ${
                        isDo
                          ? 'bg-emerald-950/60 text-emerald-400'
                          : isDont
                          ? 'bg-red-950/60 text-red-400'
                          : 'bg-amber-950/60 text-amber-400'
                      }`}
                    >
                      {isDo && <CheckCircle2 className="w-3 h-3" />}
                      {isDont && <ShieldAlert className="w-3 h-3" />}
                      {rule.ruleType.toUpperCase()}
                    </span>
                  </div>
                  <CardTitle className="text-base text-white font-bold">
                    {rule.title}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <p className="text-xs text-zinc-400 leading-relaxed font-normal">
                    {rule.explanation}
                  </p>
                  <div className="flex items-center justify-end gap-1 pt-2 border-t border-zinc-800">
                    <button
                      onClick={() => openEdit(rule)}
                      className="p-1.5 rounded text-zinc-500 hover:text-amber-400 hover:bg-amber-500/10 transition-colors"
                      title="Edit"
                    >
                      <Pencil className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDelete(rule.id)}
                      className="p-1.5 rounded text-zinc-500 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                      title="Delete"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Create Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <Card className="bg-zinc-900 border-zinc-800 w-full max-w-lg">
            <CardHeader className="flex flex-row items-center justify-between border-b border-zinc-800">
              <CardTitle className="text-lg text-white">{editingId ? 'Edit Style Rule' : 'Create New Style Rule'}</CardTitle>
              <button
                onClick={() => setShowCreateModal(false)}
                className="text-zinc-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </CardHeader>
            <CardContent className="p-6">
              <form onSubmit={handleCreate} className="space-y-4">
                {error && (
                  <div className="p-3 rounded-lg bg-red-950/50 border border-red-900 text-red-300 text-xs">
                    {error}
                  </div>
                )}
                <div>
                  <label className="text-xs font-semibold text-zinc-300 block mb-1">Rule Type</label>
                  <select
                    value={form.ruleType}
                    onChange={(e) => setForm({ ...form, ruleType: e.target.value as 'dos' | 'donts' | 'pro-tip' })}
                    className="w-full px-3 py-2 rounded-lg bg-zinc-800 border border-zinc-700 text-white text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
                  >
                    <option value="dos">Always Do (Do)</option>
                    <option value="donts">Never Do (Don&apos;t)</option>
                    <option value="pro-tip">Pro Tip / Secret</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs font-semibold text-zinc-300 block mb-1">Title</label>
                  <input
                    type="text"
                    required
                    value={form.title}
                    onChange={(e) => setForm({ ...form, title: e.target.value })}
                    placeholder="e.g. Always match leather belt color to leather shoes"
                    className="w-full px-3 py-2 rounded-lg bg-zinc-800 border border-zinc-700 text-white text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-zinc-300 block mb-1">Category</label>
                  <select
                    value={form.category}
                    onChange={(e) => setForm({ ...form, category: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg bg-zinc-800 border border-zinc-700 text-white text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
                  >
                    <option value="general">General</option>
                    <option value="color">Color</option>
                    <option value="fit">Fit & Tailoring</option>
                    <option value="occasion">Occasion & Dress Code</option>
                    <option value="accessory">Accessories & Footwear</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs font-semibold text-zinc-300 block mb-1">Explanation</label>
                  <textarea
                    required
                    rows={4}
                    value={form.explanation}
                    onChange={(e) => setForm({ ...form, explanation: e.target.value })}
                    placeholder="Explain why this rule matters and how to execute it properly..."
                    className="w-full px-3 py-2 rounded-lg bg-zinc-800 border border-zinc-700 text-white text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
                  />
                </div>
                <div className="flex justify-end gap-3 pt-4 border-t border-zinc-800">
                  <Button type="button" variant="outline" onClick={() => setShowCreateModal(false)}>
                    Cancel
                  </Button>
                  <Button type="submit" disabled={submitting}>
                    {submitting ? 'Saving...' : editingId ? 'Save Changes' : 'Create Rule'}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
