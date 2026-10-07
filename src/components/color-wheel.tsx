'use client';

import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Compass, CheckCircle2 } from 'lucide-react';

// Convert HSL to Hex
function hslToHex(h: number, s: number, l: number): string {
  l /= 100;
  const a = (s * Math.min(l, 1 - l)) / 100;
  const f = (n: number) => {
    const k = (n + h / 30) % 12;
    const color = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
    return Math.round(255 * color)
      .toString(16)
      .padStart(2, '0');
  };
  return `#${f(0)}${f(8)}${f(4)}`;
}

export function ColorWheel() {
  const [hue, setHue] = useState<number>(210); // Default Navy Blue (210°)
  const [saturation, setSaturation] = useState<number>(75);
  const [lightness, setLightness] = useState<number>(45);

  const primaryHex = hslToHex(hue, saturation, lightness);

  // Harmony angles
  const compHue = (hue + 180) % 360;
  const compHex = hslToHex(compHue, saturation, lightness);

  const analHue1 = (hue + 30) % 360;
  const analHex1 = hslToHex(analHue1, saturation, lightness);

  const analHue2 = (hue + 330) % 360;
  const analHex2 = hslToHex(analHue2, saturation, lightness);

  const triadHue1 = (hue + 120) % 360;
  const triadHex1 = hslToHex(triadHue1, saturation, lightness);

  const triadHue2 = (hue + 240) % 360;
  const triadHex2 = hslToHex(triadHue2, saturation, lightness);

  return (
    <Card className="bg-white dark:bg-zinc-900 border-slate-200 dark:border-zinc-800 p-6 shadow-xl">
      <div className="flex items-center justify-between mb-6 pb-4 border-b border-slate-200 dark:border-zinc-800">
        <div>
          <div className="flex items-center gap-2 text-amber-700 dark:text-amber-400 text-xs font-bold uppercase tracking-wider mb-1">
            <Compass className="w-4 h-4" /> 360° Color Theory Engine
          </div>
          <h2 className="text-2xl font-extrabold text-slate-900 dark:text-white">
            Interactive Color Wheel Calculator
          </h2>
        </div>
        <div className="flex items-center gap-3">
          <div
            className="w-10 h-10 rounded-full border-2 border-white dark:border-zinc-800 shadow-md transition-all"
            style={{ backgroundColor: primaryHex }}
          />
          <div className="text-right">
            <span className="text-xs font-bold text-slate-500 dark:text-zinc-400 uppercase">Selected Hue</span>
            <p className="text-sm font-mono font-bold text-slate-900 dark:text-white uppercase">{primaryHex}</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
        {/* Visual Wheel Picker */}
        <div className="lg:col-span-5 flex flex-col items-center justify-center space-y-6">
          <div className="relative w-64 h-64 rounded-full shadow-2xl p-2 bg-gradient-to-r from-red-500 via-yellow-500 via-green-500 via-cyan-500 via-blue-500 via-purple-500 to-red-500 flex items-center justify-center">
            <div className="w-full h-full rounded-full bg-slate-50 dark:bg-zinc-950 flex flex-col items-center justify-center relative shadow-inner">
              <div
                className="w-24 h-24 rounded-full border-4 border-white dark:border-zinc-800 shadow-xl transition-all flex flex-col items-center justify-center"
                style={{ backgroundColor: primaryHex }}
              >
                <span className="text-xs font-mono font-bold text-white drop-shadow-md">{hue}°</span>
              </div>
            </div>
          </div>

          {/* Hue Slider */}
          <div className="w-full space-y-3">
            <div className="flex justify-between text-xs font-bold text-slate-600 dark:text-zinc-400">
              <span>Hue Angle</span>
              <span>{hue}°</span>
            </div>
            <input
              type="range"
              min="0"
              max="359"
              value={hue}
              onChange={(e) => setHue(Number(e.target.value))}
              className="w-full h-3 rounded-lg appearance-none cursor-pointer bg-gradient-to-r from-red-500 via-yellow-500 via-green-500 via-cyan-500 via-blue-500 via-purple-500 to-red-500 shadow-xs"
            />

            <div className="grid grid-cols-2 gap-4 pt-2">
              <div>
                <label className="text-xs font-bold text-slate-500 dark:text-zinc-400 block mb-1">Saturation ({saturation}%)</label>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={saturation}
                  onChange={(e) => setSaturation(Number(e.target.value))}
                  className="w-full h-2 rounded-lg bg-slate-200 dark:bg-zinc-800 cursor-pointer"
                />
              </div>
              <div>
                <label className="text-xs font-bold text-slate-500 dark:text-zinc-400 block mb-1">Lightness ({lightness}%)</label>
                <input
                  type="range"
                  min="15"
                  max="85"
                  value={lightness}
                  onChange={(e) => setLightness(Number(e.target.value))}
                  className="w-full h-2 rounded-lg bg-slate-200 dark:bg-zinc-800 cursor-pointer"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Calculated Color Harmonies Output */}
        <div className="lg:col-span-7 space-y-6">
          {/* Complementary Match (180°) */}
          <div className="p-4 rounded-xl bg-slate-50 dark:bg-zinc-800/80 border border-slate-200 dark:border-zinc-700 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-amber-700 dark:text-amber-400 flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4" /> Bold Opposite Contrast (Sharp Match)
              </span>
              <Badge variant="excellent">Best Contrast Match</Badge>
            </div>
            <div className="flex items-center gap-4 pt-1">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full border border-slate-300 dark:border-zinc-600 shadow-xs" style={{ backgroundColor: primaryHex }} />
                <span className="text-xs font-mono font-bold text-slate-900 dark:text-white uppercase">{primaryHex}</span>
              </div>
              <span className="text-slate-400 font-bold">+</span>
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full border border-slate-300 dark:border-zinc-600 shadow-xs" style={{ backgroundColor: compHex }} />
                <span className="text-xs font-mono font-bold text-slate-900 dark:text-white uppercase">{compHex}</span>
              </div>
            </div>
            <p className="text-xs text-slate-600 dark:text-zinc-400 italic pt-1">
              Gives a bold, attractive contrast match. Great for pairing plain shirts with contrasting pants or shoes.
            </p>
          </div>

          {/* Analogous Neighbors (30°) */}
          <div className="p-4 rounded-xl bg-slate-50 dark:bg-zinc-800/80 border border-slate-200 dark:border-zinc-700 space-y-2">
            <span className="text-xs font-bold uppercase tracking-wider text-blue-700 dark:text-blue-400">
              Neighbouring Matching Colors (Smooth Flow)
            </span>
            <div className="flex items-center gap-3 pt-1">
              <div className="w-7 h-7 rounded-full border border-slate-300 dark:border-zinc-600" style={{ backgroundColor: analHex2 }} />
              <div className="w-8 h-8 rounded-full border-2 border-amber-500 shadow-xs" style={{ backgroundColor: primaryHex }} />
              <div className="w-7 h-7 rounded-full border border-slate-300 dark:border-zinc-600" style={{ backgroundColor: analHex1 }} />
            </div>
            <p className="text-xs text-slate-600 dark:text-zinc-400 italic pt-1">
              Colors sitting next to each other on the color wheel. Creates a natural, smooth look ideal for daily wear.
            </p>
          </div>

          {/* Triadic Palette (120°) */}
          <div className="p-4 rounded-xl bg-slate-50 dark:bg-zinc-800/80 border border-slate-200 dark:border-zinc-700 space-y-2">
            <span className="text-xs font-bold uppercase tracking-wider text-purple-700 dark:text-purple-400">
              3-Way Balanced Color Combination
            </span>
            <div className="flex items-center gap-3 pt-1">
              <div className="w-7 h-7 rounded-full border border-slate-300 dark:border-zinc-600" style={{ backgroundColor: primaryHex }} />
              <div className="w-7 h-7 rounded-full border border-slate-300 dark:border-zinc-600" style={{ backgroundColor: triadHex1 }} />
              <div className="w-7 h-7 rounded-full border border-slate-300 dark:border-zinc-600" style={{ backgroundColor: triadHex2 }} />
            </div>
            <p className="text-xs text-slate-600 dark:text-zinc-400 italic pt-1">
              Three colors that balance each other out cleanly across your shirt, pants, and shoes.
            </p>
          </div>
        </div>
      </div>
    </Card>
  );
}
