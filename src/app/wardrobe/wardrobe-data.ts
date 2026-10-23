import { fetchAllGarments } from '@/lib/garments-client';
import { readGuestWardrobe } from '@/lib/guest-wardrobe';

// Types and data loading for the wardrobe page, kept out of the page
// component so the page is mostly UI.

export interface DailyOutfitItem {
  id: string;
  name: string;
  slug?: string;
  typeSlug?: string;
  colors: { name: string; hex: string }[];
  /** The person's own (private) garment — no encyclopedia page. */
  isOwn?: boolean;
}

export interface SavedOutfitRow {
  id: string;
  name: string;
  outfitScore: number;
  createdAt: string;
  items: {
    id: string;
    layerOrder: number;
    garment: {
      id: string;
      name: string;
      slug: string;
      ownerId?: string | null; // set = the user's own (private) item
      garmentType: { name: string; slug: string };
      colors: { color: { name: string; hex: string } }[];
    };
  }[];
}

export interface DailySuggestion {
  weather: { tempC: number; description: string; isRainy: boolean } | null;
  outfit: {
    score: number;
    shirt: DailyOutfitItem;
    trouser: DailyOutfitItem;
    shoe: DailyOutfitItem;
    layer: DailyOutfitItem | null;
    belt: DailyOutfitItem | null;
    accessories?: DailyOutfitItem[];
    highlights: string[];
    suggestions: string[];
  } | null;
  message: string | null;
}

// Both the authenticated wardrobe API (nested Prisma `{ color: {...} }` join
// rows, `garmentType` as an object) and the guest-mode path (flat `{name,
// hex}` colors and a plain `garmentType` string, both from /api/garments)
// are normalized to this same shape at fetch time, so rendering code never
// has to know which source a wardrobe item came from.
export interface WardrobeItem {
  id: string;
  garmentId: string;
  quantity: number;
  garment: {
    id: string;
    name: string;
    slug: string;
    formalityLevel: number;
    garmentType: string;
    typeSlug: string;
    // True for an item the user added themselves (private, no catalog page).
    isOwn: boolean;
    colors: { name: string; hex: string }[];
  };
}

export interface AllGarment {
  id: string;
  name: string;
  slug: string;
  formalityLevel: number;
  garmentType: string;
  garmentTypeSlug: string;
  colors: { name: string; hex: string }[];
}

export interface RawWardrobeRow {
  id: string;
  garmentId: string;
  quantity: number;
  garment: {
    id: string;
    name: string;
    slug: string;
    formalityLevel: number;
    ownerId: string | null;
    garmentType: { name: string; slug: string };
    colors: { color: { name: string; hex: string } }[];
  };
}

export interface WardrobeData {
  isLoggedIn: boolean;
  wardrobe: WardrobeItem[];
  allGarments: AllGarment[];
  savedOutfits: SavedOutfitRow[];
}

/**
 * Loads everything the wardrobe page shows. Logged-in users get their
 * account closet; guests get the closet saved in this browser, resolved
 * against the catalog. Both are normalized to the same WardrobeItem shape.
 */
export async function loadWardrobeData(): Promise<WardrobeData> {
  const [wRes, allGarments, oRes] = await Promise.all([
    fetch('/api/user/wardrobe'),
    fetchAllGarments().catch((): AllGarment[] => []),
    fetch('/api/user/outfits'),
  ]);
  // Only a 401 means "guest". Any other failure (500, network, rate limit) is
  // an error — treating it as guest mode would show a signed-in person an
  // empty browser-only closet.
  if (!wRes.ok && wRes.status !== 401) {
    throw new Error(`Loading the closet failed (${wRes.status})`);
  }
  if (!oRes.ok && oRes.status !== 401) {
    throw new Error(`Loading saved outfits failed (${oRes.status})`);
  }
  const savedOutfits: SavedOutfitRow[] = oRes.ok ? await oRes.json() : [];

  if (wRes.ok) {
    const rows: RawWardrobeRow[] = await wRes.json();
    return {
      isLoggedIn: true,
      allGarments,
      savedOutfits,
      wardrobe: rows.map((w) => ({
        id: w.id,
        garmentId: w.garmentId,
        quantity: w.quantity,
        garment: {
          id: w.garment.id,
          name: w.garment.name,
          slug: w.garment.slug,
          formalityLevel: w.garment.formalityLevel,
          garmentType: w.garment.garmentType.name,
          typeSlug: w.garment.garmentType.slug,
          isOwn: !!w.garment.ownerId,
          colors: w.garment.colors.map((gc) => ({ name: gc.color.name, hex: gc.color.hex })),
        },
      })),
    };
  }

  const byId = new Map(allGarments.map((g) => [g.id, g]));
  return {
    isLoggedIn: false,
    allGarments,
    savedOutfits,
    wardrobe: readGuestWardrobe()
      .map((id) => byId.get(id))
      .filter((g): g is AllGarment => !!g)
      .map((garment) => ({
        id: `guest_${garment.id}`,
        garmentId: garment.id,
        quantity: 1,
        garment: {
          id: garment.id,
          name: garment.name,
          slug: garment.slug,
          formalityLevel: garment.formalityLevel,
          garmentType: garment.garmentType,
          typeSlug: garment.garmentTypeSlug,
          isOwn: false,
          colors: garment.colors,
        },
      })),
  };
}
