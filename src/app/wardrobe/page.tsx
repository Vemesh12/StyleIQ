'use client';

import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { GarmentCard } from '@/components/garment-card';
import { GarmentIllustration } from '@/components/garment-illustration';
import { AuthModal } from '@/components/auth-modal';
import { loadStyleProfile } from '@/lib/style-profile';
import { readGuestWardrobe, readGuestWearLog, writeGuestWardrobe } from '@/lib/guest-wardrobe';
import { OutfitActions } from '@/components/outfit-actions';
import { OutfitPieces, piecesOf } from '@/components/outfit-pieces';
import { CompleteOutfit } from './complete-outfit';
import { ClosetGaps } from './closet-gaps';
import { CustomGarmentForm } from './custom-garment-form';
import { WearHistory } from './wear-history';
import {
  loadWardrobeData,
  type AllGarment,
  type DailySuggestion,
  type SavedOutfitRow,
  type WardrobeData,
  type WardrobeItem,
} from './wardrobe-data';
import Link from 'next/link';
import {
  FolderHeart,
  Plus,
  Trash2,
  Shirt,
  ShoppingBag,
  Check,
  User,
  Info,
  Sun,
  CloudRain,
  Sparkles,
  Bookmark,
  CalendarDays,
} from 'lucide-react';


