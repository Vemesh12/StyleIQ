'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { GarmentIllustration } from '@/components/garment-illustration';
import Link from 'next/link';
import {
  Camera,
  Upload,
  Pipette,
  Sparkles,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  Eye,
  X,
} from 'lucide-react';

interface MatchedColor {
  id: string;
  name: string;
  hex: string;
  slug: string;
  family: string;
  isNeutral: boolean;
}

interface AlternativeColor {
  id: string;
  name: string;
  hex: string;
  slug: string;
  family: string;
  confidence: number;
}

interface HarmonyResult {
  color: {
    id: string;
    name: string;
    hex: string;
    family: string;
  };
  harmony: string;
  score: number;
  ruleType: string;
  reason: string;
}

interface MatchingGarment {
  id: string;
  name: string;
  slug: string;
  formalityLevel: number;
  category: string;
  typeName: string;
  colors: { name: string; hex: string }[];
}

interface MatchResponse {
  detectedHex: string;
  matchedColor: MatchedColor;
  matchConfidence: number;
  alternatives: AlternativeColor[];
  harmonies: HarmonyResult[];
  avoidHarmonies: HarmonyResult[];
  matchingGarments: MatchingGarment[];
}

const PRESET_SWATCHES = [
  { name: 'Navy Blue Blazer', hex: '#1B2A4A', category: 'jacket' },
  { name: 'Olive Green Chino', hex: '#4A5D3E', category: 'trouser' },
  { name: 'Burgundy Wool Knit', hex: '#6B1D2F', category: 'sweater' },
  { name: 'Camel Trench Coat', hex: '#C19A6B', category: 'jacket' },
  { name: 'Charcoal Grey Suit', hex: '#36454F', category: 'jacket' },
  { name: 'Sky Blue Oxford', hex: '#87CEEB', category: 'shirt' },
];

