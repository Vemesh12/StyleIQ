'use client';

import { useState, useEffect } from 'react';
import { Card, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { OutfitScoreDisplay } from '@/components/outfit-score-display';
import { StarRating } from '@/components/star-rating';
import { AuthModal } from '@/components/auth-modal';
import { GarmentChoiceCards, type GarmentOption } from './garment-choice-cards';
import Link from 'next/link';
import { SLOT_TYPES } from '@/lib/rule-engine/slots';
import { loadStyleProfile } from '@/lib/style-profile';
import { fetchAllGarments } from '@/lib/garments-client';
import {
  Layers,
  Sparkles,
  ArrowRight,
  ArrowLeft,
  RotateCcw,
  Calendar,
  Sun,
  Shirt,
  Scissors,
  Bookmark,
  Check,
} from 'lucide-react';

interface Occasion {
  id: string;
  name: string;
  slug: string;
  formalityLevel: number;
  description: string;
}

interface Season {
  id: string;
  name: string;
  slug: string;
}

interface RawGarment {
  id: string;
  name: string;
  slug: string;
  formalityLevel: number;
  garmentType: string;
  garmentTypeSlug: string;
  colors: { name: string; hex: string }[];
}

interface ScoreBreakdown {
  colorHarmony: number;
  garmentCompatibility: number;
  occasionMatch: number;
  seasonSuitability: number;
  bodyTypeSuitability: number;
  skinToneSuitability: number;
}

interface OutfitScoreResult {
  totalScore: number;
  breakdown: ScoreBreakdown;
  dimensions: Record<string, { score: number; max: number; applied: boolean; note?: string }>;
  rating: string;
  suggestions: string[];
  highlights: string[];
  personalization: { matchedOn: string[]; ignored: string[] };
}

export default function OutfitBuilderPage() {
  const [step, setStep] = useState<number>(1);
  const [occasions, setOccasions] = useState<Occasion[]>([]);
  const [selectedOccasion, setSelectedOccasion] = useState<Occasion | null>(null);
  const [seasons, setSeasons] = useState<Season[]>([]);
  const [selectedSeason, setSelectedSeason] = useState<Season | null>(null);

  const [shirts, setShirts] = useState<GarmentOption[]>([]);
  const [layers, setLayers] = useState<GarmentOption[]>([]);
  const [trousers, setTrousers] = useState<GarmentOption[]>([]);
  const [shoes, setShoes] = useState<GarmentOption[]>([]);
  const [belts, setBelts] = useState<GarmentOption[]>([]);

  const [selectedShirt, setSelectedShirt] = useState<GarmentOption | null>(null);
  const [selectedLayer, setSelectedLayer] = useState<GarmentOption | null>(null);
  const [selectedTrouser, setSelectedTrouser] = useState<GarmentOption | null>(null);
  const [selectedShoe, setSelectedShoe] = useState<GarmentOption | null>(null);
  const [selectedBelt, setSelectedBelt] = useState<GarmentOption | null>(null);
  const [scoreError, setScoreError] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [scoreResult, setScoreResult] = useState<OutfitScoreResult | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [saving, setSaving] = useState<boolean>(false);
  const [saved, setSaved] = useState<boolean>(false);
  const [authModalOpen, setAuthModalOpen] = useState<boolean>(false);

  useEffect(() => {
    fetchAllGarments()
      .then((garments: RawGarment[]) => {

        const formatGarments = (items: RawGarment[]): GarmentOption[] =>
          items.map((g) => ({
            id: g.id,
            name: g.name,
            slug: g.slug,
            formalityLevel: g.formalityLevel,
            garmentType: g.garmentType,
            colors: g.colors,
          }));

        const ofTypes = (types: string[]) => formatGarments(garments.filter((g) => types.includes(g.garmentTypeSlug)));
        setShirts(ofTypes(SLOT_TYPES.top));
        setLayers(ofTypes(SLOT_TYPES.layer));
        setTrousers(ofTypes(SLOT_TYPES.bottom));
        setShoes(ofTypes(SLOT_TYPES.footwear));
        setBelts(ofTypes(['belt']));
      })
      .catch((err) => {
        console.error('Failed to load garments:', err);
        setLoadError('Could not load the clothing catalog. Check your connection and refresh.');
      });

    const getJson = (url: string) =>
      fetch(url).then((res) => {
        if (!res.ok) throw new Error(`${url} failed (${res.status})`);
        return res.json();
      });
    Promise.all([getJson('/api/garments?listOccasions=true'), getJson('/api/garments?listSeasons=true')])
      .then(([occasionRows, seasonRows]: [Occasion[], Season[]]) => {
        setOccasions(occasionRows);
        setSeasons(seasonRows);
      })
      .catch((err) => {
        console.error('Failed to load occasions/seasons:', err);
        setLoadError('Could not load occasions and seasons. Check your connection and refresh.');
      });
  }, []);

  const calculateScore = async () => {
    if (!selectedShirt || !selectedTrouser || !selectedShoe) return;
    setLoading(true);
    setScoreError(null);
    setScoreResult(null);
    setStep(8);

    try {
      const res = await fetch('/api/outfit/score', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          shirtId: selectedShirt.id,
          layerId: selectedLayer?.id,
          trouserId: selectedTrouser.id,
          shoeId: selectedShoe.id,
          beltId: selectedBelt?.id,
          occasionId: selectedOccasion?.id,
          seasonId: selectedSeason?.id,
          // Personalizes skin-tone and body-shape scoring when the person has
          // generated a profile in the Style Advisor.
          profile: loadStyleProfile() ?? undefined,
        }),
      });

      const data = await res.json();
      if (res.ok) setScoreResult(data);
      else setScoreError(data.error || 'Could not score this outfit — please try again.');
    } catch (err) {
      console.error('Scoring error:', err);
      setScoreError('Could not score this outfit — please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveOutfit = async () => {
    if (!selectedShirt || !selectedTrouser || !selectedShoe) return;
    setSaving(true);
    try {
      const garmentIds = [
        selectedShirt.id,
        selectedLayer?.id,
        selectedTrouser.id,
        selectedShoe.id,
        selectedBelt?.id,
      ].filter(Boolean) as string[];

      const res = await fetch('/api/user/outfits', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: selectedOccasion ? `${selectedOccasion.name} Look` : 'Custom Outfit',
          garmentIds,
          // Same context as the score shown, so the server-computed saved
          // score matches what the user saw.
          occasionId: selectedOccasion?.id,
          seasonId: selectedSeason?.id,
          profile: loadStyleProfile() ?? undefined,
        }),
      });

      if (res.status === 401) {
        setAuthModalOpen(true);
        return;
      }

      if (res.ok) {
        setSaved(true);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  const resetAll = () => {
    setStep(1);
    setSelectedOccasion(null);
    setSelectedSeason(null);
    setSelectedShirt(null);
    setSelectedLayer(null);
    setSelectedTrouser(null);
    setSelectedShoe(null);
    setSelectedBelt(null);
    setScoreResult(null);
    setScoreError(null);
    setSaved(false);
  };

  return (
    <div className="w-full px-4 sm:px-8 lg:px-12 py-12 bg-slate-50 dark:bg-zinc-950 min-h-screen transition-colors duration-300 space-y-10">
      {/* Page Header */}
      <div className="text-center max-w-3xl mx-auto space-y-3">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/10 text-amber-700 dark:text-amber-400 text-xs font-bold uppercase tracking-wider border border-amber-200 dark:border-amber-900/50">
          <Layers className="w-3.5 h-3.5" />
          Interactive Rule Engine
        </div>
        <h1 className="text-4xl font-extrabold text-slate-900 dark:text-white tracking-tight">
          Outfit Compatibility Builder
        </h1>
        <p className="text-slate-600 dark:text-zinc-400 max-w-xl mx-auto text-base md:text-lg font-medium">
          Select garments step-by-step to compute instant compatibility score and expert color harmony rules.
        </p>
      </div>

      {loadError && (
        <p role="alert" className="max-w-3xl mx-auto text-sm font-medium text-rose-700 dark:text-rose-300 bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/20 rounded-xl px-4 py-3 text-center">
          {loadError}
        </p>
      )}

      {/* Progress Steps */}
      <div className="flex items-center justify-center gap-2 mb-12 flex-wrap">
        {[
          { num: 1, label: 'Occasion', icon: Calendar },
          { num: 2, label: 'Season', icon: Sun },
          { num: 3, label: 'Shirt', icon: Shirt },
          { num: 4, label: 'Outerwear', icon: Layers },
          { num: 5, label: 'Trouser', icon: Scissors },
          { num: 6, label: 'Shoe', icon: Shirt },
          { num: 7, label: 'Belt', icon: Layers },
          { num: 8, label: 'Score', icon: Sparkles },
        ].map((s) => {
          const isActive = step === s.num;
          const isDone = step > s.num;

          return (
            <div key={s.num} className="flex items-center gap-2">
              <button
                onClick={() => isDone && setStep(s.num)}
                disabled={!isDone && !isActive}
                aria-current={isActive ? 'step' : undefined}
                title={!isDone && !isActive ? 'Finish the earlier steps first' : isDone ? `Go back to ${s.label}` : undefined}
                className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all ${isActive
                  ? 'bg-amber-600 text-white shadow-md'
                  : isDone
                    ? 'bg-amber-100 dark:bg-amber-500/20 text-amber-900 dark:text-amber-400 cursor-pointer'
                    : 'bg-slate-200 dark:bg-zinc-800 text-slate-500 dark:text-zinc-400 opacity-60'
                  }`}
              >
                <s.icon className="w-3.5 h-3.5" />
                {s.label}
              </button>
              {s.num < 8 && <span className="text-slate-400 dark:text-zinc-600 text-xs">→</span>}
            </div>
          );
        })}
      </div>

      {/* STEP 1: Occasion */}
      {step === 1 && (
        <div className="max-w-4xl mx-auto space-y-6 animate-fade-in">
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white text-center">
            What are you dressing for?
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
            {occasions.map((occ) => (
              <Card
                key={occ.id}
                onClick={() => {
                  setSelectedOccasion(occ);
                  setStep(2);
                }}
                className={`cursor-pointer hover:border-amber-500 hover:shadow-xl transition-all p-6 bg-white dark:bg-zinc-900 border-slate-200 dark:border-zinc-800 ${selectedOccasion?.id === occ.id ? 'border-amber-600 dark:border-amber-500 ring-2 ring-amber-500/20' : ''
                  }`}
              >
                <CardTitle className="text-lg text-slate-900 dark:text-white mb-2">{occ.name}</CardTitle>
                <StarRating rating={occ.formalityLevel} size="sm" className="mb-3" />
                <p className="text-xs text-slate-600 dark:text-zinc-400 leading-relaxed font-medium">{occ.description}</p>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* STEP 2: Season */}
      {step === 2 && (
        <div className="max-w-2xl mx-auto space-y-6 animate-fade-in">
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white text-center">
            Which season are you styling for?
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {seasons.map((s) => (
              <Card
                key={s.id}
                onClick={() => {
                  setSelectedSeason(s);
                  setStep(3);
                }}
                className={`cursor-pointer hover:border-amber-500 hover:shadow-xl transition-all p-6 text-center bg-white dark:bg-zinc-900 border-slate-200 dark:border-zinc-800 ${selectedSeason?.id === s.id ? 'border-amber-600 dark:border-amber-500 ring-2 ring-amber-500/20' : ''
                  }`}
              >
                <Sun className="w-8 h-8 text-amber-600 dark:text-amber-400 mx-auto mb-3" />
                <CardTitle className="text-base text-slate-900 dark:text-white">{s.name}</CardTitle>
              </Card>
            ))}
          </div>
          <div className="flex justify-between pt-4">
            <Button variant="outline" onClick={() => setStep(1)}>
              <ArrowLeft className="w-4 h-4" /> Back
            </Button>
          </div>
        </div>
      )}

      {/* STEP 3: Shirt Selection */}
      {step === 3 && (
        <div className="max-w-5xl mx-auto space-y-6 animate-fade-in">
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white text-center">
            Select a Shirt / Top
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
            <GarmentChoiceCards items={shirts} selectedId={selectedShirt?.id} onSelect={(g) => { setSelectedShirt(g); setStep(4); }} category="shirt" accent="amber" />
          </div>
          <div className="flex justify-between pt-4">
            <Button variant="outline" onClick={() => setStep(2)}>
              <ArrowLeft className="w-4 h-4" /> Back
            </Button>
          </div>
        </div>
      )}

      {/* STEP 4: Outerwear / Layer Selection */}
      {step === 4 && (
        <div className="max-w-5xl mx-auto space-y-6 animate-fade-in">
          <div className="text-center space-y-1">
            <h2 className="text-2xl font-bold text-slate-900 dark:text-white">
              Add Outerwear / Layer (Optional)
            </h2>
            <p className="text-sm text-slate-500 dark:text-zinc-400">
              Layer a blazer, cardigan, sweater, or jacket, or skip for a simple top & bottom look.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
            {/* Skip Layer Option */}
            <Card
              onClick={() => {
                setSelectedLayer(null);
                setStep(5);
              }}
              className={`cursor-pointer hover:border-amber-500 hover:shadow-xl transition-all p-5 bg-white dark:bg-zinc-900 border-dashed border-2 border-slate-300 dark:border-zinc-700 flex flex-col justify-between items-center text-center ${selectedLayer === null ? 'border-amber-600 dark:border-amber-500 ring-2 ring-amber-500/20 bg-amber-500/5' : ''
                }`}
            >
              <div className="p-4 rounded-full bg-slate-100 dark:bg-zinc-800 text-slate-500 dark:text-zinc-400 mb-3">
                <Shirt className="w-8 h-8 opacity-40" />
              </div>
              <div>
                <CardTitle className="text-base font-bold text-slate-900 dark:text-white mb-1">
                  No Layer / Skip Outerwear
                </CardTitle>
                <p className="text-xs text-slate-500 dark:text-zinc-400 mb-4">
                  Single shirt & trouser look (ideal for warm weather or relaxed styles)
                </p>
              </div>
              <Button
                variant="outline"
                size="sm"
                className="w-full text-xs font-semibold"
                onClick={(e) => {
                  e.stopPropagation();
                  setSelectedLayer(null);
                  setStep(5);
                }}
              >
                Continue without layer →
              </Button>
            </Card>

            <GarmentChoiceCards items={layers} selectedId={selectedLayer?.id} onSelect={(g) => { setSelectedLayer(g); setStep(5); }} category="jacket" accent="purple" />
          </div>

          <div className="flex justify-between pt-4">
            <Button variant="outline" onClick={() => setStep(3)}>
              <ArrowLeft className="w-4 h-4" /> Back to Shirts
            </Button>
            <Button
              variant="secondary"
              onClick={() => {
                setSelectedLayer(null);
                setStep(5);
              }}
            >
              Skip Layer <ArrowRight className="w-4 h-4 ml-1" />
            </Button>
          </div>
        </div>
      )}

      {/* STEP 5: Trouser Selection */}
      {step === 5 && (
        <div className="max-w-5xl mx-auto space-y-6 animate-fade-in">
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white text-center">
            Select Trousers / Pants
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
            <GarmentChoiceCards items={trousers} selectedId={selectedTrouser?.id} onSelect={(g) => { setSelectedTrouser(g); setStep(6); }} category="trouser" accent="emerald" />
          </div>
          <div className="flex justify-between pt-4">
            <Button variant="outline" onClick={() => setStep(4)}>
              <ArrowLeft className="w-4 h-4" /> Back to Outerwear
            </Button>
          </div>
        </div>
      )}

      {/* STEP 6: Shoe Selection */}
      {step === 6 && (
        <div className="max-w-5xl mx-auto space-y-6 animate-fade-in">
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white text-center">
            Select Shoes / Footwear
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
            <GarmentChoiceCards items={shoes} selectedId={selectedShoe?.id} onSelect={(g) => { setSelectedShoe(g); setStep(7); }} category="shoe" accent="blue" />
          </div>
          <div className="flex justify-between pt-6">
            <Button variant="outline" onClick={() => setStep(5)}>
              <ArrowLeft className="w-4 h-4" /> Back to Trousers
            </Button>
          </div>
        </div>
      )}

      {/* STEP 7: Belt (optional) */}
      {step === 7 && (
        <div className="max-w-5xl mx-auto space-y-6 animate-fade-in">
          <div className="text-center space-y-1">
            <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Add a Belt (Optional)</h2>
            <p className="text-sm text-slate-500 dark:text-zinc-400">
              Match the leather to your shoes — black with black, brown with brown.
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
            <Card
              onClick={() => setSelectedBelt(null)}
              className={`cursor-pointer hover:border-amber-500 hover:shadow-xl transition-all p-5 bg-white dark:bg-zinc-900 border-dashed border-2 border-slate-300 dark:border-zinc-700 flex flex-col items-center justify-center text-center ${selectedBelt === null ? 'border-amber-600 dark:border-amber-500 ring-2 ring-amber-500/20 bg-amber-500/5' : ''
                }`}
            >
              <CardTitle className="text-base font-bold text-slate-900 dark:text-white mb-1">No Belt</CardTitle>
              <p className="text-xs text-slate-500 dark:text-zinc-400">Fine for t-shirts, polos and relaxed looks</p>
            </Card>
            <GarmentChoiceCards items={belts} selectedId={selectedBelt?.id} onSelect={setSelectedBelt} category="belt" accent="amber" />
          </div>
          <div className="flex justify-between pt-6">
            <Button variant="outline" onClick={() => setStep(6)}>
              <ArrowLeft className="w-4 h-4" /> Back to Shoes
            </Button>
            <Button
              onClick={calculateScore}
              disabled={!selectedShirt || !selectedTrouser || !selectedShoe}
              size="lg"
              className="bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-700 hover:to-orange-700 text-white font-bold px-8 shadow-lg"
            >
              Calculate Compatibility Score <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </div>
        </div>
      )}

      {/* STEP 8: Outfit Score Results */}
      {step === 8 && (
        <div className="max-w-4xl mx-auto space-y-6 animate-fade-in">
          {loading ? (
            <Card className="p-12 text-center bg-white dark:bg-zinc-900 border-slate-200 dark:border-zinc-800">
              <div className="w-12 h-12 rounded-full border-4 border-amber-600 border-t-transparent animate-spin mx-auto mb-4" />
              <h3 className="text-lg font-bold text-slate-900 dark:text-white">Calculating Outfit Compatibility...</h3>
              <p className="text-xs text-slate-500 dark:text-zinc-400 mt-1">Evaluating formality, color harmony, season, and occasion rules.</p>
            </Card>
          ) : scoreError ? (
            <Card className="p-8 text-center bg-white dark:bg-zinc-900 border-rose-200 dark:border-rose-900/50">
              <p className="text-sm font-semibold text-rose-600 dark:text-rose-400">{scoreError}</p>
              <Button variant="outline" size="sm" onClick={calculateScore} className="mt-4">
                Try Again
              </Button>
            </Card>
          ) : scoreResult ? (
            <div className="space-y-6">
              <OutfitScoreDisplay
                totalScore={scoreResult.totalScore}
                breakdown={scoreResult.breakdown}
                dimensions={scoreResult.dimensions}
                rating={scoreResult.rating}
                suggestions={scoreResult.suggestions}
                highlights={scoreResult.highlights}
              />
              <p className="text-center text-xs text-slate-500 dark:text-zinc-400">
                {scoreResult.personalization?.matchedOn.length ? (
                  'Personalized with your saved Style Profile.'
                ) : (
                  <>
                    Want this scored for your skin tone and body shape?{' '}
                    <Link href="/style-advisor" className="font-semibold text-amber-700 dark:text-amber-400 underline">
                      Create your Style Profile
                    </Link>
                    .
                  </>
                )}
              </p>

              <div className="flex justify-center gap-4 pt-4">
                <Button variant="outline" onClick={resetAll} size="lg">
                  <RotateCcw className="w-4 h-4" /> Build Another Outfit
                </Button>
                <Button
                  onClick={handleSaveOutfit}
                  disabled={saving || saved}
                  size="lg"
                  className={saved ? 'bg-emerald-600 hover:bg-emerald-700 text-white font-bold' : 'bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-700 hover:to-orange-700 text-white font-bold'}
                >
                  {saved ? (
                    <>
                      <Check className="w-4 h-4 mr-2" /> Outfit Saved to Closet
                    </>
                  ) : saving ? (
                    'Saving...'
                  ) : (
                    <>
                      <Bookmark className="w-4 h-4 mr-2" /> Save Outfit to My Closet
                    </>
                  )}
                </Button>
              </div>
            </div>
          ) : null}
        </div>
      )}

      {/* Auth Modal for Guests trying to save */}
      <AuthModal
        isOpen={authModalOpen}
        onClose={() => setAuthModalOpen(false)}
        onSuccess={() => {
          setAuthModalOpen(false);
          handleSaveOutfit();
        }}
      />
    </div>
  );
}
