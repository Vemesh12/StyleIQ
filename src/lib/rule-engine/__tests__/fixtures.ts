// Small hand-built catalog for engine tests — no database needed.
import { buildColorRuleLookup, type ColorInput } from '../color-rules';
import type { RuleLookups, ScoringGarment } from '../core';
import { slotForType } from '../slots';

export const C = {
  white: { name: 'White', hex: '#FFFFFF', slug: 'white', family: 'Neutral', isNeutral: true },
  black: { name: 'Black', hex: '#111111', slug: 'black', family: 'Neutral', isNeutral: true },
  navy: { name: 'Navy Blue', hex: '#1B2A4A', slug: 'navy-blue', family: 'Blue', isNeutral: true },
  charcoal: { name: 'Charcoal Grey', hex: '#333333', slug: 'charcoal-grey', family: 'Neutral', isNeutral: true },
  lightGrey: { name: 'Light Grey', hex: '#C8C8C8', slug: 'light-grey', family: 'Neutral', isNeutral: true },
  silverGrey: { name: 'Silver Grey', hex: '#C0C0C4', slug: 'silver-grey', family: 'Neutral', isNeutral: true },
  darkBrown: { name: 'Dark Brown', hex: '#4B2E1E', slug: 'dark-brown', family: 'Brown', isNeutral: true },
  beige: { name: 'Beige Tan', hex: '#C8AD7F', slug: 'beige-tan', family: 'Neutral', isNeutral: true },
  olive: { name: 'Olive Green', hex: '#556B2F', slug: 'olive-green', family: 'Green', isNeutral: false },
  red: { name: 'Bright Red', hex: '#E02020', slug: 'red', family: 'Red', isNeutral: false },
  green: { name: 'Bright Green', hex: '#20C040', slug: 'kelly-green', family: 'Green', isNeutral: false },
  royalBlue: { name: 'Royal Blue', hex: '#2050E0', slug: 'royal-blue', family: 'Blue', isNeutral: false },
  mustard: { name: 'Mustard', hex: '#C9A227', slug: 'mustard-yellow', family: 'Yellow', isNeutral: false },
  purple: { name: 'Purple', hex: '#7A3E9D', slug: 'purple', family: 'Purple', isNeutral: false },
  skyBlue: { name: 'Sky Blue', hex: '#4A90D9', slug: 'sky-blue', family: 'Blue', isNeutral: false },
} satisfies Record<string, ColorInput>;

let seq = 0;
export function garment(
  typeSlug: string,
  colors: ColorInput[],
  extra: Partial<ScoringGarment> = {}
): ScoringGarment {
  const id = extra.id ?? `${typeSlug}-${++seq}`;
  return {
    id,
    name: extra.name ?? `${colors[0]?.name ?? ''} ${typeSlug}`.trim(),
    slug: id,
    typeSlug,
    slot: slotForType(typeSlug),
    formality: 3,
    colors,
    patterns: ['solid'],
    materials: [],
    fits: [],
    occasionSuitability: {},
    seasonSuitability: {},
    ...extra,
  };
}

export const noRules: RuleLookups = {
  colors: buildColorRuleLookup([]),
  garmentRule: () => undefined,
};

export const occasions = {
  casual: { id: 'occ-casual', name: 'Casual', formalityLevel: 2 },
  businessFormal: { id: 'occ-bf', name: 'Business Formal', formalityLevel: 4 },
};

export const seasons = {
  summer: { id: 'season-summer', slug: 'summer', name: 'Summer' },
  winter: { id: 'season-winter', slug: 'winter', name: 'Winter' },
};

/** A business-formal-ready catalog plus some casual pieces. */
export function sampleCatalog(): ScoringGarment[] {
  return [
    garment('shirt', [C.white], { id: 'white-dress-shirt', name: 'White Dress Shirt', formality: 4 }),
    garment('shirt', [C.skyBlue], { id: 'blue-dress-shirt', name: 'Blue Dress Shirt', formality: 4 }),
    garment('tshirt', [C.white], { id: 'white-tee', name: 'White Tee', formality: 1 }),
    garment('trouser', [C.charcoal], { id: 'charcoal-trousers', name: 'Charcoal Trousers', formality: 4, materials: ['wool'] }),
    garment('trouser', [C.navy], { id: 'navy-chinos', name: 'Navy Chinos', formality: 3 }),
    garment('trouser', [C.navy], { id: 'jeans', name: 'Dark Jeans', formality: 2, materials: ['denim'] }),
    garment('shoe', [C.black], { id: 'black-oxfords', name: 'Black Oxfords', formality: 5, materials: ['leather'] }),
    garment('shoe', [C.darkBrown], { id: 'brown-oxfords', name: 'Brown Oxfords', formality: 4, materials: ['leather'] }),
    garment('shoe', [C.white], { id: 'white-sneakers', name: 'White Sneakers', formality: 2 }),
    garment('jacket', [C.navy], { id: 'navy-blazer', name: 'Navy Blazer', formality: 4, materials: ['wool'] }),
    garment('belt', [C.black], { id: 'black-belt', name: 'Black Leather Belt', formality: 5, materials: ['leather'] }),
    garment('belt', [C.darkBrown], { id: 'brown-belt', name: 'Brown Leather Belt', formality: 4, materials: ['leather'] }),
    garment('tie', [C.navy], { id: 'navy-tie', name: 'Navy Tie', formality: 5 }),
  ];
}
