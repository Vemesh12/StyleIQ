'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { CategoryIcon } from '@/components/category-icon';
import { GarmentIllustration } from '@/components/garment-illustration';
import { StarRating } from '@/components/star-rating';
import {
  Sparkles,
  UserCheck,
  Palette,
  Shirt,
  CheckCircle2,
  ShieldAlert,
  ArrowRight,
  RotateCcw,
  Check,
  Info,
} from 'lucide-react';

interface Options {
  hairColors: string[];
  eyeColors: string[];
  skinTones: string[];
  underTones: string[];
  torsoLengths: string[];
  bodyProportions: string[];
}

interface PersonalizationResult {
  recommendedClothingColors: string;
  avoidClothingColors: string;
  recommendedFittingStyle: string;
  recommendedMaterials: string;
  recommendedPatterns: string;
  recommendedJewelryMetal: string;
  recommendedShoes: string;
  recommendedClothingColorWheelRegion: string;
  avoidClothingColorWheelRegion: string;
  fabricNature: string;
  dontExaggerate: string;
  doExaggerate: string;
}

interface GarmentColorSummary {
  name: string;
  hex: string;
  slug?: string;
}

interface DbColor {
  id: string;
  name: string;
  hex: string;
  slug: string;
  family: string;
  isNeutral: boolean;
}

type CandidateRating = 'excellent' | 'good' | 'risky' | 'avoid';

interface ScoredCandidate {
  id: string;
  name: string;
  slug: string;
  typeSlug: string;
  formalityLevel: number;
  description: string;
  colors: GarmentColorSummary[];
  score: number;
  rating: CandidateRating;
  warnings: string[];
  colorHarmonyDetail: { harmony: string; reason: string } | null;
}

interface OutfitSetItem {
  slot: string;
  typeSlug: string;
  name: string;
  colors: GarmentColorSummary[];
  itemScore: number;
}

interface OutfitSet {
  id: string;
  title: string;
  confidenceScore: number;
  rating: CandidateRating;
  items: OutfitSetItem[];
  warnings: string[];
}

interface PickerResult {
  inputSummary: {
    category: string;
    itemType: string;
    colors: GarmentColorSummary[];
    occasion: string | null;
    season: string | null;
  };
  recommendation: {
    outfitSets: OutfitSet[];
    candidatesByType: Record<string, ScoredCandidate[]>;
    psychologyAdvice: string;
    colorWheelHarmony: { harmony: string; reason: string } | null;
  };
}

interface CategoryMeta {
  slug: string;
  label: string;
  itemTypes: { id: string; label: string }[];
}

const CATEGORIES: CategoryMeta[] = [
  {
    slug: 'shirt',
    label: 'Shirt / Top',
    itemTypes: [
      { id: 'formal-solid', label: 'Formal Plain Shirt' },
      { id: 'checks', label: 'Check Shirt' },
      { id: 'stripe', label: 'Line / Striped Shirt' },
      { id: 'printed', label: 'Printed Shirt' },
    ],
  },
  {
    slug: 'tshirt',
    label: 'T-Shirt',
    itemTypes: [
      { id: 'casual-plain', label: 'Plain Casual Tee' },
      { id: 'stripe', label: 'Striped Tee' },
      { id: 'printed', label: 'Printed / Graphic Tee' },
    ],
  },
  {
    slug: 'polo',
    label: 'Polo Shirt',
    itemTypes: [
      { id: 'formal-solid', label: 'Solid Polo' },
      { id: 'stripe', label: 'Striped Polo' },
    ],
  },
  {
    slug: 'trouser',
    label: 'Pant / Trouser',
    itemTypes: [
      { id: 'chinos', label: 'Cotton Chino Pants' },
      { id: 'formal-trousers', label: 'Formal Pants' },
      { id: 'denim-jeans', label: 'Jeans Pants' },
      { id: 'linen-trousers', label: 'Linen Pants' },
    ],
  },
  {
    slug: 'shoe',
    label: 'Footwear',
    itemTypes: [
      { id: 'oxfords', label: 'Formal Leather Shoes' },
      { id: 'loafers', label: 'Loafer Shoes' },
      { id: 'chelsea', label: 'Boots / Ankle Shoes' },
      { id: 'sneakers', label: 'Casual Sneakers' },
    ],
  },
  {
    slug: 'belt',
    label: 'Leather Belt',
    itemTypes: [
      { id: 'formal-leather', label: 'Formal Leather Belt' },
      { id: 'casual-suede', label: 'Casual Belt' },
      { id: 'woven', label: 'Cloth / Woven Belt' },
    ],
  },
  {
    slug: 'jacket',
    label: 'Blazer / Jacket',
    itemTypes: [
      { id: 'blazer', label: 'Blazer / Coat' },
      { id: 'suit-jacket', label: 'Formal Suit Coat' },
      { id: 'casual-jacket', label: 'Casual Jacket' },
    ],
  },
  {
    slug: 'sweater',
    label: 'Sweater',
    itemTypes: [
      { id: 'formal-solid', label: 'Solid Sweater' },
      { id: 'cable-knit', label: 'Cable Knit Sweater' },
    ],
  },
  {
    slug: 'cardigan',
    label: 'Cardigan',
    itemTypes: [{ id: 'formal-solid', label: 'Solid Cardigan' }],
  },
  {
    slug: 'hoodie',
    label: 'Hoodie',
    itemTypes: [{ id: 'casual', label: 'Casual Hoodie' }],
  },
  {
    slug: 'knitwear',
    label: 'Knitwear',
    itemTypes: [
      { id: 'formal-solid', label: 'Solid Knitwear' },
      { id: 'cable-knit', label: 'Cable Knit' },
    ],
  },
  {
    slug: 'tie',
    label: 'Tie',
    itemTypes: [
      { id: 'formal-solid', label: 'Solid Silk Tie' },
      { id: 'stripe', label: 'Striped Tie' },
    ],
  },
  {
    slug: 'pocket-square',
    label: 'Pocket Square',
    itemTypes: [
      { id: 'formal-solid', label: 'Solid Pocket Square' },
      { id: 'printed', label: 'Patterned Pocket Square' },
    ],
  },
  {
    slug: 'watch',
    label: 'Watch',
    itemTypes: [
      { id: 'formal-solid', label: 'Dress Watch' },
      { id: 'casual', label: 'Casual Watch' },
    ],
  },
  {
    slug: 'accessory',
    label: 'Other Accessory',
    itemTypes: [
      { id: 'formal-solid', label: 'Solid Accessory' },
      { id: 'casual', label: 'Casual Accessory' },
    ],
  },
];

