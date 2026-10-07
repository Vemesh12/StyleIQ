import { PrismaClient, Prisma } from '@prisma/client';

const prisma = new PrismaClient();

// Same HSL->Hex conversion used by the color-wheel UI and the color-harmony
// engine, so every seeded color is guaranteed to round-trip correctly through
// hexToHSL() in src/lib/rule-engine/color-rules.ts.
function hslToHex(h: number, s: number, l: number): string {
  const lNorm = l / 100;
  const a = (s * Math.min(lNorm, 1 - lNorm)) / 100;
  const f = (n: number) => {
    const k = (n + h / 30) % 12;
    const color = lNorm - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
    return Math.round(255 * color)
      .toString(16)
      .padStart(2, '0');
  };
  return `#${f(0)}${f(8)}${f(4)}`.toUpperCase();
}

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

type ColorSeed = [name: string, h: number, s: number, l: number];

// Neutrals & greys — desaturated, pair with everything.
const NEUTRALS: ColorSeed[] = [
  ['Snow White', 0, 0, 99],
  ['Pearl White', 40, 20, 96],
  ['Alabaster', 45, 25, 94],
  ['Vanilla Cream', 45, 40, 90],
  ['Antique Ivory', 45, 35, 87],
  ['Oatmeal', 40, 20, 82],
  ['Champagne Beige', 40, 30, 80],
  ['Greige', 35, 12, 72],
  ['Stone Grey', 30, 8, 65],
  ['Dove Grey', 0, 0, 75],
  ['Silver Grey', 0, 0, 68],
  ['Fog Grey', 210, 5, 70],
  ['Ash Grey', 210, 6, 58],
  ['Steel Grey', 210, 8, 48],
  ['Gunmetal Grey', 210, 10, 32],
  ['Graphite Grey', 220, 6, 24],
  ['Anthracite', 220, 8, 18],
  ['Jet Black', 0, 0, 6],
  ['Onyx Black', 220, 10, 8],
  ['Warm Taupe', 30, 18, 55],
  ['Cool Taupe', 250, 8, 55],
  ['Mushroom Grey', 30, 10, 60],
];

// Blues — sky through navy through teal.
const BLUES: ColorSeed[] = [
  ['Ice Blue', 200, 60, 92],
  ['Powder Blue', 200, 55, 85],
  ['Baby Blue', 205, 65, 82],
  ['Pale Sky Blue', 198, 60, 78],
  ['Sky Blue', 199, 70, 68],
  ['Cornflower Blue', 218, 70, 68],
  ['Light Denim Blue', 210, 45, 60],
  ['Denim Blue', 212, 40, 48],
  ['Slate Blue', 231, 30, 52],
  ['Periwinkle Blue', 231, 60, 72],
  ['French Blue', 210, 55, 45],
  ['Steel Blue', 207, 44, 42],
  ['Cobalt Blue', 217, 75, 45],
  ['Royal Blue', 225, 73, 48],
  ['Sapphire Blue', 220, 70, 38],
  ['Azure Blue', 205, 80, 45],
  ['Cerulean Blue', 195, 75, 45],
  ['Teal Blue', 190, 80, 32],
  ['Petrol Blue', 195, 55, 25],
  ['Deep Teal', 185, 65, 22],
  ['Turquoise', 174, 65, 48],
  ['Cyan Blue', 185, 70, 50],
  ['Marine Blue', 210, 50, 30],
  ['Admiral Blue', 213, 55, 24],
  ['Navy Blue', 220, 45, 20],
  ['Midnight Blue', 224, 45, 14],
  ['Indigo Blue', 245, 45, 30],
  ['Ink Blue', 230, 40, 12],
  ['Bluebell', 220, 40, 70],
  ['Ocean Blue', 200, 60, 35],
];

// Greens — mint through olive through forest.
const GREENS: ColorSeed[] = [
  ['Mint Green', 150, 60, 85],
  ['Seafoam Green', 160, 50, 78],
  ['Pistachio Green', 95, 40, 75],
  ['Pale Sage', 100, 20, 72],
  ['Sage Green', 100, 18, 60],
  ['Eucalyptus Green', 150, 22, 55],
  ['Light Olive', 70, 30, 55],
  ['Olive Green', 70, 35, 38],
  ['Army Green', 75, 30, 30],
  ['Moss Green', 85, 30, 32],
  ['Fern Green', 110, 30, 35],
  ['Kelly Green', 130, 55, 42],
  ['Grass Green', 100, 50, 40],
  ['Emerald Green', 150, 60, 38],
  ['Jade Green', 155, 45, 42],
  ['Bottle Green', 155, 55, 22],
  ['Hunter Green', 140, 45, 22],
  ['Forest Green', 130, 45, 25],
  ['Pine Green', 165, 40, 22],
  ['Racing Green', 145, 55, 16],
  ['Deep Racing Green', 150, 60, 12],
  ['Loden Green', 80, 28, 30],
  ['Khaki Green', 65, 25, 45],
  ['Basil Green', 105, 35, 30],
  ['Chartreuse Green', 75, 60, 55],
  ['Lime Green', 90, 60, 55],
  ['Avocado Green', 75, 35, 35],
  ['Spruce Green', 170, 35, 22],
];

