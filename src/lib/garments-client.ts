// Browser helper: loads every garment from /api/garments page by page, so
// pickers never silently stop at a fixed page size as the catalog grows.

export interface CatalogGarment {
  id: string;
  name: string;
  slug: string;
  formalityLevel: number;
  garmentType: string;
  garmentTypeSlug: string;
  colors: { name: string; hex: string }[];
}

// The catalog changes rarely, so one load is shared for the page's lifetime
// (e.g. the wardrobe no longer re-downloads it after every add/remove).
let cache: Promise<CatalogGarment[]> | null = null;

export function fetchAllGarments(): Promise<CatalogGarment[]> {
  if (!cache) {
    cache = loadAllPages();
    cache.catch(() => {
      cache = null;
    });
  }
  return cache;
}

async function loadAllPages(): Promise<CatalogGarment[]> {
  const all: CatalogGarment[] = [];
  for (let page = 1; page <= 50; page++) {
    const res = await fetch(`/api/garments?limit=200&page=${page}`);
    if (!res.ok) throw new Error(`Failed to load garments (${res.status})`);
    const data: { garments: CatalogGarment[]; hasMore: boolean } = await res.json();
    all.push(...data.garments);
    if (!data.hasMore) break;
  }
  return all;
}
