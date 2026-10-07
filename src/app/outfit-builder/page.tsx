'use client';

import { useState, useEffect } from 'react';
import { Card, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { OutfitScoreDisplay } from '@/components/outfit-score-display';
import { StarRating } from '@/components/star-rating';
import { GarmentIllustration } from '@/components/garment-illustration';
import { AuthModal } from '@/components/auth-modal';
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

interface GarmentOption {
  id: string;
  name: string;
  slug: string;
  formalityLevel: number;
  garmentType: string;
  colors: { name: string; hex: string }[];
  compatibilityType?: string;
  rating?: number;
  reason?: string;
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
  rating: string;
  suggestions: string[];
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

  const [selectedShirt, setSelectedShirt] = useState<GarmentOption | null>(null);
  const [selectedLayer, setSelectedLayer] = useState<GarmentOption | null>(null);
  const [selectedTrouser, setSelectedTrouser] = useState<GarmentOption | null>(null);
  const [selectedShoe, setSelectedShoe] = useState<GarmentOption | null>(null);

  const [scoreResult, setScoreResult] = useState<OutfitScoreResult | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [saving, setSaving] = useState<boolean>(false);
  const [saved, setSaved] = useState<boolean>(false);
  const [authModalOpen, setAuthModalOpen] = useState<boolean>(false);

  useEffect(() => {
    fetch('/api/garments?limit=200')
      .then((res) => res.json())
      .then((data) => {
        const garments: RawGarment[] = data.garments || [];

        const formatGarments = (items: RawGarment[]): GarmentOption[] =>
          items.map((g) => ({
            id: g.id,
            name: g.name,
            slug: g.slug,
            formalityLevel: g.formalityLevel,
            garmentType: g.garmentType,
            colors: g.colors,
          }));

        const topTypes = ['shirt', 'tshirt', 'polo'];
        const layerTypes = ['jacket', 'sweater', 'cardigan', 'hoodie', 'knitwear'];
        setShirts(formatGarments(garments.filter((g) => topTypes.includes(g.garmentTypeSlug))));
        setLayers(formatGarments(garments.filter((g) => layerTypes.includes(g.garmentTypeSlug))));
        setTrousers(formatGarments(garments.filter((g) => g.garmentTypeSlug === 'trouser')));
        setShoes(formatGarments(garments.filter((g) => g.garmentTypeSlug === 'shoe')));
      });

    fetch('/api/garments?listOccasions=true')
      .then((res) => res.json())
      .then((data: Occasion[]) => setOccasions(data));

    fetch('/api/garments?listSeasons=true')
      .then((res) => res.json())
      .then((data: Season[]) => setSeasons(data));
  }, []);

  const calculateScore = async () => {
    if (!selectedShirt || !selectedTrouser || !selectedShoe) return;
    setLoading(true);
    setStep(7);

    try {
      const res = await fetch('/api/outfit/score', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          shirtId: selectedShirt.id,
          layerId: selectedLayer?.id,
          trouserId: selectedTrouser.id,
          shoeId: selectedShoe.id,
          occasionId: selectedOccasion?.id,
          seasonId: selectedSeason?.id,
        }),
      });

      const data = await res.json();
      setScoreResult(data);
    } catch (err) {
      console.error('Scoring error:', err);
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
      ].filter(Boolean) as string[];

      const res = await fetch('/api/user/outfits', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: selectedOccasion ? `${selectedOccasion.name} Look` : 'Custom Outfit',
          outfitScore: scoreResult?.totalScore ?? 85,
          garmentIds,
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
    setScoreResult(null);
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

      {/* Progress Steps */}
      <div className="flex items-center justify-center gap-2 mb-12 flex-wrap">
        {[
          { num: 1, label: 'Occasion', icon: Calendar },
          { num: 2, label: 'Season', icon: Sun },
          { num: 3, label: 'Shirt', icon: Shirt },
          { num: 4, label: 'Outerwear', icon: Layers },
          { num: 5, label: 'Trouser', icon: Scissors },
          { num: 6, label: 'Shoe', icon: Shirt },
          { num: 7, label: 'Score', icon: Sparkles },
        ].map((s) => {
          const isActive = step === s.num;
          const isDone = step > s.num;

          return (
            <div key={s.num} className="flex items-center gap-2">
              <button
                onClick={() => isDone && setStep(s.num)}
                disabled={!isDone && !isActive}
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
              {s.num < 7 && <span className="text-slate-400 dark:text-zinc-600 text-xs">→</span>}
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
            {shirts.map((shirt) => (
              <Card
                key={shirt.id}
                onClick={() => {
                  setSelectedShirt(shirt);
                  setStep(4);
                }}
                className={`cursor-pointer hover:border-amber-500 hover:shadow-xl transition-all p-5 bg-white dark:bg-zinc-900 border-slate-200 dark:border-zinc-800 flex flex-col justify-between ${selectedShirt?.id === shirt.id ? 'border-amber-600 dark:border-amber-500 ring-2 ring-amber-500/20 bg-amber-500/5' : ''
                  }`}
              >
                {/* Colored garment illustration in this item's actual color(s) */}
                <div className="flex items-center justify-center mb-4">
                  <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-200 dark:border-amber-900/40">
                    <GarmentIllustration category="shirt" colors={shirt.colors} size={48} />
                  </div>
                </div>

                <CardTitle className="text-base font-extrabold text-slate-900 dark:text-white mb-3 line-clamp-2">{shirt.name}</CardTitle>

                {/* BOTTOM: Formality Star Rating */}
                <div className="pt-2 border-t border-slate-100 dark:border-zinc-800 flex items-center justify-between">
                  <span className="text-xs text-slate-500 dark:text-zinc-400 font-semibold uppercase tracking-wider">Formality</span>
                  <StarRating rating={shirt.formalityLevel} size="sm" />
                </div>
              </Card>
            ))}
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

            {layers.map((layer) => (
              <Card
                key={layer.id}
                onClick={() => {
                  setSelectedLayer(layer);
                  setStep(5);
                }}
                className={`cursor-pointer hover:border-amber-500 hover:shadow-xl transition-all p-5 bg-white dark:bg-zinc-900 border-slate-200 dark:border-zinc-800 flex flex-col justify-between ${selectedLayer?.id === layer.id ? 'border-amber-600 dark:border-amber-500 ring-2 ring-amber-500/20 bg-amber-500/5' : ''
                  }`}
              >
                <div className="flex items-center justify-center mb-4">
                  <div className="p-3 rounded-xl bg-purple-500/10 border border-purple-200 dark:border-purple-900/40">
                    <GarmentIllustration category="jacket" colors={layer.colors} size={48} />
                  </div>
                </div>

                <CardTitle className="text-base font-extrabold text-slate-900 dark:text-white mb-3 line-clamp-2">
                  {layer.name}
                </CardTitle>

                <div className="pt-2 border-t border-slate-100 dark:border-zinc-800 flex items-center justify-between">
                  <span className="text-xs text-slate-500 dark:text-zinc-400 font-semibold uppercase tracking-wider">Formality</span>
                  <StarRating rating={layer.formalityLevel} size="sm" />
                </div>
              </Card>
            ))}
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
            {trousers.map((trouser) => (
              <Card
                key={trouser.id}
                onClick={() => {
                  setSelectedTrouser(trouser);
                  setStep(6);
                }}
                className={`cursor-pointer hover:border-amber-500 hover:shadow-xl transition-all p-5 bg-white dark:bg-zinc-900 border-slate-200 dark:border-zinc-800 flex flex-col justify-between ${selectedTrouser?.id === trouser.id ? 'border-amber-600 dark:border-amber-500 ring-2 ring-amber-500/20 bg-amber-500/5' : ''
                  }`}
              >
                {/* Colored garment illustration in this item's actual color(s) */}
                <div className="flex items-center justify-center mb-4">
                  <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-200 dark:border-emerald-900/40">
                    <GarmentIllustration category="trouser" colors={trouser.colors} size={48} />
                  </div>
                </div>

                <CardTitle className="text-base font-extrabold text-slate-900 dark:text-white mb-3 line-clamp-2">{trouser.name}</CardTitle>

                {/* BOTTOM: Formality Star Rating */}
                <div className="pt-2 border-t border-slate-100 dark:border-zinc-800 flex items-center justify-between">
                  <span className="text-xs text-slate-500 dark:text-zinc-400 font-semibold uppercase tracking-wider">Formality</span>
                  <StarRating rating={trouser.formalityLevel} size="sm" />
                </div>
              </Card>
            ))}
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
            {shoes.map((shoe) => (
              <Card
                key={shoe.id}
                onClick={() => {
                  setSelectedShoe(shoe);
                }}
                className={`cursor-pointer hover:border-amber-500 hover:shadow-xl transition-all p-5 bg-white dark:bg-zinc-900 border-slate-200 dark:border-zinc-800 flex flex-col justify-between ${selectedShoe?.id === shoe.id ? 'border-amber-600 dark:border-amber-500 ring-2 ring-amber-500/20 bg-amber-500/5' : ''
                  }`}
              >
                {/* Colored garment illustration in this item's actual color(s) */}
                <div className="flex items-center justify-center mb-4">
                  <div className="p-3 rounded-xl bg-blue-500/10 border border-blue-200 dark:border-blue-900/40">
                    <GarmentIllustration category="shoe" colors={shoe.colors} size={48} />
                  </div>
                </div>

                <CardTitle className="text-base font-extrabold text-slate-900 dark:text-white mb-3 line-clamp-2">{shoe.name}</CardTitle>

                {/* BOTTOM: Formality Star Rating */}
                <div className="pt-2 border-t border-slate-100 dark:border-zinc-800 flex items-center justify-between">
                  <span className="text-xs text-slate-500 dark:text-zinc-400 font-semibold uppercase tracking-wider">Formality</span>
                  <StarRating rating={shoe.formalityLevel} size="sm" />
                </div>
              </Card>
            ))}
          </div>
          <div className="flex justify-between pt-6">
            <Button variant="outline" onClick={() => setStep(5)}>
              <ArrowLeft className="w-4 h-4" /> Back to Trousers
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

      {/* STEP 7: Outfit Score Results */}
      {step === 7 && (
        <div className="max-w-4xl mx-auto space-y-6 animate-fade-in">
          {loading ? (
            <Card className="p-12 text-center bg-white dark:bg-zinc-900 border-slate-200 dark:border-zinc-800">
              <div className="w-12 h-12 rounded-full border-4 border-amber-600 border-t-transparent animate-spin mx-auto mb-4" />
              <h3 className="text-lg font-bold text-slate-900 dark:text-white">Calculating Outfit Compatibility...</h3>
              <p className="text-xs text-slate-500 dark:text-zinc-400 mt-1">Evaluating formality, color harmony, season, and occasion rules.</p>
            </Card>
          ) : scoreResult ? (
            <div className="space-y-6">
              <OutfitScoreDisplay
                totalScore={typeof scoreResult?.totalScore === 'number' ? scoreResult.totalScore : 85}
                breakdown={
                  scoreResult?.breakdown || {
                    colorHarmony: 25,
                    garmentCompatibility: 20,
                    occasionMatch: 12,
                    seasonSuitability: 8,
                    bodyTypeSuitability: 8,
                    skinToneSuitability: 8,
                  }
                }
                rating={scoreResult?.rating || 'Excellent Choice'}
                suggestions={scoreResult?.suggestions || []}
              />

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