// Earth tones & browns — sand through chocolate.
const EARTH_BROWNS: ColorSeed[] = [
  ['Sand Beige', 40, 45, 82],
  ['Desert Sand', 35, 40, 75],
  ['Wheat', 42, 45, 72],
  ['Buff Tan', 38, 40, 68],
  ['Camel', 35, 40, 58],
  ['Fawn Brown', 30, 35, 55],
  ['Tan', 30, 42, 62],
  ['Khaki Tan', 45, 35, 65],
  ['Toffee Brown', 28, 40, 45],
  ['Caramel Brown', 30, 45, 42],
  ['Cognac Brown', 20, 50, 38],
  ['Chestnut Brown', 18, 42, 34],
  ['Rust Brown', 15, 55, 40],
  ['Terracotta', 12, 50, 48],
  ['Sienna', 16, 55, 38],
  ['Burnt Sienna', 14, 55, 34],
  ['Umber Brown', 25, 35, 28],
  ['Mahogany', 8, 45, 26],
  ['Coffee Brown', 25, 35, 22],
  ['Espresso Brown', 20, 30, 16],
  ['Chocolate Brown', 20, 40, 18],
  ['Dark Walnut', 22, 32, 20],
  ['Cinnamon Brown', 18, 50, 36],
  ['Copper Brown', 20, 55, 45],
  ['Bronze Brown', 32, 45, 35],
  ['Taupe Brown', 25, 20, 48],
  ['Mocha Brown', 25, 25, 32],
  ['Hazelnut Brown', 28, 35, 40],
];

// Reds & pinks — blush through burgundy.
const REDS_PINKS: ColorSeed[] = [
  ['Blush Pink', 350, 55, 88],
  ['Baby Pink', 345, 65, 85],
  ['Dusty Rose', 350, 35, 70],
  ['Rose Pink', 345, 55, 68],
  ['Salmon Pink', 8, 70, 72],
  ['Coral Pink', 5, 75, 68],
  ['Watermelon Pink', 350, 65, 60],
  ['Hot Pink', 330, 75, 62],
  ['Fuchsia Pink', 320, 70, 52],
  ['Magenta', 310, 65, 45],
  ['Raspberry Red', 345, 65, 42],
  ['Cerise Red', 340, 65, 45],
  ['Cherry Red', 355, 70, 45],
  ['Fire Engine Red', 0, 80, 48],
  ['Scarlet Red', 5, 78, 45],
  ['Crimson Red', 350, 75, 40],
  ['Brick Red', 8, 55, 38],
  ['Rust Red', 10, 55, 42],
  ['Tomato Red', 6, 70, 55],
  ['Wine Red', 350, 55, 28],
  ['Burgundy', 345, 55, 25],
  ['Maroon', 350, 45, 22],
  ['Oxblood Red', 355, 45, 20],
  ['Mauve Pink', 330, 25, 62],
  ['Mauve Purple Pink', 320, 30, 55],
  ['Berry Red', 335, 55, 35],
];

// Oranges & yellows — peach through mustard through gold.
const ORANGES_YELLOWS: ColorSeed[] = [
  ['Peach', 25, 80, 82],
  ['Apricot', 30, 80, 72],
  ['Melon Orange', 20, 75, 70],
  ['Tangerine Orange', 25, 80, 58],
  ['Burnt Orange', 20, 65, 48],
  ['Pumpkin Orange', 22, 75, 52],
  ['Amber Orange', 35, 80, 52],
  ['Marigold Orange', 38, 85, 55],
  ['Saffron Orange', 35, 80, 50],
  ['Ochre Yellow', 40, 60, 45],
  ['Mustard Yellow', 45, 75, 52],
  ['Golden Yellow', 45, 80, 55],
  ['Goldenrod Yellow', 42, 75, 50],
  ['Honey Yellow', 40, 70, 55],
  ['Butter Yellow', 48, 70, 78],
  ['Lemon Yellow', 55, 80, 62],
  ['Canary Yellow', 52, 85, 62],
  ['Sunflower Yellow', 48, 85, 55],
  ['Pale Yellow', 50, 60, 82],
  ['Cream Yellow', 48, 55, 85],
];

