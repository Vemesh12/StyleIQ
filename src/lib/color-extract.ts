// Pure pixel analysis for the color scanner (no DOM), so it can be tested.

export function toHex(r: number, g: number, b: number): string {
  const c = (v: number) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0');
  return `#${c(r)}${c(g)}${c(b)}`;
}

/**
 * Finds the main garment colors in an image's pixels.
 *
 * - Pixels are grouped into 16-level bins per channel (bin index 0-15, so a
 *   bright channel can never overflow into its neighbour), and each bin
 *   reports the AVERAGE real color of its pixels, not the bin edge.
 * - Black and white are kept — they're the most common menswear colors.
 * - The center of the photo counts more than the edges (the garment is
 *   usually in the middle), and whatever color dominates the photo's border
 *   is treated as background and heavily down-weighted.
 * - Near-duplicate shades are merged so the 5 results are distinct colors.
 */
export function dominantColorsFromPixels(data: Uint8ClampedArray, w: number, h: number): string[] {
  const binOf = (i: number) => ((data[i] >> 4) << 8) | ((data[i + 1] >> 4) << 4) | (data[i + 2] >> 4);

  // 1. Background guess: most common bin along the outer 6% border.
  const border = Math.max(1, Math.round(Math.min(w, h) * 0.06));
  const borderCounts = new Map<number, number>();
  let borderTotal = 0;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (x >= border && x < w - border && y >= border && y < h - border) continue;
      const i = (y * w + x) * 4;
      if (data[i + 3] < 128) continue;
      const bin = binOf(i);
      borderCounts.set(bin, (borderCounts.get(bin) ?? 0) + 1);
      borderTotal++;
    }
  }
  let backgroundBin = -1;
  for (const [bin, count] of borderCounts) {
    if (count > borderTotal * 0.35 && (backgroundBin === -1 || count > (borderCounts.get(backgroundBin) ?? 0))) backgroundBin = bin;
  }
  const bgR = backgroundBin >> 8, bgG = (backgroundBin >> 4) & 15, bgB = backgroundBin & 15;

  // 2. Weighted color bins.
  const bins = new Map<number, { weight: number; r: number; g: number; b: number }>();
  const cx = w / 2, cy = h / 2;
  const sigma2 = 2 * Math.pow(Math.max(w, h) * 0.35, 2);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      if (data[i + 3] < 128) continue;
      const bin = binOf(i);
      let weight = Math.exp(-((x - cx) ** 2 + (y - cy) ** 2) / sigma2);
      if (backgroundBin !== -1) {
        const d = Math.abs((bin >> 8) - bgR) + Math.abs(((bin >> 4) & 15) - bgG) + Math.abs((bin & 15) - bgB);
        if (d <= 1) weight *= 0.08;
      }
      const entry = bins.get(bin) ?? { weight: 0, r: 0, g: 0, b: 0 };
      entry.weight += weight;
      entry.r += data[i] * weight;
      entry.g += data[i + 1] * weight;
      entry.b += data[i + 2] * weight;
      bins.set(bin, entry);
    }
  }

  // 3. Strongest distinct colors.
  const ranked = [...bins.values()]
    .filter((e) => e.weight > 0)
    .sort((a, b) => b.weight - a.weight)
    .map((e) => [e.r / e.weight, e.g / e.weight, e.b / e.weight] as const);
  const chosen: (readonly [number, number, number])[] = [];
  for (const c of ranked) {
    if (chosen.some((k) => Math.hypot(k[0] - c[0], k[1] - c[1], k[2] - c[2]) < 36)) continue;
    chosen.push(c);
    if (chosen.length === 5) break;
  }
  return chosen.map(([r, g, b]) => toHex(r, g, b));
}
