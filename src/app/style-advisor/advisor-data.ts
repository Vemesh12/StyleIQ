// Types and static option tables for the Style Advisor tabs.

export interface Options {
  hairColors: string[];
  eyeColors: string[];
  skinTones: string[];
  underTones: string[];
  torsoLengths: string[];
  bodyProportions: string[];
}

export interface PersonalizationResult {
  recommendedClothingColors: string;
  avoidClothingColors: string;
  recommendedFittingStyle: string;
  recommendedMaterials: string;
  recommendedPatterns: string;
  recommendedJewelryMetal: string;
  recommendedShoes: string;
  recommendedClothingColorWheelRegion: string;
  avoidClothingColorWheelRegion: string;
  fabricNature: string;
  dontExaggerate: string;
  doExaggerate: string;
  matchedOn?: string[];
  ignored?: string[];
}

export interface GarmentColorSummary {
  name: string;
  hex: string;
  slug?: string;
}

export interface DbColor {
  id: string;
  name: string;
  hex: string;
  slug: string;
  family: string;
  isNeutral: boolean;
}

export type CandidateRating = 'excellent' | 'good' | 'risky' | 'avoid';

export interface ScoredCandidate {
  id: string;
  name: string;
  slug: string;
  typeSlug: string;
  formalityLevel: number;
  description: string;
  colors: GarmentColorSummary[];
  score: number;
  rating: CandidateRating;
  warnings: string[];
  colorHarmonyDetail: { harmony: string; reason: string } | null;
}

export interface OutfitSetItem {
  slot: string;
  typeSlug: string;
  name: string;
  colors: GarmentColorSummary[];
  itemScore: number;
}

export interface OutfitSet {
  id: string;
  title: string;
  confidenceScore: number;
  rating: CandidateRating;
  items: OutfitSetItem[];
  warnings: string[];
  highlights?: string[];
}

export interface PickerResult {
  inputSummary: {
    category: string;
    itemType: string;
    colors: GarmentColorSummary[];
    occasion: string | null;
    season: string | null;
  };
  personalization?: { matchedOn: string[]; ignored: string[] };
  recommendation: {
    outfitSets: OutfitSet[];
    candidatesByType: Record<string, ScoredCandidate[]>;
    psychologyAdvice: string;
    colorWheelHarmony: { harmony: string; reason: string } | null;
  };
}

export interface CategoryMeta {
  slug: string;
  label: string;
  itemTypes: { id: string; label: string }[];
}

export const CATEGORIES: CategoryMeta[] = [
  {
    slug: 'shirt',
    label: 'Shirt / Top',
    itemTypes: [
      { id: 'formal-solid', label: 'Formal Plain Shirt' },
      { id: 'checks', label: 'Check Shirt' },
      { id: 'stripe', label: 'Line / Striped Shirt' },
      { id: 'printed', label: 'Printed Shirt' },
    ],
  },
  {
    slug: 'tshirt',
    label: 'T-Shirt',
    itemTypes: [
      { id: 'casual-plain', label: 'Plain Casual Tee' },
      { id: 'stripe', label: 'Striped Tee' },
      { id: 'printed', label: 'Printed / Graphic Tee' },
    ],
  },
  {
    slug: 'polo',
    label: 'Polo Shirt',
    itemTypes: [
      { id: 'formal-solid', label: 'Solid Polo' },
      { id: 'stripe', label: 'Striped Polo' },
    ],
  },
  {
    slug: 'trouser',
    label: 'Pant / Trouser',
    itemTypes: [
      { id: 'chinos', label: 'Cotton Chino Pants' },
      { id: 'formal-trousers', label: 'Formal Pants' },
      { id: 'denim-jeans', label: 'Jeans Pants' },
      { id: 'linen-trousers', label: 'Linen Pants' },
    ],
  },
  {
    slug: 'shoe',
    label: 'Footwear',
    itemTypes: [
      { id: 'oxfords', label: 'Formal Leather Shoes' },
      { id: 'loafers', label: 'Loafer Shoes' },
      { id: 'chelsea', label: 'Boots / Ankle Shoes' },
      { id: 'sneakers', label: 'Casual Sneakers' },
    ],
  },
  {
    slug: 'belt',
    label: 'Leather Belt',
    itemTypes: [
      { id: 'formal-leather', label: 'Formal Leather Belt' },
      { id: 'casual-suede', label: 'Casual Belt' },
      { id: 'woven', label: 'Cloth / Woven Belt' },
    ],
  },
  {
    slug: 'jacket',
    label: 'Blazer / Jacket',
    itemTypes: [
      { id: 'blazer', label: 'Blazer / Coat' },
      { id: 'suit-jacket', label: 'Formal Suit Coat' },
      { id: 'casual-jacket', label: 'Casual Jacket' },
    ],
  },
  {
    slug: 'sweater',
    label: 'Sweater',
    itemTypes: [
      { id: 'formal-solid', label: 'Solid Sweater' },
      { id: 'cable-knit', label: 'Cable Knit Sweater' },
    ],
  },
  {
    slug: 'cardigan',
    label: 'Cardigan',
    itemTypes: [{ id: 'formal-solid', label: 'Solid Cardigan' }],
  },
  {
    slug: 'hoodie',
    label: 'Hoodie',
    itemTypes: [{ id: 'casual', label: 'Casual Hoodie' }],
  },
  {
    slug: 'knitwear',
    label: 'Knitwear',
    itemTypes: [
      { id: 'formal-solid', label: 'Solid Knitwear' },
      { id: 'cable-knit', label: 'Cable Knit' },
    ],
  },
  {
    slug: 'tie',
    label: 'Tie',
    itemTypes: [
      { id: 'formal-solid', label: 'Solid Silk Tie' },
      { id: 'stripe', label: 'Striped Tie' },
    ],
  },
  {
    slug: 'pocket-square',
    label: 'Pocket Square',
    itemTypes: [
      { id: 'formal-solid', label: 'Solid Pocket Square' },
      { id: 'printed', label: 'Patterned Pocket Square' },
    ],
  },
  {
    slug: 'watch',
    label: 'Watch',
    itemTypes: [
      { id: 'formal-solid', label: 'Dress Watch' },
      { id: 'casual', label: 'Casual Watch' },
    ],
  },
  {
    slug: 'accessory',
    label: 'Other Accessory',
    itemTypes: [
      { id: 'formal-solid', label: 'Solid Accessory' },
      { id: 'casual', label: 'Casual Accessory' },
    ],
  },
];

export const RATING_STYLES: Record<CandidateRating, { label: string; className: string }> = {
  excellent: { label: 'Great Choice', className: 'bg-emerald-600 text-white' },
  good: { label: 'Solid Choice', className: 'bg-amber-600 text-white' },
  risky: { label: 'Might Not Work', className: 'bg-orange-600 text-white' },
  avoid: { label: 'Try Something Else', className: 'bg-rose-600 text-white' },
};