export default function DigitalWardrobePage() {
  const [wardrobe, setWardrobe] = useState<WardrobeItem[]>([]);
  const [allGarments, setAllGarments] = useState<AllGarment[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(true);
  const [addingId, setAddingId] = useState<string | null>(null);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [dailySuggestion, setDailySuggestion] = useState<DailySuggestion | null>(null);
  const [dailyLoading, setDailyLoading] = useState(false);
  const [dailyError, setDailyError] = useState<string | null>(null);
  const [savedOutfits, setSavedOutfits] = useState<SavedOutfitRow[]>([]);
  const [activeTab, setActiveTab] = useState<'inventory' | 'savedOutfits' | 'history'>('inventory');

  const handleDeleteOutfit = async (id: string) => {
    if (!confirm('Are you sure you want to delete this saved outfit?')) return;
    try {
      await fetch(`/api/user/outfits?id=${id}`, { method: 'DELETE' });
      setSavedOutfits((prev) => prev.filter((o) => o.id !== id));
    } catch (err) {
      console.error(err);
    }
  };

  const [loadError, setLoadError] = useState<string | null>(null);

  const applyData = useCallback((data: WardrobeData) => {
    setIsLoggedIn(data.isLoggedIn);
    setWardrobe(data.wardrobe);
    setAllGarments(data.allGarments);
    setSavedOutfits(data.savedOutfits);
    setLoadError(null);
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      applyData(await loadWardrobeData());
    } catch (error) {
      console.error('Error fetching wardrobe data:', error);
      setLoadError('Could not load your closet. Check your connection and refresh.');
    }
    setLoading(false);
  };

  useEffect(() => {
    let active = true;
    loadWardrobeData()
      .then((data) => active && applyData(data))
      .catch((error) => {
        console.error('Error fetching wardrobe data:', error);
        if (active) setLoadError('Could not load your closet. Check your connection and refresh.');
      })
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [applyData]);

  const handleAddGarment = async (garmentId: string) => {
    setAddingId(garmentId);
    if (isLoggedIn) {
      try {
        const res = await fetch('/api/user/wardrobe', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ garmentId }),
        });
        if (res.ok) await fetchData();
      } catch (e) {
        console.error(e);
      }
    } else {
      writeGuestWardrobe([...readGuestWardrobe(), garmentId]);
      await fetchData();
    }
    setAddingId(null);
  };

  const [dailyVariant, setDailyVariant] = useState(0);

  // variant 0 = today's pick; "Try Another" asks for the next distinct option.
  const getTodaysOutfit = (variant = 0) => {
    setDailyVariant(variant);
    setDailyLoading(true);
    setDailyError(null);
    setDailySuggestion(null);

    const garmentIds = wardrobe.map((w) => w.garmentId);

    const requestSuggestion = (lat?: number, lon?: number) => {
      fetch('/api/wardrobe/daily-suggestion', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          garmentIds,
          lat,
          lon,
          // Local calendar date, so the suggestion rotates at the user's midnight.
          localDate: new Date().toLocaleDateString('en-CA'),
          variant,
          profile: loadStyleProfile() ?? undefined,
          recentlyWorn: isLoggedIn ? undefined : readGuestWearLog(),
        }),
      })
        .then((res) => res.json())
        .then((data) => {
          if (data.error) setDailyError(data.error);
          else setDailySuggestion(data);
        })
        .catch(() => setDailyError('Could not get a suggestion right now — try again in a moment.'))
        .finally(() => setDailyLoading(false));
    };

    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => requestSuggestion(pos.coords.latitude, pos.coords.longitude),
        () => requestSuggestion(), // permission denied — still suggest, just without weather
        { timeout: 5000 }
      );
    } else {
      requestSuggestion();
    }
  };

  const handleRemoveGarment = async (garmentId: string, isOwn = false) => {
    if (isOwn && !confirm('Delete this item? It was added by you, so it will be removed from your closet and saved outfits.')) return;
    if (isLoggedIn) {
      try {
        const res = await fetch(isOwn ? `/api/user/garments?id=${garmentId}` : `/api/user/wardrobe?garmentId=${garmentId}`, {
          method: 'DELETE',
        });
        if (res.ok) await fetchData();
      } catch (e) {
        console.error(e);
      }
    } else {
      writeGuestWardrobe(readGuestWardrobe().filter((id) => id !== garmentId));
      await fetchData();
    }
  };

  // Derived from whatever's actually in the catalog/wardrobe, so new garment
  // types (T-Shirt, Polo, Sweater, Tie, ...) show up automatically instead of
  // being invisible because they weren't in a hardcoded list.
  const categories = Array.from(
    new Set([...allGarments, ...wardrobe.map((w) => w.garment)].map((g) => g.garmentType))
  ).sort();

  return (
    <div className="w-full px-4 sm:px-8 lg:px-12 py-12 bg-slate-50 dark:bg-zinc-950 min-h-screen transition-colors duration-300">
      {loadError && (
        <p className="mb-6 text-sm font-medium text-rose-700 dark:text-rose-300 bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/20 rounded-xl px-4 py-3">
          {loadError}
        </p>
      )}

      {/* Guest Mode Info Banner */}
      {!isLoggedIn && (
        <div className="mb-6 p-4 rounded-xl bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20 flex flex-col sm:flex-row items-center justify-between gap-3 shadow-2xs">
          <div className="flex items-center gap-3 text-sm text-amber-900 dark:text-amber-300">
            <Info className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0" />
            <span>
              <strong className="text-amber-800 dark:text-amber-400 font-bold">Guest Mode:</strong> Items added here are saved on this browser. Sign in or register to save your digital closet across all devices!
            </span>
          </div>
          <Button size="sm" onClick={() => setAuthModalOpen(true)} className="shrink-0">
            <User className="w-3.5 h-3.5" /> Sign In / Register
          </Button>
        </div>
      )}

      {/* Today's Outfit — the "I don't know what to wear" answer button */}
      {!loading && wardrobe.length > 0 && (
        <Card className="mb-8 border-amber-300 dark:border-amber-700/50 bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-500/10 dark:to-orange-500/10 shadow-sm">
          <CardContent className="p-6">
            {!dailySuggestion && !dailyLoading && (
              <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                <div>
                  <h2 className="text-xl font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
                    <Sparkles className="w-5 h-5 text-amber-600" /> Not sure what to wear today?
                  </h2>
                  <p className="text-sm text-slate-600 dark:text-zinc-400 mt-1">
                    We&apos;ll pick an outfit from clothes you already own, matched to today&apos;s weather.
                  </p>
                </div>
                <Button onClick={() => getTodaysOutfit(0)} size="lg" className="shrink-0">
                  <Sparkles className="w-4 h-4" /> Show Me What to Wear
                </Button>
              </div>
            )}

            {dailyLoading && (
              <div className="flex items-center gap-3 text-slate-600 dark:text-zinc-400 py-2">
                <div className="animate-spin w-5 h-5 border-2 border-amber-600 border-t-transparent rounded-full" />
                Checking today&apos;s weather and your closet...
              </div>
            )}

            {dailyError && <p className="text-sm font-semibold text-rose-600 dark:text-rose-400">{dailyError}</p>}

            {dailySuggestion && (
              <div className="space-y-4">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div className="flex items-center gap-2 text-sm font-semibold text-slate-700 dark:text-zinc-300">
                    {dailySuggestion.weather ? (
                      <>
                        {dailySuggestion.weather.isRainy ? <CloudRain className="w-4 h-4 text-blue-500" /> : <Sun className="w-4 h-4 text-amber-500" />}
                        Today: {Math.round(dailySuggestion.weather.tempC)}°C, {dailySuggestion.weather.description}
                      </>
                    ) : (
                      <span className="text-slate-500 dark:text-zinc-400">Weather unavailable — picked from your closet anyway.</span>
                    )}
                  </div>
                  <Button variant="outline" size="sm" onClick={() => getTodaysOutfit(dailyVariant + 1)}>
                    Try Another
                  </Button>
                </div>

                {dailySuggestion.outfit ? (
                  <div className="space-y-3">
                    <OutfitPieces pieces={piecesOf(dailySuggestion.outfit)} />
                    <OutfitActions
                      key={piecesOf(dailySuggestion.outfit).map((p) => p.id).join('|')}
                      garmentIds={piecesOf(dailySuggestion.outfit).map((p) => p.id)}
                      score={dailySuggestion.outfit.score}
                      onRequireLogin={() => setAuthModalOpen(true)}
                    />
                  </div>
                ) : (
                  <p className="text-sm text-slate-600 dark:text-zinc-400">{dailySuggestion.message}</p>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {!loading && wardrobe.length > 0 && (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 mb-10">
          <CompleteOutfit wardrobe={wardrobe} isLoggedIn={isLoggedIn} onRequireLogin={() => setAuthModalOpen(true)} />
          <ClosetGaps garmentIds={wardrobe.map((w) => w.garmentId)} />
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
        <div>
          <div className="flex items-center gap-2 text-amber-700 dark:text-amber-400 text-sm font-semibold mb-2">
            <FolderHeart className="w-4 h-4" />
            Digital Closet
          </div>
          <h1 className="text-4xl font-extrabold text-slate-900 dark:text-white mb-2">My Digital Wardrobe</h1>
          <p className="text-slate-600 dark:text-zinc-400 max-w-xl text-base font-medium">
            Add clothes you own to build a digital inventory of your closet and get personalized outfit suggestions.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Button onClick={() => setShowAddModal(!showAddModal)}>
            <Plus className="w-4 h-4" />
            {showAddModal ? 'Hide Add Window' : 'Add Clothes to Closet'}
          </Button>
        </div>
      </div>

      <div className="mb-8">
        {isLoggedIn ? (
          <CustomGarmentForm onCreated={fetchData} />
        ) : (
          <p className="text-sm text-slate-500 dark:text-zinc-400">
            Own something that isn&apos;t in the catalog?{' '}
            <button onClick={() => setAuthModalOpen(true)} className="font-semibold text-amber-700 dark:text-amber-400 underline">
              Sign in
            </button>{' '}
            to add your own items.
          </p>
        )}
      </div>

      {/* Add Clothes Selection Window */}
      {showAddModal && (
        <Card className="mb-12 border-amber-200 dark:border-amber-900/50 bg-amber-50/40 dark:bg-zinc-900/90 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <div>
              <CardTitle className="text-xl text-amber-900 dark:text-amber-400">👕 Add Clothes You Own to Your Closet</CardTitle>
              <p className="text-sm text-slate-600 dark:text-zinc-400 font-medium">
                Click <span className="text-slate-900 dark:text-white font-semibold">&quot;+ Add&quot;</span> next to any garment below to save it into your wardrobe inventory.
              </p>
            </div>
            <Button variant="ghost" size="sm" onClick={() => setShowAddModal(false)}>
              Close Window
            </Button>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="py-8 text-center text-slate-500 dark:text-zinc-400">Loading catalog items...</div>
            ) : allGarments.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 max-h-96 overflow-y-auto pr-2">
                {allGarments.map((g) => {
                  const isOwned = wardrobe.some((w) => w.garmentId === g.id);
                  return (
                    <div
                      key={g.id}
                      className="p-3 rounded-lg bg-white dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 flex items-center justify-between gap-2 hover:border-amber-400 transition-colors shadow-2xs"
                    >
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-slate-900 dark:text-white truncate">{g.name}</p>
                        <p className="text-xs text-slate-500 dark:text-zinc-400">{g.garmentType}</p>
                      </div>
                      {isOwned ? (
                        <Badge variant="excellent" className="shrink-0 text-xs gap-1">
                          <Check className="w-3 h-3" /> In Closet
                        </Badge>
                      ) : (
                        <Button
                          size="sm"
                          onClick={() => handleAddGarment(g.id)}
                          disabled={addingId === g.id}
                          className="shrink-0 h-8 px-2.5 text-xs cursor-pointer"
                        >
                          <Plus className="w-3.5 h-3.5" /> Add
                        </Button>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-slate-500 dark:text-zinc-400 text-sm">No catalog items found.</p>
            )}
          </CardContent>
        </Card>
      )}

      {/* Closet Inventory Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-4 mb-12">
        {categories.map((cat) => {
          const count = wardrobe.filter((w) => w.garment.garmentType === cat).length;
          return (
            <div key={cat} className="p-4 rounded-xl bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 text-center shadow-2xs">
              <span className="text-3xl font-extrabold text-amber-600 dark:text-amber-400">{count}</span>
              <span className="text-xs text-slate-500 dark:text-zinc-400 block uppercase tracking-wider font-semibold mt-1">{cat}s</span>
            </div>
          );
        })}
      </div>

      {/* Tab Switcher: My Clothes vs Saved Outfits */}
      <div className="flex items-center gap-3 mb-8 border-b border-slate-200 dark:border-zinc-800 pb-4">
        <button
          onClick={() => setActiveTab('inventory')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition-all cursor-pointer ${
            activeTab === 'inventory'
              ? 'bg-amber-600 text-white shadow-md'
              : 'text-slate-600 dark:text-zinc-400 hover:bg-slate-100 dark:hover:bg-zinc-800'
          }`}
        >
          <Shirt className="w-4 h-4" /> My Clothes ({wardrobe.length})
        </button>
        <button
          onClick={() => setActiveTab('savedOutfits')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition-all cursor-pointer ${
            activeTab === 'savedOutfits'
              ? 'bg-amber-600 text-white shadow-md'
              : 'text-slate-600 dark:text-zinc-400 hover:bg-slate-100 dark:hover:bg-zinc-800'
          }`}
        >
          <Bookmark className="w-4 h-4" /> Saved Looks ({savedOutfits.length})
        </button>
        <button
          onClick={() => setActiveTab('history')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition-all cursor-pointer ${
            activeTab === 'history'
              ? 'bg-amber-600 text-white shadow-md'
              : 'text-slate-600 dark:text-zinc-400 hover:bg-slate-100 dark:hover:bg-zinc-800'
          }`}
        >
          <CalendarDays className="w-4 h-4" /> History
        </button>
      </div>

      {/* VIEW: Wear history (outfit calendar) */}
      {activeTab === 'history' && <WearHistory isLoggedIn={isLoggedIn} allGarments={allGarments} />}

      {/* VIEW: Saved Outfits */}
      {activeTab === 'savedOutfits' && (
        <div>
          {savedOutfits.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {savedOutfits.map((outfit) => (
                <Card key={outfit.id} className="p-5 bg-white dark:bg-zinc-900 border-slate-200 dark:border-zinc-800 space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-bold text-slate-900 dark:text-white text-base">{outfit.name}</h3>
                      <span className="text-[11px] text-slate-400 dark:text-zinc-500">
                        Saved on {new Date(outfit.createdAt).toLocaleDateString()}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant={outfit.outfitScore >= 85 ? 'excellent' : outfit.outfitScore >= 70 ? 'good' : 'acceptable'}>
                        {outfit.outfitScore}% Score
                      </Badge>
                      <button
                        onClick={() => handleDeleteOutfit(outfit.id)}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/20 transition-colors"
                        title="Delete Outfit"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 border-t border-slate-100 dark:border-zinc-800">
                    {outfit.items.map((item) => {
                      const body = (
                        <>
                          <GarmentIllustration
                            category={item.garment.garmentType.slug}
                            colors={item.garment.colors.map((c) => ({ name: c.color.name, hex: c.color.hex }))}
                            size={36}
                          />
                          <div className="min-w-0">
                            <span className="text-xs font-semibold text-slate-900 dark:text-white group-hover:text-amber-600 truncate block">
                              {item.garment.name}
                            </span>
                            <span className="text-[10px] text-slate-400 dark:text-zinc-500">
                              {item.garment.ownerId ? 'Your item' : item.garment.garmentType.name}
                            </span>
                          </div>
                        </>
                      );
                      const className =
                        'flex items-center gap-2.5 p-2.5 rounded-xl bg-slate-50 dark:bg-zinc-800/60 border border-slate-200/80 dark:border-zinc-700/60 transition-colors group';
                      return item.garment.ownerId ? (
                        <div key={item.id} className={className}>{body}</div>
                      ) : (
                        <Link key={item.id} href={`/encyclopedia/${item.garment.slug}`} className={`${className} hover:border-amber-500`}>
                          {body}
                        </Link>
                      );
                    })}
                  </div>
                </Card>
              ))}
            </div>
          ) : (
            <Card className="text-center py-16 bg-white dark:bg-zinc-900 border-slate-200 dark:border-zinc-800">
              <CardContent className="space-y-4">
                <Bookmark className="w-12 h-12 text-slate-400 dark:text-zinc-600 mx-auto" />
                <h3 className="text-xl font-semibold text-slate-800 dark:text-white">No Saved Looks Yet</h3>
                <p className="text-sm text-slate-500 dark:text-zinc-400 max-w-md mx-auto">
                  Build custom outfits using our Outfit Builder or Quick Pick tool, and save your favorite scoring combinations here!
                </p>
                <Link href="/outfit-builder">
                  <Button>
                    <Plus className="w-4 h-4 mr-2" /> Build & Save an Outfit
                  </Button>
                </Link>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* VIEW: Inventory Items Grouped by Category */}
      {activeTab === 'inventory' && (
        <div>
          {loading ? (
            <div className="py-20 text-center flex items-center justify-center">
              <div className="animate-spin w-8 h-8 border-2 border-amber-600 dark:border-amber-400 border-t-transparent rounded-full" />
            </div>
          ) : wardrobe.length > 0 ? (
            <div className="space-y-12">
              {categories.map((category) => {
                const items = wardrobe.filter((w) => w.garment.garmentType === category);
                if (items.length === 0) return null;

                return (
                  <div key={category} className="space-y-4">
                    <h2 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
                      <Shirt className="w-5 h-5 text-amber-600 dark:text-amber-400" />
                      My {category}s ({items.length})
                    </h2>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                      {items.map((item) => (
                        <div key={item.id} className="relative group">
                          <GarmentCard
                            name={item.garment.name}
                            slug={item.garment.slug}
                            garmentType={item.garment.garmentType}
                            formalityLevel={item.garment.formalityLevel}
                            colors={item.garment.colors}
                            linkable={!item.garment.isOwn}
                            badge={item.garment.isOwn ? 'Your item' : undefined}
                          />
                          <button
                            onClick={() => handleRemoveGarment(item.garmentId, item.garment.isOwn)}
                            className="absolute top-3 right-3 p-2 rounded-lg bg-red-600 text-white opacity-0 group-hover:opacity-100 focus-visible:opacity-100 hover:bg-red-700 transition-all shadow-md cursor-pointer"
                            title={item.garment.isOwn ? 'Delete your item' : 'Remove from closet'}
                            aria-label={`${item.garment.isOwn ? 'Delete' : 'Remove'} ${item.garment.name}`}
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <Card className="text-center py-16 bg-white dark:bg-zinc-900 border-slate-200 dark:border-zinc-800">
              <CardContent className="space-y-4">
                <ShoppingBag className="w-12 h-12 text-slate-400 dark:text-zinc-600 mx-auto" />
                <h3 className="text-xl font-semibold text-slate-800 dark:text-white">Your Digital Closet is Empty</h3>
                <p className="text-sm text-slate-500 dark:text-zinc-400 max-w-md mx-auto">
                  Add clothes you own from the catalog above to start building your digital wardrobe!
                </p>
                <Button onClick={() => setShowAddModal(true)}>
                  <Plus className="w-4 h-4" /> Add Your First Item
                </Button>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* Auth Modal */}
      <AuthModal
        isOpen={authModalOpen}
        onClose={() => setAuthModalOpen(false)}
        onSuccess={() => {
          fetchData();
        }}
      />
    </div>
  );
}