// Purples — lavender through eggplant.
const PURPLES: ColorSeed[] = [
  ['Lavender', 260, 45, 85],
  ['Lilac', 275, 40, 78],
  ['Pale Violet', 265, 45, 80],
  ['Periwinkle Purple', 245, 50, 75],
  ['Wisteria Purple', 270, 35, 65],
  ['Orchid Purple', 300, 40, 62],
  ['Violet', 270, 50, 55],
  ['Amethyst Purple', 275, 45, 48],
  ['Iris Purple', 255, 45, 48],
  ['Royal Purple', 265, 55, 38],
  ['Plum Purple', 300, 40, 32],
  ['Grape Purple', 285, 45, 32],
  ['Byzantium Purple', 305, 50, 28],
  ['Eggplant Purple', 285, 40, 22],
  ['Aubergine Purple', 290, 45, 18],
  ['Deep Purple', 270, 55, 24],
  ['Mulberry Purple', 320, 40, 30],
];

// Pastels & soft accents — used mostly for summer/casual pieces.
const PASTELS: ColorSeed[] = [
  ['Pastel Mint', 155, 45, 85],
  ['Pastel Blue', 205, 50, 86],
  ['Pastel Lavender', 260, 40, 88],
  ['Pastel Yellow', 52, 55, 85],
  ['Pastel Peach', 25, 65, 86],
  ['Pastel Green', 100, 35, 82],
  ['Pastel Pink', 340, 50, 88],
  ['Powder Pink', 345, 40, 84],
  ['Seashell Pink', 15, 45, 90],
  ['Vanilla Pastel', 45, 45, 88],
  ['Pearl Champagne', 42, 30, 88],
  ['Soft Ecru', 42, 30, 90],
];

// Metallics — treated as neutral for accessory/watch matching.
const METALLICS: ColorSeed[] = [
  ['Gold Metallic', 45, 60, 55],
  ['Rose Gold Metallic', 15, 55, 68],
  ['Silver Metallic', 210, 8, 75],
  ['Platinum Metallic', 210, 5, 80],
  ['Gunmetal Metallic', 215, 12, 35],
  ['Bronze Metallic', 30, 50, 42],
  ['Antique Brass Metallic', 38, 45, 48],
  ['Pewter Metallic', 220, 8, 55],
  ['Copper Metallic', 20, 55, 48],
  ['Champagne Gold Metallic', 42, 40, 68],
];

const FAMILIES: { family: string; isNeutral: boolean; colors: ColorSeed[] }[] = [
  { family: 'Neutral', isNeutral: true, colors: NEUTRALS },
  { family: 'Blue', isNeutral: false, colors: BLUES },
  { family: 'Green', isNeutral: false, colors: GREENS },
  { family: 'Brown', isNeutral: false, colors: EARTH_BROWNS },
  { family: 'Red', isNeutral: false, colors: REDS_PINKS },
  { family: 'Orange', isNeutral: false, colors: ORANGES_YELLOWS },
  { family: 'Purple', isNeutral: false, colors: PURPLES },
  { family: 'Pastel', isNeutral: false, colors: PASTELS },
  { family: 'Metallic', isNeutral: true, colors: METALLICS },
];

async function seedColors() {
  console.log('Seeding expanded world color palette...');

  const data: Prisma.ColorCreateManyInput[] = [];
  const seenSlugs = new Set<string>();

  for (const { family, isNeutral, colors } of FAMILIES) {
    for (const [name, h, s, l] of colors) {
      const slug = slugify(name);
      if (seenSlugs.has(slug)) continue; // guard against duplicate names within this file
      seenSlugs.add(slug);
      data.push({
        name,
        hex: hslToHex(h, s, l),
        slug,
        family,
        isNeutral,
      });
    }
  }

  console.log(`Prepared ${data.length} candidate colors.`);

  // skipDuplicates leaves the original ~30 hand-curated colors (and their
  // existing garment associations) completely untouched by slug collision.
  const result = await prisma.color.createMany({
    data,
    skipDuplicates: true,
  });

  const total = await prisma.color.count();
  console.log(`Inserted ${result.count} new colors. Total colors in DB: ${total}.`);
}

seedColors()
  .catch((e) => {
    console.error('Error seeding colors:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