const RATING_STYLES: Record<CandidateRating, { label: string; className: string }> = {
  excellent: { label: 'Great Choice', className: 'bg-emerald-600 text-white' },
  good: { label: 'Solid Choice', className: 'bg-amber-600 text-white' },
  risky: { label: 'Might Not Work', className: 'bg-orange-600 text-white' },
  avoid: { label: 'Try Something Else', className: 'bg-rose-600 text-white' },
};

export default function StyleAdvisorPage() {
  const [activeTab, setActiveTab] = useState<'profile' | 'picker'>('profile');

  // Physical Profile state
  const [options, setOptions] = useState<Options | null>(null);
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState({
    hairColor: '',
    eyeColor: '',
    skinTone: '',
    underTone: '',
    torsoLength: '',
    bodyProportion: '',
  });
  const [result, setResult] = useState<PersonalizationResult | null>(null);
  const [submitting, setSubmitting] = useState(false);

// Outfit Picker state
  const [pickerCategory, setPickerCategory] = useState<string>('shirt');
  const [pickerItemType, setPickerItemType] = useState<string>('formal-solid');
  const [pickerStep, setPickerStep] = useState<number>(1);
  const [selectedColorSlugs, setSelectedColorSlugs] = useState<string[]>(['navy-blue']);
  const [pickerOccasionSlug, setPickerOccasionSlug] = useState<string>('');
  const [pickerSeasonSlug, setPickerSeasonSlug] = useState<string>('');
  const [pickerResult, setPickerResult] = useState<PickerResult | null>(null);
  const [pickerLoading, setPickerLoading] = useState(false);
  const [pickerError, setPickerError] = useState<string | null>(null);

  const [colorPalette, setColorPalette] = useState<Record<string, DbColor[]>>({});
  const [colorSearch, setColorSearch] = useState('');
  const [occasionOptions, setOccasionOptions] = useState<{ id: string; name: string; slug: string }[]>([]);
  const [seasonOptions, setSeasonOptions] = useState<{ id: string; name: string; slug: string }[]>([]);

  useEffect(() => {
    fetch('/api/personalization/options')
      .then((res) => res.json())
      .then((data) => {
        setOptions(data);
        if (data.hairColors?.length) {
          setProfile({
            hairColor: data.hairColors[0],
            eyeColor: data.eyeColors[0] || '',
            skinTone: data.skinTones[0] || '',
            underTone: data.underTones[0] || '',
            torsoLength: data.torsoLengths[0] || '',
            bodyProportion: data.bodyProportions[0] || '',
          });
        }
        setLoading(false);
      });

    fetch('/api/colors')
      .then((res) => res.json())
      .then((data) => setColorPalette(data.groupedByFamily || {}));

    fetch('/api/garments?listOccasions=true')
      .then((res) => res.json())
      .then((data) => setOccasionOptions(Array.isArray(data) ? data : []));

    fetch('/api/garments?listSeasons=true')
      .then((res) => res.json())
      .then((data) => setSeasonOptions(Array.isArray(data) ? data : []));
  }, []);

  const handleGenerateProfile = async () => {
    setSubmitting(true);
    try {
      const res = await fetch('/api/personalization/recommend', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(profile),
      });
      const data = await res.json();
      if (res.ok) {
        setResult(data);
      }
    } catch (e) {
      console.error(e);
    }
    setSubmitting(false);
  };

  const handleCategoryChange = (cat: string) => {
    setPickerCategory(cat);
    const meta = CATEGORIES.find((c) => c.slug === cat);
    setPickerItemType(meta?.itemTypes[0]?.id || 'formal-solid');
  };

  const toggleColorSelection = (slug: string) => {
    if (selectedColorSlugs.includes(slug)) {
      if (selectedColorSlugs.length > 1) {
        setSelectedColorSlugs(selectedColorSlugs.filter((s) => s !== slug));
      }
    } else {
      setSelectedColorSlugs([...selectedColorSlugs, slug]);
    }
  };

  const handleCalculatePicker = async () => {
    setPickerLoading(true);
    setPickerError(null);
    try {
      const res = await fetch('/api/advisor/picker-recommend', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          category: pickerCategory,
          itemType: pickerItemType,
          colorSlugs: selectedColorSlugs,
          skinTone: profile.skinTone || undefined,
          occasionSlug: pickerOccasionSlug || undefined,
          seasonSlug: pickerSeasonSlug || undefined,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setPickerResult(data);
        setPickerStep(3);
      } else {
        setPickerError(data.error || 'Failed to generate recommendations.');
      }
    } catch (err) {
      console.error(err);
      setPickerError('Failed to generate recommendations.');
    }
    setPickerLoading(false);
  };

  const resetPicker = () => {
    setPickerStep(1);
    setPickerResult(null);
    setPickerError(null);
  };

  const filteredColorPalette: Record<string, DbColor[]> = colorSearch.trim()
    ? Object.fromEntries(
        Object.entries(colorPalette)
          .map(([family, colors]) => [
            family,
            colors.filter((c) => c.name.toLowerCase().includes(colorSearch.trim().toLowerCase())),
          ])
          .filter(([, colors]) => (colors as DbColor[]).length > 0)
      )
    : colorPalette;

  return (
    <div className="w-full px-4 sm:px-8 lg:px-12 py-12 bg-slate-50 dark:bg-zinc-950 min-h-screen transition-colors duration-300">
      {/* Header */}
      <div className="text-center mb-8">
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-amber-100 dark:bg-amber-500/10 border border-amber-300 dark:border-amber-500/20 text-amber-900 dark:text-amber-400 text-sm font-semibold mb-3 shadow-2xs">
          <Sparkles className="w-4 h-4 text-amber-600 dark:text-amber-400" />
          StyleIQ Intelligence Engine
        </div>
        <h1 className="text-4xl md:text-5xl font-extrabold text-slate-900 dark:text-white mb-3">
          Personal Style Advisor
        </h1>
        <p className="text-slate-600 dark:text-zinc-400 max-w-2xl mx-auto text-lg font-medium">
          Choose physical personalization rules or pick an item to get instant color harmony & outfit recommendations.
        </p>
      </div>

      {/* Navigation Tabs Switcher */}
      <div className="flex justify-center mb-10">
        <div className="p-1.5 bg-slate-200 dark:bg-zinc-900 rounded-2xl inline-flex gap-2 border border-slate-300 dark:border-zinc-800 shadow-inner">
          <button
            onClick={() => setActiveTab('profile')}
            className={`flex items-center gap-2 px-6 py-2.5 rounded-xl font-extrabold text-sm transition-all duration-200 cursor-pointer ${
              activeTab === 'profile'
                ? 'bg-amber-600 text-white shadow-md'
                : 'text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <UserCheck className="w-4 h-4" />
            1. Physical Profile Advisor
          </button>

          <button
            onClick={() => setActiveTab('picker')}
            className={`flex items-center gap-2 px-6 py-2.5 rounded-xl font-extrabold text-sm transition-all duration-200 cursor-pointer ${
              activeTab === 'picker'
                ? 'bg-amber-600 text-white shadow-md'
                : 'text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <Shirt className="w-4 h-4" />
            2. Item-Based Outfit Picker
          </button>
        </div>
      </div>

      {/* ============================================================ */}
      {/* TAB 1: PHYSICAL PROFILE ADVISOR */}
      {/* ============================================================ */}
      {activeTab === 'profile' && (
        <>
          {loading ? (
            <div className="py-20 text-center flex flex-col items-center justify-center">
              <div className="animate-spin w-10 h-10 border-2 border-amber-600 dark:border-amber-400 border-t-transparent rounded-full mb-4" />
              <p className="text-slate-600 dark:text-zinc-400 font-medium">Loading Personalization Engine...</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
              {/* Profile Form (Left Column) */}
              <div className="lg:col-span-5 space-y-6">
                <Card className="border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-xl text-slate-900 dark:text-white">
                      <UserCheck className="w-5 h-5 text-amber-600 dark:text-amber-400" />
                      Your Physical Profile
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {/* Hair Color */}
                    <div>
                      <label className="block text-xs font-bold text-slate-500 dark:text-zinc-400 uppercase tracking-wider mb-1.5">
                        Hair Color
                      </label>
                      <select
                        value={profile.hairColor}
                        onChange={(e) => setProfile({ ...profile, hairColor: e.target.value })}
                        className="flex h-10 w-full rounded-lg border border-slate-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-3 py-2 text-sm text-slate-900 dark:text-white font-medium shadow-2xs focus:border-amber-500 focus:outline-none"
                      >
                        {options?.hairColors.map((hc) => (
                          <option key={hc} value={hc}>{hc}</option>
                        ))}
                      </select>
                    </div>

                    {/* Eye Color */}
                    <div>
                      <label className="block text-xs font-bold text-slate-500 dark:text-zinc-400 uppercase tracking-wider mb-1.5">
                        Eye Color
                      </label>
                      <select
                        value={profile.eyeColor}
                        onChange={(e) => setProfile({ ...profile, eyeColor: e.target.value })}
                        className="flex h-10 w-full rounded-lg border border-slate-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-3 py-2 text-sm text-slate-900 dark:text-white font-medium shadow-2xs focus:border-amber-500 focus:outline-none"
                      >
                        {options?.eyeColors.map((ec) => (
                          <option key={ec} value={ec}>{ec}</option>
                        ))}
                      </select>
                    </div>

                    {/* Skin Tone */}
                    <div>
                      <label className="block text-xs font-bold text-slate-500 dark:text-zinc-400 uppercase tracking-wider mb-1.5">
                        Skin Tone
                      </label>
                      <select
                        value={profile.skinTone}
                        onChange={(e) => setProfile({ ...profile, skinTone: e.target.value })}
                        className="flex h-10 w-full rounded-lg border border-slate-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-3 py-2 text-sm text-slate-900 dark:text-white font-medium shadow-2xs focus:border-amber-500 focus:outline-none"
                      >
                        {options?.skinTones.map((st) => (
                          <option key={st} value={st}>{st}</option>
                        ))}
                      </select>
                    </div>

                    {/* Undertone */}
                    <div>
                      <label className="block text-xs font-bold text-slate-500 dark:text-zinc-400 uppercase tracking-wider mb-1.5">
                        Skin Undertone
                      </label>
                      <select
                        value={profile.underTone}
                        onChange={(e) => setProfile({ ...profile, underTone: e.target.value })}
                        className="flex h-10 w-full rounded-lg border border-slate-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-3 py-2 text-sm text-slate-900 dark:text-white font-medium shadow-2xs focus:border-amber-500 focus:outline-none"
                      >
                        {options?.underTones.map((ut) => (
                          <option key={ut} value={ut}>{ut} Undertone</option>
                        ))}
                      </select>
                    </div>

                    {/* Torso Length */}
                    <div>
                      <label className="block text-xs font-bold text-slate-500 dark:text-zinc-400 uppercase tracking-wider mb-1.5">
                        Torso Proportion
                      </label>
                      <select
                        value={profile.torsoLength}
                        onChange={(e) => setProfile({ ...profile, torsoLength: e.target.value })}
                        className="flex h-10 w-full rounded-lg border border-slate-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-3 py-2 text-sm text-slate-900 dark:text-white font-medium shadow-2xs focus:border-amber-500 focus:outline-none"
                      >
                        {options?.torsoLengths.map((tl) => (
                          <option key={tl} value={tl}>{tl}</option>
                        ))}
                      </select>
                    </div>

                    {/* Body Shape */}
                    <div>
                      <label className="block text-xs font-bold text-slate-500 dark:text-zinc-400 uppercase tracking-wider mb-1.5">
                        Body Shape / Proportion
                      </label>
                      <select
                        value={profile.bodyProportion}
                        onChange={(e) => setProfile({ ...profile, bodyProportion: e.target.value })}
                        className="flex h-10 w-full rounded-lg border border-slate-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-3 py-2 text-sm text-slate-900 dark:text-white font-medium shadow-2xs focus:border-amber-500 focus:outline-none"
                      >
                        {options?.bodyProportions.map((bp) => (
                          <option key={bp} value={bp}>{bp}</option>
                        ))}
                      </select>
                    </div>

                    <Button onClick={handleGenerateProfile} className="w-full mt-4" disabled={submitting}>
                      {submitting ? (
                        'Analyzing Rules...'
                      ) : (
                        <>
                          <Sparkles className="w-4 h-4" />
                          Get Personal Styling Recommendations
                        </>
                      )}
                    </Button>
                  </CardContent>
                </Card>
              </div>

              {/* Results Output (Right Column) */}
              <div className="lg:col-span-7">
                {result ? (
                  <div className="space-y-6 animate-fade-in">
                    {/* Colors to Wear vs Avoid */}
                    <Card className="border-emerald-200 dark:border-emerald-900/50 bg-white dark:bg-zinc-900">
                      <CardHeader>
                        <CardTitle className="flex items-center gap-2 text-xl text-emerald-800 dark:text-emerald-400">
                          <Palette className="w-5 h-5" />
                          Your Personal Color Palette
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <div>
                          <span className="text-xs font-bold text-emerald-700 dark:text-emerald-400 uppercase tracking-wider block mb-1">
                            Recommended Colors
                          </span>
                          <p className="text-sm font-semibold text-slate-900 dark:text-white leading-relaxed">
                            {result.recommendedClothingColors}
                          </p>
                          <span className="text-xs text-slate-500 dark:text-zinc-400 mt-1 block">
                            Color Wheel Region: {result.recommendedClothingColorWheelRegion}
                          </span>
                        </div>

                        <div className="pt-3 border-t border-slate-100 dark:border-zinc-800">
                          <span className="text-xs font-bold text-rose-700 dark:text-rose-400 uppercase tracking-wider block mb-1">
                            Colors to Avoid
                          </span>
                          <p className="text-sm font-semibold text-slate-900 dark:text-white leading-relaxed">
                            {result.avoidClothingColors}
                          </p>
                          <span className="text-xs text-slate-500 dark:text-zinc-400 mt-1 block">
                            Avoid Wheel Region: {result.avoidClothingColorWheelRegion}
                          </span>
                        </div>
                      </CardContent>
                    </Card>

                    {/* Fit & Fabric Guidance */}
                    <Card className="border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900">
                      <CardHeader>
                        <CardTitle className="flex items-center gap-2 text-xl text-slate-900 dark:text-white">
                          <Shirt className="w-5 h-5 text-amber-600 dark:text-amber-400" />
                          Flattering Cuts & Fabrics
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="p-4 rounded-xl bg-slate-50 dark:bg-zinc-800/50 border border-slate-100 dark:border-zinc-700/50">
                          <span className="text-xs font-bold text-slate-500 dark:text-zinc-400 uppercase tracking-wider block mb-1">Fit Style</span>
                          <p className="text-sm font-bold text-slate-900 dark:text-white">{result.recommendedFittingStyle}</p>
                        </div>

                        <div className="p-4 rounded-xl bg-slate-50 dark:bg-zinc-800/50 border border-slate-100 dark:border-zinc-700/50">
                          <span className="text-xs font-bold text-slate-500 dark:text-zinc-400 uppercase tracking-wider block mb-1">Fabrics & Materials</span>
                          <p className="text-sm font-bold text-slate-900 dark:text-white">{result.recommendedMaterials}</p>
                          <span className="text-xs text-slate-500 dark:text-zinc-400 mt-1 block">{result.fabricNature}</span>
                        </div>

                        <div className="p-4 rounded-xl bg-slate-50 dark:bg-zinc-800/50 border border-slate-100 dark:border-zinc-700/50">
                          <span className="text-xs font-bold text-slate-500 dark:text-zinc-400 uppercase tracking-wider block mb-1">Patterns</span>
                          <p className="text-sm font-bold text-slate-900 dark:text-white">{result.recommendedPatterns}</p>
                        </div>

                        <div className="p-4 rounded-xl bg-slate-50 dark:bg-zinc-800/50 border border-slate-100 dark:border-zinc-700/50">
                          <span className="text-xs font-bold text-slate-500 dark:text-zinc-400 uppercase tracking-wider block mb-1">Shoes & Metals</span>
                          <p className="text-sm font-bold text-slate-900 dark:text-white">{result.recommendedShoes}</p>
                          <span className="text-xs text-amber-700 dark:text-amber-400 mt-1 block font-semibold">Metal: {result.recommendedJewelryMetal}</span>
                        </div>
                      </CardContent>
                    </Card>

                    {/* Proportion Rules */}
                    <Card className="border-amber-200 dark:border-amber-900/50 bg-white dark:bg-zinc-900">
                      <CardHeader>
                        <CardTitle className="flex items-center gap-2 text-xl text-slate-900 dark:text-white">
                          <CheckCircle2 className="w-5 h-5 text-amber-600 dark:text-amber-400" />
                          Proportion & Silhouette Golden Rules
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <div className="flex items-start gap-3">
                          <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                          <div>
                            <span className="text-xs font-bold text-emerald-700 dark:text-emerald-400 uppercase tracking-wider block">DO Accentuate</span>
                            <p className="text-sm font-medium text-slate-800 dark:text-zinc-200">{result.doExaggerate}</p>
                          </div>
                        </div>

                        <div className="flex items-start gap-3 pt-3 border-t border-slate-100 dark:border-zinc-800">
                          <ShieldAlert className="w-5 h-5 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
                          <div>
                            <span className="text-xs font-bold text-rose-700 dark:text-rose-400 uppercase tracking-wider block">DON&apos;T Exaggerate</span>
                            <p className="text-sm font-medium text-slate-800 dark:text-zinc-200">{result.dontExaggerate}</p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                ) : (
                  <Card className="border-dashed border-2 border-slate-300 dark:border-zinc-800 bg-white/50 dark:bg-zinc-900/50 p-12 text-center">
                    <UserCheck className="w-12 h-12 text-slate-400 dark:text-zinc-600 mx-auto mb-4" />
                    <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-1">Personal Profile Analysis Ready</h3>
                    <p className="text-sm text-slate-500 dark:text-zinc-400 max-w-sm mx-auto">
                      Select your hair, eye, skin tone, and body shape on the left and click &quot;Get Personal Styling Recommendations&quot; to generate your custom guide.
                    </p>
                  </Card>
                )}
              </div>
            </div>
          )}
        </>
      )}

      {/* ============================================================ */}
      {/* TAB 2: ITEM-BASED OUTFIT PICKER */}
      {/* ============================================================ */}
      {activeTab === 'picker' && (
        <div className="max-w-4xl mx-auto space-y-8 animate-fade-in">
          {/* Progress Tracker */}
          <div className="flex items-center justify-center gap-3">
            {[
              { step: 1, label: 'Pick Category & Type' },
              { step: 2, label: 'Pick Colors' },
              { step: 3, label: 'Matching Outfit Output' },
            ].map((s) => (
              <div key={s.step} className="flex items-center gap-2">
                <div
                  className={`flex items-center justify-center w-7 h-7 rounded-full text-xs font-bold transition-all ${
                    pickerStep === s.step
                      ? 'bg-amber-600 text-white ring-4 ring-amber-500/20'
                      : pickerStep > s.step
                      ? 'bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-400'
                      : 'bg-slate-200 dark:bg-zinc-800 text-slate-400'
                  }`}
                >
                  {s.step}
                </div>
                <span
                  className={`text-xs font-bold ${
                    pickerStep === s.step
                      ? 'text-slate-900 dark:text-white'
                      : 'text-slate-500 dark:text-zinc-500'
                  }`}
                >
                  {s.label}
                </span>
                {s.step < 3 && <span className="text-slate-300 dark:text-zinc-700">→</span>}
              </div>
            ))}
          </div>

          {/* STEP 1: Select Category & Sub-Type */}
          {pickerStep === 1 && (
            <Card className="border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-8 space-y-6">
              <h2 className="text-2xl font-extrabold text-slate-900 dark:text-white text-center">
                Step 1: What garment are you starting with?
              </h2>

              {/* Category Selector Buttons Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 max-w-4xl mx-auto">
                {CATEGORIES.map((item) => (
                  <button
                    key={item.slug}
                    type="button"
                    onClick={() => handleCategoryChange(item.slug)}
                    className={`p-4 rounded-2xl border-2 font-bold flex flex-col items-center justify-center gap-2 transition-all cursor-pointer ${
                      pickerCategory === item.slug
                        ? 'border-amber-600 bg-amber-500/10 text-amber-900 dark:text-amber-400 shadow-md'
                        : 'border-slate-200 dark:border-zinc-800 hover:border-slate-300 text-slate-600 dark:text-zinc-400'
                    }`}
                  >
                    <CategoryIcon category={item.slug} size={32} />
                    <span className="text-xs text-center font-extrabold">{item.label}</span>
                  </button>
                ))}
              </div>

              {/* Sub-Type Dropdown */}
              <div className="max-w-md mx-auto space-y-2 pt-2">
                <label className="block text-xs font-bold text-slate-500 dark:text-zinc-400 uppercase tracking-wider">
                  Select {pickerCategory.toUpperCase()} Style / Pattern Type:
                </label>
                <select
                  value={pickerItemType}
                  onChange={(e) => setPickerItemType(e.target.value)}
                  className="flex h-12 w-full rounded-xl border-2 border-slate-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-4 py-2 text-base text-slate-900 dark:text-white font-semibold focus:border-amber-600 focus:outline-none shadow-sm"
                >
                  {CATEGORIES.find((c) => c.slug === pickerCategory)?.itemTypes.map((t) => (
                    <option key={t.id} value={t.id}>{t.label}</option>
                  ))}
                </select>
              </div>

              {/* Optional Occasion & Season Context */}
              <div className="max-w-md mx-auto grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <label className="block text-xs font-bold text-slate-500 dark:text-zinc-400 uppercase tracking-wider">
                    Occasion (optional)
                  </label>
                  <select
                    value={pickerOccasionSlug}
                    onChange={(e) => setPickerOccasionSlug(e.target.value)}
                    className="flex h-10 w-full rounded-lg border border-slate-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-3 py-2 text-sm text-slate-900 dark:text-white font-medium focus:border-amber-500 focus:outline-none"
                  >
                    <option value="">Any occasion</option>
                    {occasionOptions.map((o) => (
                      <option key={o.slug} value={o.slug}>{o.name}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="block text-xs font-bold text-slate-500 dark:text-zinc-400 uppercase tracking-wider">
                    Season (optional)
                  </label>
                  <select
                    value={pickerSeasonSlug}
                    onChange={(e) => setPickerSeasonSlug(e.target.value)}
                    className="flex h-10 w-full rounded-lg border border-slate-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-3 py-2 text-sm text-slate-900 dark:text-white font-medium focus:border-amber-500 focus:outline-none"
                  >
                    <option value="">Any season</option>
                    {seasonOptions.map((s) => (
                      <option key={s.slug} value={s.slug}>{s.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="flex justify-end pt-4">
                <Button size="lg" onClick={() => setPickerStep(2)} className="bg-amber-600 hover:bg-amber-700 text-white font-bold px-8">
                  Next: Pick Colors <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              </div>
            </Card>
          )}

          {/* STEP 2: Multi-Select Color Picker */}
          {pickerStep === 2 && (
            <Card className="border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-8 space-y-6">
              <div className="text-center space-y-2">
                <h2 className="text-2xl font-extrabold text-slate-900 dark:text-white">
                  Step 2: What color(s) does your {pickerCategory} contain?
                </h2>
                <p className="text-xs text-slate-500 dark:text-zinc-400 font-medium">
                  Multi-select all colors present in your garment (e.g. White + Navy Blue for a striped shirt).
                  Full world palette — {Object.values(colorPalette).reduce((n, c) => n + c.length, 0)} colors available.
                </p>
              </div>

              {/* Search */}
              <div className="max-w-md mx-auto">
                <input
                  type="text"
                  value={colorSearch}
                  onChange={(e) => setColorSearch(e.target.value)}
                  placeholder="Search colors (e.g. teal, rust, lavender)..."
                  className="flex h-10 w-full rounded-lg border border-slate-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-3 py-2 text-sm text-slate-900 dark:text-white font-medium focus:border-amber-500 focus:outline-none"
                />
              </div>

              {/* Color Swatches Grouped by Family */}
              <div className="space-y-6 max-w-4xl mx-auto py-2 max-h-[28rem] overflow-y-auto pr-1">
                {Object.entries(filteredColorPalette).map(([family, familyColors]) => {
                  if (familyColors.length === 0) return null;
                  return (
                    <div key={family} className="space-y-2">
                      <span className="text-xs font-extrabold text-amber-700 dark:text-amber-400 uppercase tracking-wider block">
                        {family} ({familyColors.length})
                      </span>
                      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2.5">
                        {familyColors.map((c) => {
                          const isSelected = selectedColorSlugs.includes(c.slug);
                          const rgb = parseInt(c.hex.slice(1), 16);
                          const isLight = ((rgb >> 16 & 255) + (rgb >> 8 & 255) + (rgb & 255)) / 3 > 170;
                          return (
                            <button
                              key={c.slug}
                              type="button"
                              onClick={() => toggleColorSelection(c.slug)}
                              className={`p-2.5 rounded-xl border flex items-center gap-2.5 transition-all cursor-pointer ${
                                isSelected
                                  ? 'border-amber-600 ring-2 ring-amber-500 bg-amber-500/10 dark:bg-amber-500/20'
                                  : 'border-slate-200 dark:border-zinc-800 hover:border-slate-300 bg-white dark:bg-zinc-800/80'
                              }`}
                            >
                              <div
                                className="w-5 h-5 rounded-full border border-slate-300 dark:border-zinc-700 shadow-xs flex items-center justify-center shrink-0"
                                style={{ backgroundColor: c.hex }}
                              >
                                {isSelected && <Check className={`w-3 h-3 ${isLight ? 'text-slate-900' : 'text-white'}`} />}
                              </div>
                              <span className="text-xs font-bold text-slate-900 dark:text-white truncate">{c.name}</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
                {Object.keys(filteredColorPalette).length === 0 && (
                  <p className="text-center text-sm text-slate-500 dark:text-zinc-400 py-8">No colors match &quot;{colorSearch}&quot;.</p>
                )}
              </div>

              <div className="flex justify-between pt-4">
                <Button variant="outline" onClick={() => setPickerStep(1)}>
                  Back
                </Button>
                <Button
                  size="lg"
                  onClick={handleCalculatePicker}
                  disabled={pickerLoading || selectedColorSlugs.length === 0}
                  className="bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-700 hover:to-orange-700 text-white font-bold px-8 shadow-lg"
                >
                  {pickerLoading ? (
                    'Computing Matching Outfit...'
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4 mr-2" />
                      Pick Suitable Matching Outfit
                    </>
                  )}
                </Button>
              </div>
              {pickerError && (
                <p className="text-center text-sm font-semibold text-rose-600 dark:text-rose-400">{pickerError}</p>
              )}
            </Card>
          )}

          {/* STEP 3: Recommendation Results */}
          {pickerStep === 3 && pickerResult && (
            <div className="space-y-8 animate-fade-in">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-2xl font-extrabold text-slate-900 dark:text-white">
                    Wear Without Doubt Outfits
                  </h2>
                  <p className="text-xs text-slate-500 dark:text-zinc-400 font-medium">
                    100% Color Theory & HSL Wheel Certified Combinations
                  </p>
                </div>
                <Button variant="outline" onClick={resetPicker} size="sm">
                  <RotateCcw className="w-3.5 h-3.5 mr-1.5" /> Start Over
                </Button>
              </div>

              {/* Color Psychology & Color Wheel Advice Banner */}
              <Card className="border-amber-200 dark:border-amber-900/50 bg-amber-500/5 dark:bg-amber-500/10 p-5">
                <div className="flex items-start gap-3">
                  <Info className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                  <div>
                    <h4 className="text-sm font-bold text-slate-900 dark:text-white mb-1">
                      Color Wheel & Human Psychology Rationale
                    </h4>
                    <p className="text-xs text-slate-700 dark:text-zinc-300 leading-relaxed font-medium">
                      {pickerResult.recommendation.psychologyAdvice}
                    </p>
                  </div>
                </div>
              </Card>

              {/* CURATED COMPLETE OUTFIT SETS — confidence is a real, honest score */}
              {pickerResult.recommendation.outfitSets?.length > 0 && (
                <div className="space-y-4">
                  <h3 className="text-xl font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
                    <Sparkles className="w-5 h-5 text-amber-500" />
                    Complete Coordinated Looks
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {pickerResult.recommendation.outfitSets.map((set) => (
                      <Card key={set.id} className="border-2 border-amber-500/20 dark:border-amber-500/30 bg-white dark:bg-zinc-900 p-6 flex flex-col justify-between hover:shadow-2xl transition-all relative">
                        <div className="absolute top-4 right-4">
                          <Badge className={`${RATING_STYLES[set.rating].className} font-extrabold text-xs px-2.5 py-1`}>
                            {set.confidenceScore}% — {RATING_STYLES[set.rating].label}
                          </Badge>
                        </div>
                        <div>
                          <h4 className="text-base font-extrabold text-slate-900 dark:text-white mb-4 pr-24">
                            {set.title}
                          </h4>

                          <div className="space-y-3 mb-6">
                            {set.items.map((item, idx) => (
                              <div key={idx} className="flex items-center gap-2.5 p-2.5 rounded-lg bg-slate-50 dark:bg-zinc-800/60">
                                <GarmentIllustration category={item.typeSlug} colors={item.colors} size={28} />
                                <span className="text-xs font-bold text-slate-800 dark:text-zinc-200">{item.name}</span>
                              </div>
                            ))}
                          </div>
                        </div>

                        {set.warnings.length > 0 && (
                          <div className="pt-3 border-t border-slate-100 dark:border-zinc-800 space-y-1">
                            {set.warnings.slice(0, 2).map((w, i) => (
                              <p key={i} className="text-xs text-orange-700 dark:text-orange-400 flex items-start gap-1.5">
                                <ShieldAlert className="w-3.5 h-3.5 shrink-0 mt-0.5" /> {w}
                              </p>
                            ))}
                          </div>
                        )}
                      </Card>
                    ))}
                  </div>
                </div>
              )}

              {/* PER-CATEGORY RANKED CANDIDATES — every score is genuine and can be low */}
              {Object.entries(pickerResult.recommendation.candidatesByType)
                .filter(([, items]) => items.length > 0)
                .map(([typeSlug, items]) => (
                  <div key={typeSlug} className="space-y-4 pt-4">
                    <h3 className="text-xl font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
                      <CategoryIcon category={typeSlug} size={24} />
                      {CATEGORIES.find((c) => c.slug === typeSlug)?.label || typeSlug} ({items.length})
                    </h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                      {items.slice(0, 6).map((item) => (
                        <Card key={item.id} className="border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-5 flex flex-col justify-between hover:shadow-xl transition-all">
                          <div>
                            <div className="flex items-center justify-between mb-3">
                              <Badge className={`${RATING_STYLES[item.rating].className} text-xs font-bold uppercase tracking-wider`}>
                                {item.score}% {RATING_STYLES[item.rating].label}
                              </Badge>
                              <GarmentIllustration category={typeSlug} colors={item.colors} size={32} />
                            </div>
                            <h4 className="text-base font-extrabold text-slate-900 dark:text-white mb-2 leading-snug">
                              {item.name}
                            </h4>
                            <p className="text-xs text-slate-500 dark:text-zinc-400 mb-4 line-clamp-2">
                              {item.description}
                            </p>

                            {item.warnings.length > 0 && (
                              <div className="space-y-1 mb-2">
                                {item.warnings.slice(0, 2).map((w, i) => (
                                  <p key={i} className="text-xs text-orange-700 dark:text-orange-400 flex items-start gap-1.5">
                                    <ShieldAlert className="w-3.5 h-3.5 shrink-0 mt-0.5" /> {w}
                                  </p>
                                ))}
                              </div>
                            )}
                          </div>

                          <div className="pt-3 border-t border-slate-100 dark:border-zinc-800 flex items-center justify-between">
                            <span className="text-xs text-slate-500 dark:text-zinc-400 font-semibold uppercase tracking-wider">Formality</span>
                            <StarRating rating={item.formalityLevel} size="sm" />
                          </div>
                        </Card>
                      ))}
                    </div>
                  </div>
                ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
