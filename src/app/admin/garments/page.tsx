'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { StarRating } from '@/components/star-rating';
import { Plus, Trash2, Edit2, X, Save, Shirt } from 'lucide-react';

interface Garment {
  id: string;
  name: string;
  slug: string;
  formalityLevel: number;
  description: string;
  garmentType: { id: string; name: string };
  colors: { color: { id: string; name: string; hex: string } }[];
  fits: { fit: { slug: string } }[];
  materials: { material: { slug: string } }[];
  patterns: { pattern: { slug: string } }[];
}

interface GarmentType {
  id: string;
  name: string;
  slug: string;
}

interface Color {
  id: string;
  name: string;
  hex: string;
}

interface Attribute {
  id: string;
  name: string;
  slug: string;
}

type SeasonProfile = 'light' | 'heavy' | 'all';

const EMPTY_FORM = {
  name: '',
  slug: '',
  garmentTypeId: '',
  description: '',
  formalityLevel: 3,
  colorIds: [] as string[],
  fitSlug: '',
  materialSlug: '',
  patternSlug: '',
  seasonProfile: 'all' as SeasonProfile,
};

export default function AdminGarmentsPage() {
  const [garments, setGarments] = useState<Garment[]>([]);
  const [garmentTypes, setGarmentTypes] = useState<GarmentType[]>([]);
  const [colors, setColors] = useState<Color[]>([]);
  const [fits, setFits] = useState<Attribute[]>([]);
  const [materials, setMaterials] = useState<Attribute[]>([]);
  const [patterns, setPatterns] = useState<Attribute[]>([]);
  const [colorSearch, setColorSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [gRes, typesRes, colorsRes, attrsRes] = await Promise.all([
        fetch('/api/admin/garments'),
        fetch('/api/admin/garments/types'),
        fetch('/api/colors'),
        fetch('/api/admin/garments/attributes'),
      ]);

      const garmentsData = await gRes.json();
      setGarments(Array.isArray(garmentsData) ? garmentsData : []);

      if (typesRes.ok) setGarmentTypes(await typesRes.json());
      if (colorsRes.ok) {
        const colorsData = await colorsRes.json();
        setColors(colorsData.colors || []);
      }
      if (attrsRes.ok) {
        const attrsData = await attrsRes.json();
        setFits(attrsData.fits || []);
        setMaterials(attrsData.materials || []);
        setPatterns(attrsData.patterns || []);
      }
    } catch (error) {
      console.error('Error fetching data:', error);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const method = editingId ? 'PUT' : 'POST';
      const body = editingId ? { ...form, id: editingId } : form;

      const res = await fetch('/api/admin/garments', {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (res.ok) {
        setShowForm(false);
        setEditingId(null);
        setForm(EMPTY_FORM);
        fetchData();
      }
    } catch (error) {
      console.error('Error saving garment:', error);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this garment?')) return;
    try {
      await fetch(`/api/admin/garments?id=${id}`, { method: 'DELETE' });
      fetchData();
    } catch (error) {
      console.error('Error deleting:', error);
    }
  };

  const startEdit = (garment: Garment) => {
    setForm({
      name: garment.name,
      slug: garment.slug,
      garmentTypeId: garment.garmentType.id,
      description: garment.description,
      formalityLevel: garment.formalityLevel,
      colorIds: garment.colors.map((c) => c.color.id),
      fitSlug: garment.fits[0]?.fit.slug || '',
      materialSlug: garment.materials[0]?.material.slug || '',
      patternSlug: garment.patterns[0]?.pattern.slug || '',
      seasonProfile: 'all',
    });
    setEditingId(garment.id);
    setShowForm(true);
  };

  const filteredColors = colors.filter((c) => c.name.toLowerCase().includes(colorSearch.toLowerCase()));

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-white">Garment Manager</h1>
          <p className="text-zinc-400">Add, edit, and manage garments in the encyclopedia.</p>
        </div>
        <Button onClick={() => { setShowForm(!showForm); setEditingId(null); setForm(EMPTY_FORM); }}>
          {showForm ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
          {showForm ? 'Cancel' : 'Add Garment'}
        </Button>
      </div>

      {/* Add/Edit Form */}
      {showForm && (
        <Card className="mb-8 border-amber-500/30">
          <CardHeader>
            <CardTitle>{editingId ? 'Edit Garment' : 'Add New Garment'}</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-zinc-400 mb-1">Name</label>
                  <Input
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value, slug: e.target.value.toLowerCase().replace(/\s+/g, '-') })}
                    placeholder="White Oxford Button-Down Shirt"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-zinc-400 mb-1">Slug</label>
                  <Input
                    value={form.slug}
                    onChange={(e) => setForm({ ...form, slug: e.target.value })}
                    placeholder="white-oxford-button-down-shirt"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-zinc-400 mb-1">Type</label>
                  <select
                    value={form.garmentTypeId}
                    onChange={(e) => setForm({ ...form, garmentTypeId: e.target.value })}
                    className="flex h-10 w-full rounded-lg border border-zinc-700 bg-zinc-800/50 px-3 py-2 text-sm text-zinc-100"
                    required
                  >
                    <option value="">Select type...</option>
                    {garmentTypes.map((t) => (
                      <option key={t.id} value={t.id}>{t.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-zinc-400 mb-1">
                    Formality Level
                  </label>
                  <StarRating
                    rating={form.formalityLevel}
                    interactive
                    onChange={(r) => setForm({ ...form, formalityLevel: r })}
                    size="lg"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-zinc-400 mb-1">Fit</label>
                  <select
                    value={form.fitSlug}
                    onChange={(e) => setForm({ ...form, fitSlug: e.target.value })}
                    className="flex h-10 w-full rounded-lg border border-zinc-700 bg-zinc-800/50 px-3 py-2 text-sm text-zinc-100"
                  >
                    <option value="">No fit set</option>
                    {fits.map((f) => (
                      <option key={f.id} value={f.slug}>{f.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-zinc-400 mb-1">Material</label>
                  <select
                    value={form.materialSlug}
                    onChange={(e) => setForm({ ...form, materialSlug: e.target.value })}
                    className="flex h-10 w-full rounded-lg border border-zinc-700 bg-zinc-800/50 px-3 py-2 text-sm text-zinc-100"
                  >
                    <option value="">No material set</option>
                    {materials.map((m) => (
                      <option key={m.id} value={m.slug}>{m.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-zinc-400 mb-1">Pattern</label>
                  <select
                    value={form.patternSlug}
                    onChange={(e) => setForm({ ...form, patternSlug: e.target.value })}
                    className="flex h-10 w-full rounded-lg border border-zinc-700 bg-zinc-800/50 px-3 py-2 text-sm text-zinc-100"
                  >
                    <option value="">No pattern set</option>
                    {patterns.map((p) => (
                      <option key={p.id} value={p.slug}>{p.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-zinc-400 mb-1">
                    Season Weight
                  </label>
                  <select
                    value={form.seasonProfile}
                    onChange={(e) => setForm({ ...form, seasonProfile: e.target.value as SeasonProfile })}
                    className="flex h-10 w-full rounded-lg border border-zinc-700 bg-zinc-800/50 px-3 py-2 text-sm text-zinc-100"
                  >
                    <option value="light">Light (summer/spring favored)</option>
                    <option value="heavy">Heavy (autumn/winter favored)</option>
                    <option value="all">All-season</option>
                  </select>
                  <p className="text-xs text-zinc-500 mt-1">Auto-computes real season suitability for this garment, replacing flat defaults.</p>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-zinc-400 mb-1">Description</label>
                <textarea
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  className="flex min-h-[80px] w-full rounded-lg border border-zinc-700 bg-zinc-800/50 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-500"
                  placeholder="Expert description of this garment..."
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-zinc-400 mb-1">
                  Colors ({form.colorIds.length} selected)
                </label>
                <Input
                  value={colorSearch}
                  onChange={(e) => setColorSearch(e.target.value)}
                  placeholder="Search colors..."
                  className="mb-2"
                />
                <div className="flex flex-wrap gap-2 max-h-56 overflow-y-auto p-1 border border-zinc-800 rounded-lg">
                  {filteredColors.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => {
                        const ids = form.colorIds.includes(c.id)
                          ? form.colorIds.filter((id) => id !== c.id)
                          : [...form.colorIds, c.id];
                        setForm({ ...form, colorIds: ids });
                      }}
                      className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs border transition-all ${
                        form.colorIds.includes(c.id)
                          ? 'border-amber-500 bg-amber-500/20 text-amber-400'
                          : 'border-zinc-700 text-zinc-400 hover:border-zinc-600'
                      }`}
                    >
                      <span className="w-3 h-3 rounded-full border border-zinc-600" style={{ backgroundColor: c.hex }} />
                      {c.name}
                    </button>
                  ))}
                  {filteredColors.length === 0 && (
                    <p className="text-xs text-zinc-500 p-2">No colors match &quot;{colorSearch}&quot;.</p>
                  )}
                </div>
              </div>
              <Button type="submit">
                <Save className="w-4 h-4" />
                {editingId ? 'Update' : 'Create'} Garment
              </Button>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Garments Table */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="animate-spin w-8 h-8 border-2 border-amber-500 border-t-transparent rounded-full" />
        </div>
      ) : (
        <div className="space-y-3">
          {garments.map((garment) => (
            <Card key={garment.id} className="hover:border-zinc-700">
              <CardContent className="p-4 flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-amber-500/20 to-orange-500/20 flex items-center justify-center">
                    <Shirt className="w-5 h-5 text-amber-400" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-zinc-100">{garment.name}</h3>
                    <div className="flex items-center gap-2 mt-1">
                      <Badge variant="outline">{garment.garmentType.name}</Badge>
                      <StarRating rating={garment.formalityLevel} size="sm" />
                      {garment.colors.map((gc) => (
                        <span
                          key={gc.color.id}
                          className="w-4 h-4 rounded-full border border-zinc-600 inline-block"
                          style={{ backgroundColor: gc.color.hex }}
                          title={gc.color.name}
                        />
                      ))}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button variant="ghost" size="icon" onClick={() => startEdit(garment)}>
                    <Edit2 className="w-4 h-4" />
                  </Button>
                  <Button variant="ghost" size="icon" onClick={() => handleDelete(garment.id)}>
                    <Trash2 className="w-4 h-4 text-red-400" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
          {garments.length === 0 && (
            <div className="text-center py-12 text-zinc-500">
              No garments found. Click &quot;Add Garment&quot; to create one.
            </div>
          )}
        </div>
      )}
    </div>
  );
}
