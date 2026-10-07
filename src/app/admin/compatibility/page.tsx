'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { StarRating } from '@/components/star-rating';
import { Plus, Trash2, GitCompare, Save, X } from 'lucide-react';

interface Rule {
  id: string;
  garmentA: { id: string; name: string };
  garmentB: { id: string; name: string };
  rating: number;
  reason: string;
  compatibilityType: string;
}

interface GarmentOption {
  id: string;
  name: string;
}

export default function AdminCompatibilityPage() {
  const [rules, setRules] = useState<Rule[]>([]);
  const [garments, setGarments] = useState<GarmentOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    garmentAId: '',
    garmentBId: '',
    rating: 4.5,
    reason: '',
    compatibilityType: 'excellent',
  });

  const fetchData = async () => {
    setLoading(true);
    try {
      const [rRes, gRes] = await Promise.all([
        fetch('/api/admin/compatibility'),
        fetch('/api/admin/garments'),
      ]);
      if (rRes.ok) setRules(await rRes.json());
      if (gRes.ok) setGarments(await gRes.json());
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/admin/compatibility', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      if (res.ok) {
        setShowForm(false);
        setForm({ garmentAId: '', garmentBId: '', rating: 4.5, reason: '', compatibilityType: 'excellent' });
        fetchData();
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this rule?')) return;
    await fetch(`/api/admin/compatibility?id=${id}`, { method: 'DELETE' });
    fetchData();
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-white">Garment Compatibility Rules</h1>
          <p className="text-zinc-400">Define expert rules for pairing garment A with garment B.</p>
        </div>
        <Button onClick={() => setShowForm(!showForm)}>
          {showForm ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
          {showForm ? 'Cancel' : 'Add Rule'}
        </Button>
      </div>

      {showForm && (
        <Card className="mb-8 border-amber-500/30">
          <CardHeader>
            <CardTitle>Add New Compatibility Rule</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-zinc-400 mb-1">Garment A</label>
                  <select
                    value={form.garmentAId}
                    onChange={(e) => setForm({ ...form, garmentAId: e.target.value })}
                    className="flex h-10 w-full rounded-lg border border-zinc-700 bg-zinc-800/50 px-3 py-2 text-sm text-zinc-100"
                    required
                  >
                    <option value="">Select Garment A...</option>
                    {garments.map((g) => (
                      <option key={g.id} value={g.id}>{g.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-zinc-400 mb-1">Garment B</label>
                  <select
                    value={form.garmentBId}
                    onChange={(e) => setForm({ ...form, garmentBId: e.target.value })}
                    className="flex h-10 w-full rounded-lg border border-zinc-700 bg-zinc-800/50 px-3 py-2 text-sm text-zinc-100"
                    required
                  >
                    <option value="">Select Garment B...</option>
                    {garments.map((g) => (
                      <option key={g.id} value={g.id}>{g.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-zinc-400 mb-1">Rating (1 to 5 Stars)</label>
                  <StarRating
                    rating={form.rating}
                    interactive
                    onChange={(r) => setForm({ ...form, rating: r })}
                    size="lg"
                    showValue
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-zinc-400 mb-1">Compatibility Type</label>
                  <select
                    value={form.compatibilityType}
                    onChange={(e) => setForm({ ...form, compatibilityType: e.target.value })}
                    className="flex h-10 w-full rounded-lg border border-zinc-700 bg-zinc-800/50 px-3 py-2 text-sm text-zinc-100"
                  >
                    <option value="excellent">Excellent</option>
                    <option value="good">Good</option>
                    <option value="acceptable">Acceptable</option>
                    <option value="avoid">Avoid</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-zinc-400 mb-1">Expert Reason</label>
                <textarea
                  value={form.reason}
                  onChange={(e) => setForm({ ...form, reason: e.target.value })}
                  placeholder="Explain why these garments pair (or clash)..."
                  className="flex min-h-[80px] w-full rounded-lg border border-zinc-700 bg-zinc-800/50 px-3 py-2 text-sm text-zinc-100"
                  required
                />
              </div>
              <Button type="submit">
                <Save className="w-4 h-4" /> Save Rule
              </Button>
            </form>
          </CardContent>
        </Card>
      )}

      {loading ? (
        <div className="py-20 text-center">Loading rules...</div>
      ) : (
        <div className="space-y-3">
          {rules.map((rule) => (
            <Card key={rule.id}>
              <CardContent className="p-4 flex items-center justify-between">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <GitCompare className="w-4 h-4 text-amber-400" />
                    <span className="font-semibold text-zinc-100">{rule.garmentA.name}</span>
                    <span className="text-zinc-500">+</span>
                    <span className="font-semibold text-zinc-100">{rule.garmentB.name}</span>
                    <Badge variant={rule.compatibilityType as 'excellent' | 'good' | 'acceptable' | 'avoid'}>
                      {rule.compatibilityType}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-3">
                    <StarRating rating={rule.rating} size="sm" showValue />
                    <p className="text-xs text-zinc-400 italic">&ldquo;{rule.reason}&rdquo;</p>
                  </div>
                </div>
                <Button variant="ghost" size="icon" onClick={() => handleDelete(rule.id)}>
                  <Trash2 className="w-4 h-4 text-red-400" />
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
