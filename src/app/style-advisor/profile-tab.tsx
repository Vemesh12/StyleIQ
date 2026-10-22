'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Sparkles,
  UserCheck,
  Palette,
  Shirt,
  CheckCircle2,
  ShieldAlert,
  } from 'lucide-react';
import { persistStyleProfile } from '@/lib/style-profile';
import type { Options, PersonalizationResult } from './advisor-data';

const EMPTY_PROFILE = { hairColor: '', eyeColor: '', skinTone: '', underTone: '', torsoLength: '', bodyProportion: '' };

/** Tab 1: build a style profile from physical traits and show the advice. */
export function ProfileTab() {
  const [options, setOptions] = useState<Options | null>(null);
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState(EMPTY_PROFILE);
  const [result, setResult] = useState<PersonalizationResult | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    fetch('/api/personalization/options')
      .then((res) => {
        if (!res.ok) throw new Error(`Failed to load options (${res.status})`);
        return res.json();
      })
      .then((data: Options) => {
        if (!active) return;
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
      })
      .catch((e) => {
        console.error(e);
        if (active) setError('Could not load the profile options. Refresh to try again.');
      })
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, []);

  const handleGenerateProfile = async () => {
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch('/api/personalization/recommend', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(profile),
      });
      const data = await res.json();
      if (res.ok) {
        setResult(data);
        // Remember the profile the person actually chose, so the picker,
        // outfit builder, quick pick and daily suggestion personalize too.
        // Also stored on the account when signed in, so it follows them across devices.
        await persistStyleProfile(profile);
      } else {
        setError(data.error || 'Could not generate your profile.');
      }
    } catch (e) {
      console.error(e);
      setError('Could not generate your profile. Check your connection and try again.');
    }
    setSubmitting(false);
  };

  return (
    <>
      {error && (
        <p role="alert" className="max-w-3xl mx-auto mb-6 text-sm font-medium text-rose-700 dark:text-rose-300 bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/20 rounded-xl px-4 py-3">
          {error}
        </p>
      )}
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
                {result.ignored && result.ignored.length > 0 && (
                  <p className="text-xs font-medium text-amber-800 dark:text-amber-300 bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20 rounded-lg px-3 py-2">
                    Closest match shown — no exact entry for your{' '}
                    {result.ignored.map((f) => f.replace(/([A-Z])/g, ' $1').toLowerCase()).join(', ')}, so those weren&apos;t used.
                  </p>
                )}
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
  );
}