export function ImageColorPicker() {
  const [imageSrc, setImageSrc] = useState<string | null>(null);
  const [selectedHex, setSelectedHex] = useState<string>('#1B2A4A');
  const [isCameraActive, setIsCameraActive] = useState<boolean>(false);
  const [analyzing, setAnalyzing] = useState<boolean>(false);
  const [matchData, setMatchData] = useState<MatchResponse | null>(null);
  const [dominantColors, setDominantColors] = useState<string[]>([]);
  const [hoverHex, setHoverHex] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const previewImgRef = useRef<HTMLImageElement>(null);

  // Trigger analysis for a given hex
  const analyzeColor = useCallback(async (hex: string) => {
    setSelectedHex(hex);
    setAnalyzing(true);
    try {
      const res = await fetch('/api/colors/match', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ hex }),
      });
      if (res.ok) {
        const data: MatchResponse = await res.json();
        setMatchData(data);
      }
    } catch (err) {
      console.error('Failed to match color:', err);
    } finally {
      setAnalyzing(false);
    }
  }, []);

  // Initial analysis on mount
  useEffect(() => {
    analyzeColor('#1B2A4A');
  }, [analyzeColor]);

  // Handle file upload
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    stopCamera();
    const reader = new FileReader();
    reader.onload = (event) => {
      const result = event.target?.result as string;
      setImageSrc(result);
      extractColorsFromImage(result);
    };
    reader.readAsDataURL(file);
  };

  // Start live webcam stream
  const startCamera = async () => {
    setImageSrc(null);
    setIsCameraActive(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 640 }, height: { ideal: 480 } },
      });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
      }
    } catch (err) {
      console.error('Camera access error:', err);
      setIsCameraActive(false);
      alert('Camera access was denied or is unavailable on this device.');
    }
  };

  // Stop webcam
  const stopCamera = () => {
    if (videoRef.current && videoRef.current.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach((track) => track.stop());
      videoRef.current.srcObject = null;
    }
    setIsCameraActive(false);
  };

  // Capture snapshot from webcam
  const captureSnapshot = () => {
    if (!videoRef.current) return;
    const canvas = document.createElement('canvas');
    canvas.width = videoRef.current.videoWidth || 640;
    canvas.height = videoRef.current.videoHeight || 480;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
    const dataUrl = canvas.toDataURL('image/jpeg');
    stopCamera();
    setImageSrc(dataUrl);
    extractColorsFromImage(dataUrl);
  };

  // Extract dominant colors from loaded image
  const extractColorsFromImage = (src: string) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const canvas = canvasRef.current || document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const maxDim = 150;
      const scale = Math.min(maxDim / img.width, maxDim / img.height);
      const w = Math.max(1, Math.floor(img.width * scale));
      const h = Math.max(1, Math.floor(img.height * scale));

      canvas.width = w;
      canvas.height = h;
      ctx.drawImage(img, 0, 0, w, h);

      try {
        const imgData = ctx.getImageData(0, 0, w, h).data;
        const colorBuckets: { [hex: string]: number } = {};

        for (let i = 0; i < imgData.length; i += 16) {
          const r = imgData[i];
          const g = imgData[i + 1];
          const b = imgData[i + 2];
          const a = imgData[i + 3];

          if (a < 128) continue;
          // Filter out pure black / pure white edge artifacts
          const brightness = (r * 299 + g * 587 + b * 114) / 1000;
          if (brightness < 15 || brightness > 245) continue;

          // Quantize to reduce noise
          const qr = Math.round(r / 16) * 16;
          const qg = Math.round(g / 16) * 16;
          const qb = Math.round(b / 16) * 16;
          const hex = `#${((1 << 24) + (qr << 16) + (qg << 8) + qb).toString(16).slice(1)}`;

          colorBuckets[hex] = (colorBuckets[hex] || 0) + 1;
        }

        const sorted = Object.entries(colorBuckets)
          .sort((a, b) => b[1] - a[1])
          .map(([hex]) => hex)
          .slice(0, 5);

        if (sorted.length > 0) {
          setDominantColors(sorted);
          analyzeColor(sorted[0]);
        }
      } catch (e) {
        console.error('Canvas reading error:', e);
      }
    };
    img.src = src;
  };

  // Eyedropper click on image
  const handleImageClick = (e: React.MouseEvent<HTMLImageElement>) => {
    if (!previewImgRef.current) return;
    const img = previewImgRef.current;
    const rect = img.getBoundingClientRect();
    const x = Math.floor(((e.clientX - rect.left) / rect.width) * img.naturalWidth);
    const y = Math.floor(((e.clientY - rect.top) / rect.height) * img.naturalHeight);

    const canvas = document.createElement('canvas');
    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.drawImage(img, 0, 0);
    const pixel = ctx.getImageData(x, y, 1, 1).data;
    const hex = `#${((1 << 24) + (pixel[0] << 16) + (pixel[1] << 8) + pixel[2]).toString(16).slice(1)}`;
    analyzeColor(hex);
  };

  return (
    <Card className="bg-white dark:bg-zinc-900 border-amber-200 dark:border-amber-900/50 shadow-xl overflow-hidden">
      <CardHeader className="bg-gradient-to-r from-amber-500/10 via-orange-500/5 to-transparent border-b border-slate-100 dark:border-zinc-800 pb-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400 text-xs font-bold uppercase tracking-wider mb-1">
              <Camera className="w-4 h-4" />
              AI & Camera Color Scanner
            </div>
            <CardTitle className="text-2xl font-extrabold text-slate-900 dark:text-white">
              Scan Your Wardrobe Item
            </CardTitle>
            <p className="text-sm text-slate-500 dark:text-zinc-400">
              Upload a photo or take a picture of any shirt, jacket, or pant to instantly identify its color and discover perfect pairings.
            </p>
          </div>

          {/* Quick Actions */}
          <div className="flex items-center gap-2 flex-wrap">
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileUpload}
              accept="image/*"
              className="hidden"
            />
            <Button
              variant="outline"
              size="sm"
              onClick={() => fileInputRef.current?.click()}
              className="border-slate-300 dark:border-zinc-700 font-bold"
            >
              <Upload className="w-4 h-4 mr-1.5" />
              Upload Photo
            </Button>

            {!isCameraActive ? (
              <Button
                variant="outline"
                size="sm"
                onClick={startCamera}
                className="border-amber-300 dark:border-amber-700/50 text-amber-700 dark:text-amber-400 font-bold"
              >
                <Camera className="w-4 h-4 mr-1.5" />
                Live Camera
              </Button>
            ) : (
              <Button
                variant="destructive"
                size="sm"
                onClick={stopCamera}
                className="font-bold"
              >
                <X className="w-4 h-4 mr-1.5" />
                Close Camera
              </Button>
            )}
          </div>
        </div>
      </CardHeader>

      <CardContent className="p-6 space-y-8">
        {/* Hidden Canvas for computation */}
        <canvas ref={canvasRef} className="hidden" />

        {/* Input & Scanner Viewport */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Left Column: Image or Video or Presets (5 Cols) */}
          <div className="lg:col-span-5 space-y-4">
            <div className="relative rounded-2xl overflow-hidden border-2 border-dashed border-slate-300 dark:border-zinc-700 bg-slate-100 dark:bg-zinc-800/50 aspect-4/3 flex items-center justify-center group shadow-inner">
              {/* Webcam view */}
              {isCameraActive && (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-black">
                  <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute bottom-4 left-0 right-0 flex justify-center">
                    <Button
                      onClick={captureSnapshot}
                      className="bg-amber-600 hover:bg-amber-700 text-white font-bold shadow-lg"
                    >
                      <Camera className="w-4 h-4 mr-2" /> Snap Photo
                    </Button>
                  </div>
                </div>
              )}

              {/* Uploaded or default image preview */}
              {!isCameraActive && imageSrc && (
                <div className="relative w-full h-full flex items-center justify-center bg-zinc-950">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    ref={previewImgRef}
                    src={imageSrc}
                    alt="Scanned garment"
                    onClick={handleImageClick}
                    className="max-h-full max-w-full object-contain cursor-crosshair"
                    title="Click anywhere to sample exact color"
                  />
                  <div className="absolute top-3 left-3 bg-black/70 backdrop-blur-xs text-white text-xs px-2.5 py-1 rounded-full flex items-center gap-1.5 pointer-events-none">
                    <Pipette className="w-3 h-3 text-amber-400" /> Click image to sample color
                  </div>
                </div>
              )}

              {/* Empty placeholder state */}
              {!isCameraActive && !imageSrc && (
                <div className="text-center p-6 space-y-3">
                  <div className="w-16 h-16 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center mx-auto">
                    <Camera className="w-8 h-8" />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-slate-800 dark:text-zinc-200">
                      Snap or upload a garment photo
                    </p>
                    <p className="text-xs text-slate-500 dark:text-zinc-400 mt-1">
                      Or select one of the garment presets below to test the color matcher.
                    </p>
                  </div>
                  <Button
                    size="sm"
                    onClick={() => fileInputRef.current?.click()}
                    className="bg-amber-600 hover:bg-amber-700 text-white font-bold"
                  >
                    Upload Image
                  </Button>
                </div>
              )}
            </div>

            {/* Extracted Dominant Palette (if image loaded) */}
            {dominantColors.length > 0 && (
              <div className="space-y-2">
                <span className="text-xs font-bold text-slate-500 dark:text-zinc-400 uppercase tracking-wider flex items-center gap-1">
                  <Pipette className="w-3.5 h-3.5" /> Detected Fabric Colors (Click to switch):
                </span>
                <div className="flex items-center gap-2">
                  {dominantColors.map((hex, idx) => (
                    <button
                      key={idx}
                      onClick={() => analyzeColor(hex)}
                      className={`w-9 h-9 rounded-xl border-2 transition-all shadow-xs flex items-center justify-center ${
                        selectedHex.toLowerCase() === hex.toLowerCase()
                          ? 'border-amber-600 scale-110 shadow-md ring-2 ring-amber-500/30'
                          : 'border-slate-300 dark:border-zinc-700 hover:scale-105'
                      }`}
                      style={{ backgroundColor: hex }}
                      title={`Analyze ${hex}`}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Preset Test Garments */}
            <div className="space-y-2 pt-2 border-t border-slate-200 dark:border-zinc-800">
              <span className="text-xs font-bold text-slate-500 dark:text-zinc-400 uppercase tracking-wider">
                Or Try Sample Garments:
              </span>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {PRESET_SWATCHES.map((preset) => (
                  <button
                    key={preset.name}
                    onClick={() => {
                      setImageSrc(null);
                      setDominantColors([]);
                      analyzeColor(preset.hex);
                    }}
                    className={`flex items-center gap-2 p-2 rounded-xl border text-left transition-all ${
                      selectedHex.toLowerCase() === preset.hex.toLowerCase()
                        ? 'border-amber-600 bg-amber-500/10 text-amber-900 dark:text-amber-300'
                        : 'border-slate-200 dark:border-zinc-800 hover:border-slate-300 bg-slate-50 dark:bg-zinc-800/40 text-slate-700 dark:text-zinc-300'
                    }`}
                  >
                    <div
                      className="w-5 h-5 rounded-md border border-black/10 shrink-0 shadow-xs"
                      style={{ backgroundColor: preset.hex }}
                    />
                    <span className="text-xs font-semibold truncate">{preset.name}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Right Column: AI Analysis & Match Results (7 Cols) */}
          <div className="lg:col-span-7 space-y-6">
            {analyzing ? (
              <div className="p-12 text-center rounded-2xl border border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-900/50 space-y-3">
                <RefreshCw className="w-8 h-8 text-amber-600 animate-spin mx-auto" />
                <p className="text-sm font-bold text-slate-900 dark:text-white">
                  Matching with StyleIQ Color Harmony Engine...
                </p>
                <p className="text-xs text-slate-500 dark:text-zinc-400">
                  Scanning color families, undertones, and database pairings.
                </p>
              </div>
            ) : matchData ? (
              <div className="space-y-6 animate-fade-in">
                {/* Matched Color Banner */}
                <div className="p-5 rounded-2xl bg-slate-50 dark:bg-zinc-800/60 border border-slate-200 dark:border-zinc-700 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="flex items-center gap-4">
                    <div
                      className="w-14 h-14 rounded-2xl shadow-md border-2 border-white dark:border-zinc-700 shrink-0"
                      style={{ backgroundColor: matchData.matchedColor.hex }}
                    />
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="text-xl font-extrabold text-slate-900 dark:text-white">
                          {matchData.matchedColor.name}
                        </h3>
                        <Badge variant="outline" className="text-xs font-mono">
                          {matchData.matchedColor.hex}
                        </Badge>
                      </div>
                      <p className="text-xs text-slate-500 dark:text-zinc-400 mt-1">
                        Family: <strong className="text-slate-700 dark:text-zinc-200">{matchData.matchedColor.family}</strong>
                        {matchData.matchedColor.isNeutral && ' • Neutral Anchor Color'}
                      </p>
                    </div>
                  </div>

                  <div className="text-left sm:text-right shrink-0">
                    <span className="text-xs uppercase font-bold text-slate-400 dark:text-zinc-500 tracking-wider">
                      Match Confidence
                    </span>
                    <div className="text-2xl font-black text-emerald-600 dark:text-emerald-400">
                      {matchData.matchConfidence}%
                    </div>
                  </div>
                </div>

                {/* Alternative candidates */}
                {matchData.alternatives?.length > 0 && (
                  <div className="flex items-center gap-2 flex-wrap text-xs">
                    <span className="text-slate-500 dark:text-zinc-400 font-semibold">Closest alternatives:</span>
                    {matchData.alternatives.map((alt) => (
                      <button
                        key={alt.id}
                        onClick={() => analyzeColor(alt.hex)}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-200/60 dark:bg-zinc-800 hover:bg-slate-300 text-slate-700 dark:text-zinc-300 font-medium transition-colors"
                      >
                        <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: alt.hex }} />
                        {alt.name} ({alt.confidence}%)
                      </button>
                    ))}
                  </div>
                )}

                {/* Recommended Pairs */}
                <div className="space-y-3">
                  <h4 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                    Recommended Pairing Colors:
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {matchData.harmonies.slice(0, 4).map((rule, idx) => (
                      <div
                        key={idx}
                        className="p-3.5 rounded-xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 flex items-start gap-3 shadow-xs"
                      >
                        <div
                          className="w-8 h-8 rounded-lg shrink-0 border border-black/10 shadow-xs"
                          style={{ backgroundColor: rule.color.hex }}
                        />
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-slate-900 dark:text-white truncate">
                              {rule.color.name}
                            </span>
                            <Badge variant="good" className="text-[10px] py-0 px-1.5 font-bold uppercase">
                              {rule.harmony}
                            </Badge>
                          </div>
                          <p className="text-[11px] text-slate-500 dark:text-zinc-400 mt-1 leading-snug line-clamp-2">
                            {rule.reason || `Creates a balanced ${rule.harmony} pairing with ${matchData.matchedColor.name}.`}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Avoid Clashes */}
                {matchData.avoidHarmonies?.length > 0 && (
                  <div className="space-y-2">
                    <h4 className="text-xs font-bold text-red-700 dark:text-red-400 flex items-center gap-1.5">
                      <AlertTriangle className="w-3.5 h-3.5 text-red-600" />
                      Colors to Avoid Pairing with {matchData.matchedColor.name}:
                    </h4>
                    <div className="flex items-center gap-2 flex-wrap">
                      {matchData.avoidHarmonies.slice(0, 3).map((rule, idx) => (
                        <div
                          key={idx}
                          className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/40 text-xs font-semibold text-red-800 dark:text-red-300"
                        >
                          <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: rule.color.hex }} />
                          {rule.color.name}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Matching Closet Garments */}
                {matchData.matchingGarments?.length > 0 && (
                  <div className="space-y-3 pt-4 border-t border-slate-200 dark:border-zinc-800">
                    <div className="flex items-center justify-between">
                      <h4 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                        <Sparkles className="w-4 h-4 text-amber-500" />
                        Matching Clothes in the Catalog:
                      </h4>
                      <Link
                        href="/outfit-builder"
                        className="text-xs font-bold text-amber-600 dark:text-amber-400 hover:underline flex items-center gap-1"
                      >
                        Style in Outfit Builder <ArrowRight className="w-3 h-3" />
                      </Link>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      {matchData.matchingGarments.slice(0, 4).map((garment) => (
                        <div
                          key={garment.id}
                          className="p-3 rounded-xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 flex flex-col items-center text-center space-y-2 hover:border-amber-500 transition-colors"
                        >
                          <div className="p-2 rounded-lg bg-slate-100 dark:bg-zinc-800">
                            <GarmentIllustration
                              category={garment.category || 'shirt'}
                              colors={garment.colors}
                              size={36}
                            />
                          </div>
                          <span className="text-xs font-bold text-slate-900 dark:text-white line-clamp-1">
                            {garment.name}
                          </span>
                          <span className="text-[10px] text-slate-500 dark:text-zinc-400">
                            {garment.typeName}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Action button */}
                <div className="pt-2">
                  <Link href={`/outfit-builder`}>
                    <Button className="w-full bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-700 hover:to-orange-700 text-white font-bold shadow-md">
                      <Sparkles className="w-4 h-4 mr-2" />
                      Build Complete Outfit Around {matchData.matchedColor.name}
                    </Button>
                  </Link>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
