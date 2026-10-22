'use client';

import { useEffect, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { CategoryIcon } from '@/components/category-icon';
import { GarmentIllustration } from '@/components/garment-illustration';
import { StarRating } from '@/components/star-rating';
import {
  Sparkles,
  CheckCircle2,
  ShieldAlert,
  ArrowRight,
  RotateCcw,
  Check,
  Info,
} from 'lucide-react';
import { loadStyleProfile } from '@/lib/style-profile';
import { CATEGORIES, RATING_STYLES, type DbColor, type PickerResult } from './advisor-data';

/** Tab 2: "I own this item — what goes with it?" */
export function PickerTab() {
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
    let active = true;
    const getJson = (url: string) =>
      fetch(url).then((res) => {
        if (!res.ok) throw new Error(`${url} failed (${res.status})`);
        return res.json();
      });
    Promise.all([getJson('/api/colors'), getJson('/api/garments?listOccasions=true'), getJson('/api/garments?listSeasons=true')])
      .then(([colors, occasions, seasons]) => {
        if (!active) return;
        setColorPalette(colors.groupedByFamily || {});
        setOccasionOptions(Array.isArray(occasions) ? occasions : []);
        setSeasonOptions(Array.isArray(seasons) ? seasons : []);
      })
      .catch((e) => {
        console.error(e);
        if (active) setPickerError('Could not load colors and occasions. Refresh to try again.');
      });
    return () => {
      active = false;
    };
  }, []);

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
          // Only personalize with a profile the person actually generated —
          // never the form's pre-filled defaults.
          profile: loadStyleProfile() ?? undefined,
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

          <p className="text-xs font-medium text-slate-600 dark:text-zinc-400">
            {pickerResult.personalization && pickerResult.personalization.matchedOn.length > 0
              ? 'Personalized with your saved Style Profile.'
              : 'Not personalized — generate your profile in the "Physical Profile Advisor" tab to factor in your skin undertone and body shape.'}
          </p>

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

                    {set.highlights && set.highlights.length > 0 && (
                      <p className="text-xs text-emerald-700 dark:text-emerald-400 flex items-start gap-1.5 mb-2">
                        <CheckCircle2 className="w-3.5 h-3.5 shrink-0 mt-0.5" /> {set.highlights[0]}
                      </p>
                    )}
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
  );
}
