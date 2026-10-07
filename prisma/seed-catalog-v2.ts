import { PrismaClient } from '@prisma/client';
import { occasionSuitability, seasonSuitability, type SeasonProfile } from '../src/lib/rule-engine/suitability';

const prisma = new PrismaClient();

interface GarmentSpec {
  name: string;
  slug: string;
  typeSlug: string;
  colorSlug: string;
  formality: number; // 1-5
  desc: string;
  fitSlug?: string;
  materialSlug: string;
  patternSlug: string;
  seasonProfile: SeasonProfile;
}

async function main() {
  console.log('Seeding new garment types, attributes, and expanded catalog (v2)...');

  // 1. NEW GARMENT TYPES
  const newTypes = [
    { name: 'T-Shirt', slug: 'tshirt' },
    { name: 'Polo Shirt', slug: 'polo' },
    { name: 'Sweater', slug: 'sweater' },
    { name: 'Cardigan', slug: 'cardigan' },
    { name: 'Hoodie', slug: 'hoodie' },
    { name: 'Tie', slug: 'tie' },
    { name: 'Pocket Square', slug: 'pocket-square' },
  ];
  for (const t of newTypes) {
    await prisma.garmentType.upsert({ where: { slug: t.slug }, update: {}, create: t });
  }

  // Pull in every type id (pre-existing + new) so lookups below don't need
  // special-casing.
  const typeIds: Record<string, string> = {};
  for (const t of await prisma.garmentType.findMany()) typeIds[t.slug] = t.id;

  // 2. EXPANDED FITS / MATERIALS / PATTERNS
  const newFits = [
    { name: 'Athletic Fit', slug: 'athletic-fit' },
    { name: 'Skinny Fit', slug: 'skinny-fit' },
    { name: 'Oversized Fit', slug: 'oversized-fit' },
  ];
  for (const f of newFits) {
    await prisma.fit.upsert({ where: { slug: f.slug }, update: {}, create: f });
  }
  const fitIds: Record<string, string> = {};
  for (const f of await prisma.fit.findMany()) fitIds[f.slug] = f.id;

  const newMaterials = [
    { name: 'Chino Twill', slug: 'chino-twill', breathability: 3, formality: 3 },
    { name: 'Corduroy', slug: 'corduroy', breathability: 2, formality: 2 },
    { name: 'Velvet', slug: 'velvet', breathability: 1, formality: 5 },
    { name: 'Flannel', slug: 'flannel', breathability: 2, formality: 2 },
    { name: 'Seersucker', slug: 'seersucker', breathability: 5, formality: 3 },
    { name: 'Merino Wool', slug: 'merino-wool', breathability: 3, formality: 4 },
    { name: 'Fleece', slug: 'fleece', breathability: 2, formality: 1 },
    { name: 'Jersey Cotton', slug: 'jersey-cotton', breathability: 4, formality: 2 },
    { name: 'Pique Cotton', slug: 'pique-cotton', breathability: 4, formality: 3 },
  ];
  for (const m of newMaterials) {
    await prisma.material.upsert({ where: { slug: m.slug }, update: {}, create: m });
  }
  const materialIds: Record<string, string> = {};
  for (const m of await prisma.material.findMany()) materialIds[m.slug] = m.id;

  const newPatterns = [
    { name: 'Herringbone', slug: 'herringbone', isFormal: true },
    { name: 'Windowpane', slug: 'windowpane', isFormal: true },
    { name: 'Polka Dot', slug: 'polka-dot', isFormal: false },
    { name: 'Floral', slug: 'floral', isFormal: false },
    { name: 'Gingham', slug: 'gingham', isFormal: false },
    { name: 'Houndstooth', slug: 'houndstooth', isFormal: true },
    { name: 'Cable Knit', slug: 'cable-knit', isFormal: false },
  ];
  for (const p of newPatterns) {
    await prisma.pattern.upsert({ where: { slug: p.slug }, update: {}, create: p });
  }
  const patternIds: Record<string, string> = {};
  for (const p of await prisma.pattern.findMany()) patternIds[p.slug] = p.id;

  const occasions = await prisma.occasion.findMany();
  const seasons = await prisma.season.findMany();
  const colors = await prisma.color.findMany();
  const colorBySlug: Record<string, string> = {};
  for (const c of colors) colorBySlug[c.slug] = c.id;

  const resolveColor = (slug: string): string => {
    if (colorBySlug[slug]) return colorBySlug[slug];
    console.warn(`Color slug not found, defaulting to white: ${slug}`);
    return colorBySlug['white'];
  };

  // 3. NEW GARMENT CATALOG — spans the new categories and the full expanded
  // color palette so the picker has real candidates beyond the original ~30.
  const catalog: GarmentSpec[] = [
    // T-SHIRTS
    { name: 'White Crew Neck T-Shirt', slug: 'white-crew-tshirt', typeSlug: 'tshirt', colorSlug: 'white', formality: 1, desc: 'Everyday plain white tee, the ultimate casual layering base.', materialSlug: 'jersey-cotton', patternSlug: 'solid', fitSlug: 'regular-fit', seasonProfile: 'light' },
    { name: 'Charcoal Grey T-Shirt', slug: 'charcoal-grey-tshirt', typeSlug: 'tshirt', colorSlug: 'graphite-grey', formality: 1, desc: 'Versatile dark grey tee that pairs with almost any bottom.', materialSlug: 'jersey-cotton', patternSlug: 'solid', fitSlug: 'regular-fit', seasonProfile: 'light' },
    { name: 'Navy Striped T-Shirt', slug: 'navy-striped-tshirt', typeSlug: 'tshirt', colorSlug: 'navy-blue', formality: 1, desc: 'Breton-striped navy tee for an easy nautical casual look.', materialSlug: 'jersey-cotton', patternSlug: 'striped', fitSlug: 'regular-fit', seasonProfile: 'light' },
    { name: 'Olive Green T-Shirt', slug: 'olive-green-tshirt', typeSlug: 'tshirt', colorSlug: 'olive-green', formality: 1, desc: 'Muted olive tee for a relaxed, earthy casual outfit.', materialSlug: 'jersey-cotton', patternSlug: 'solid', fitSlug: 'regular-fit', seasonProfile: 'light' },
    { name: 'Rust Orange T-Shirt', slug: 'rust-orange-tshirt', typeSlug: 'tshirt', colorSlug: 'rust-brown', formality: 1, desc: 'Warm rust tee that pops against denim and chinos.', materialSlug: 'jersey-cotton', patternSlug: 'solid', fitSlug: 'regular-fit', seasonProfile: 'light' },
    { name: 'Black Graphic-Free T-Shirt', slug: 'black-plain-tshirt', typeSlug: 'tshirt', colorSlug: 'black', formality: 1, desc: 'Plain black tee, the most versatile casual top there is.', materialSlug: 'jersey-cotton', patternSlug: 'solid', fitSlug: 'regular-fit', seasonProfile: 'light' },
    { name: 'Sky Blue T-Shirt', slug: 'sky-blue-tshirt', typeSlug: 'tshirt', colorSlug: 'sky-blue', formality: 1, desc: 'Light sky blue tee for warm-weather casual wear.', materialSlug: 'jersey-cotton', patternSlug: 'solid', fitSlug: 'regular-fit', seasonProfile: 'light' },
    { name: 'Mustard Yellow T-Shirt', slug: 'mustard-tshirt', typeSlug: 'tshirt', colorSlug: 'mustard-yellow', formality: 1, desc: 'Statement mustard tee for a confident casual look.', materialSlug: 'jersey-cotton', patternSlug: 'solid', fitSlug: 'regular-fit', seasonProfile: 'light' },

    // POLOS
    { name: 'Navy Pique Polo', slug: 'navy-pique-polo', typeSlug: 'polo', colorSlug: 'navy-blue', formality: 3, desc: 'Classic navy pique polo for smart-casual and golf-course looks.', materialSlug: 'pique-cotton', patternSlug: 'solid', fitSlug: 'regular-fit', seasonProfile: 'light' },
    { name: 'White Pique Polo', slug: 'white-pique-polo', typeSlug: 'polo', colorSlug: 'white', formality: 3, desc: 'Crisp white polo that dresses up jeans or chinos instantly.', materialSlug: 'pique-cotton', patternSlug: 'solid', fitSlug: 'regular-fit', seasonProfile: 'light' },
    { name: 'Forest Green Polo', slug: 'forest-green-polo', typeSlug: 'polo', colorSlug: 'forest-green', formality: 3, desc: 'Rich forest green polo for a preppy smart-casual outfit.', materialSlug: 'pique-cotton', patternSlug: 'solid', fitSlug: 'regular-fit', seasonProfile: 'light' },
    { name: 'Burgundy Polo', slug: 'burgundy-polo', typeSlug: 'polo', colorSlug: 'burgundy', formality: 3, desc: 'Deep burgundy polo for cooler-weather smart-casual days.', materialSlug: 'pique-cotton', patternSlug: 'solid', fitSlug: 'regular-fit', seasonProfile: 'all' },
    { name: 'Camel Polo', slug: 'camel-polo', typeSlug: 'polo', colorSlug: 'camel', formality: 3, desc: 'Warm camel polo, an easy neutral for chinos and loafers.', materialSlug: 'pique-cotton', patternSlug: 'solid', fitSlug: 'regular-fit', seasonProfile: 'all' },
    { name: 'Steel Blue Striped Polo', slug: 'steel-blue-striped-polo', typeSlug: 'polo', colorSlug: 'steel-blue', formality: 2, desc: 'Striped steel blue polo for relaxed weekend styling.', materialSlug: 'pique-cotton', patternSlug: 'striped', fitSlug: 'regular-fit', seasonProfile: 'light' },

    // SWEATERS
    { name: 'Charcoal Merino Crew Sweater', slug: 'charcoal-merino-sweater', typeSlug: 'sweater', colorSlug: 'graphite-grey', formality: 3, desc: 'Fine merino crew-neck sweater for layered office looks.', materialSlug: 'merino-wool', patternSlug: 'solid', fitSlug: 'regular-fit', seasonProfile: 'heavy' },
    { name: 'Navy V-Neck Sweater', slug: 'navy-vneck-sweater', typeSlug: 'sweater', colorSlug: 'navy-blue', formality: 3, desc: 'Classic navy V-neck to layer over a shirt and tie.', materialSlug: 'merino-wool', patternSlug: 'solid', fitSlug: 'regular-fit', seasonProfile: 'heavy' },
    { name: 'Camel Cable Knit Sweater', slug: 'camel-cable-sweater', typeSlug: 'sweater', colorSlug: 'camel', formality: 2, desc: 'Chunky camel cable-knit sweater for cold-weather casual wear.', materialSlug: 'cashmere', patternSlug: 'cable-knit', fitSlug: 'relaxed-fit', seasonProfile: 'heavy' },
    { name: 'Burgundy Wool Sweater', slug: 'burgundy-wool-sweater', typeSlug: 'sweater', colorSlug: 'burgundy', formality: 3, desc: 'Rich burgundy sweater that layers well under a blazer.', materialSlug: 'wool', patternSlug: 'solid', fitSlug: 'regular-fit', seasonProfile: 'heavy' },
    { name: 'Forest Green Turtleneck', slug: 'forest-green-turtleneck', typeSlug: 'sweater', colorSlug: 'forest-green', formality: 3, desc: 'Fine-knit turtleneck for smart layering under a jacket.', materialSlug: 'merino-wool', patternSlug: 'solid', fitSlug: 'tailored-fit', seasonProfile: 'heavy' },

    // CARDIGANS
    { name: 'Oatmeal Shawl Collar Cardigan', slug: 'oatmeal-shawl-cardigan', typeSlug: 'cardigan', colorSlug: 'oatmeal', formality: 2, desc: 'Cozy shawl-collar cardigan for relaxed layering.', materialSlug: 'wool', patternSlug: 'solid', fitSlug: 'relaxed-fit', seasonProfile: 'heavy' },
    { name: 'Navy Button-Front Cardigan', slug: 'navy-button-cardigan', typeSlug: 'cardigan', colorSlug: 'navy-blue', formality: 3, desc: 'Smart navy cardigan that layers neatly over a dress shirt.', materialSlug: 'merino-wool', patternSlug: 'solid', fitSlug: 'regular-fit', seasonProfile: 'heavy' },
    { name: 'Charcoal Ribbed Cardigan', slug: 'charcoal-ribbed-cardigan', typeSlug: 'cardigan', colorSlug: 'graphite-grey', formality: 2, desc: 'Ribbed charcoal cardigan for smart-casual layering.', materialSlug: 'wool', patternSlug: 'solid', fitSlug: 'regular-fit', seasonProfile: 'heavy' },

    // HOODIES
    { name: 'Heather Grey Pullover Hoodie', slug: 'heather-grey-hoodie', typeSlug: 'hoodie', colorSlug: 'ash-grey', formality: 1, desc: 'Everyday grey hoodie for casual and athleisure looks.', materialSlug: 'fleece', patternSlug: 'solid', fitSlug: 'relaxed-fit', seasonProfile: 'heavy' },
    { name: 'Black Zip-Up Hoodie', slug: 'black-zip-hoodie', typeSlug: 'hoodie', colorSlug: 'black', formality: 1, desc: 'Versatile black zip hoodie, easy to layer over a tee.', materialSlug: 'fleece', patternSlug: 'solid', fitSlug: 'regular-fit', seasonProfile: 'heavy' },
    { name: 'Navy Pullover Hoodie', slug: 'navy-pullover-hoodie', typeSlug: 'hoodie', colorSlug: 'navy-blue', formality: 1, desc: 'Classic navy hoodie for cool-weather casual wear.', materialSlug: 'fleece', patternSlug: 'solid', fitSlug: 'relaxed-fit', seasonProfile: 'heavy' },

    // TIES
    { name: 'Navy Silk Tie', slug: 'navy-silk-tie', typeSlug: 'tie', colorSlug: 'navy-blue', formality: 5, desc: 'Classic navy silk tie for business and formal occasions.', materialSlug: 'silk', patternSlug: 'solid', seasonProfile: 'all' },
    { name: 'Burgundy Silk Tie', slug: 'burgundy-tie', typeSlug: 'tie', colorSlug: 'burgundy', formality: 5, desc: 'Rich burgundy tie for weddings and formal events.', materialSlug: 'silk', patternSlug: 'solid', seasonProfile: 'all' },
    { name: 'Charcoal Striped Tie', slug: 'charcoal-striped-tie', typeSlug: 'tie', colorSlug: 'graphite-grey', formality: 4, desc: 'Subtle striped charcoal tie for business formal wear.', materialSlug: 'silk', patternSlug: 'striped', seasonProfile: 'all' },
    { name: 'Forest Green Knit Tie', slug: 'forest-green-knit-tie', typeSlug: 'tie', colorSlug: 'forest-green', formality: 3, desc: 'Textured knit tie for smart-casual blazer looks.', materialSlug: 'wool', patternSlug: 'solid', seasonProfile: 'all' },

    // POCKET SQUARES
    { name: 'White Linen Pocket Square', slug: 'white-linen-pocket-square-v2', typeSlug: 'pocket-square', colorSlug: 'white', formality: 5, desc: 'Simple white pocket square for suits and formal events.', materialSlug: 'linen', patternSlug: 'solid', seasonProfile: 'all' },
    { name: 'Burgundy Paisley Pocket Square', slug: 'burgundy-paisley-pocket-square', typeSlug: 'pocket-square', colorSlug: 'burgundy', formality: 5, desc: 'Patterned burgundy pocket square for formal events.', materialSlug: 'silk', patternSlug: 'floral', seasonProfile: 'all' },
    { name: 'Navy Polka Dot Pocket Square', slug: 'navy-polka-pocket-square', typeSlug: 'pocket-square', colorSlug: 'navy-blue', formality: 4, desc: 'Polka dot navy pocket square for business formal looks.', materialSlug: 'silk', patternSlug: 'polka-dot', seasonProfile: 'all' },

    // A few extra shirts/trousers/shoes in new color territory, so the picker
    // has genuinely new candidates outside the original ~30-color catalog.
    { name: 'Sage Green Casual Shirt', slug: 'sage-green-casual-shirt', typeSlug: 'shirt', colorSlug: 'sage-green', formality: 2, desc: 'Soft sage green shirt for relaxed smart-casual wear.', materialSlug: 'cotton', patternSlug: 'solid', fitSlug: 'regular-fit', seasonProfile: 'light' },
    { name: 'Terracotta Linen Shirt', slug: 'terracotta-linen-shirt', typeSlug: 'shirt', colorSlug: 'terracotta', formality: 2, desc: 'Warm terracotta linen shirt for summer occasions.', materialSlug: 'linen', patternSlug: 'solid', fitSlug: 'regular-fit', seasonProfile: 'light' },
    { name: 'Steel Blue Dress Shirt', slug: 'steel-blue-dress-shirt', typeSlug: 'shirt', colorSlug: 'steel-blue', formality: 4, desc: 'Sharp steel blue dress shirt for business formal wear.', materialSlug: 'cotton', patternSlug: 'solid', fitSlug: 'tailored-fit', seasonProfile: 'all' },
    { name: 'Windowpane Check Shirt', slug: 'windowpane-check-shirt', typeSlug: 'shirt', colorSlug: 'graphite-grey', formality: 3, desc: 'Subtle windowpane check shirt for smart-casual business wear.', materialSlug: 'cotton', patternSlug: 'windowpane', fitSlug: 'tailored-fit', seasonProfile: 'all' },
    { name: 'Sand Chino Trousers', slug: 'sand-chino-trousers', typeSlug: 'trouser', colorSlug: 'sand-beige', formality: 3, desc: 'Versatile sand chinos that pair with almost any shirt color.', materialSlug: 'chino-twill', patternSlug: 'solid', fitSlug: 'tailored-fit', seasonProfile: 'light' },
    { name: 'Forest Green Corduroy Trousers', slug: 'forest-green-corduroy-trousers', typeSlug: 'trouser', colorSlug: 'forest-green', formality: 2, desc: 'Textured corduroy trousers for cool-weather smart-casual wear.', materialSlug: 'corduroy', patternSlug: 'solid', fitSlug: 'regular-fit', seasonProfile: 'heavy' },
    { name: 'Rust Suede Loafers', slug: 'rust-suede-loafers', typeSlug: 'shoe', colorSlug: 'rust-brown', formality: 3, desc: 'Rust suede loafers for smart-casual autumn styling.', materialSlug: 'suede', patternSlug: 'solid', seasonProfile: 'heavy' },
    { name: 'Navy Suede Chelsea Boots', slug: 'navy-suede-chelsea-boots', typeSlug: 'shoe', colorSlug: 'navy-blue', formality: 3, desc: 'Unexpected navy suede boots for a modern smart-casual edge.', materialSlug: 'suede', patternSlug: 'solid', seasonProfile: 'heavy' },

    // FORMALITY-GAP FILLS — the trouser catalog previously had black only at
    // formality 4-5 (plus shorts), so a casual black bottom (e.g. paired with
    // a casual check shirt) had no real candidate to recommend at all.
    { name: 'Black Slim Jeans', slug: 'black-slim-jeans', typeSlug: 'trouser', colorSlug: 'black', formality: 2, desc: 'Everyday black jeans that pair with almost any casual top.', materialSlug: 'denim', patternSlug: 'solid', fitSlug: 'slim-fit', seasonProfile: 'all' },
    { name: 'Black Chino Trousers', slug: 'black-chino-trousers', typeSlug: 'trouser', colorSlug: 'black', formality: 3, desc: 'Versatile black chinos for smart-casual looks.', materialSlug: 'chino-twill', patternSlug: 'solid', fitSlug: 'tailored-fit', seasonProfile: 'all' },
    { name: 'White Casual Chinos', slug: 'white-casual-chinos', typeSlug: 'trouser', colorSlug: 'white', formality: 2, desc: 'Crisp white chinos for warm-weather casual wear.', materialSlug: 'chino-twill', patternSlug: 'solid', fitSlug: 'regular-fit', seasonProfile: 'light' },
  ];

  const garmentIds: Record<string, string> = {};

  for (const g of catalog) {
    const typeId = typeIds[g.typeSlug];
    const colorId = resolveColor(g.colorSlug);
    if (!typeId) {
      console.warn(`Skipping ${g.name}: unknown type ${g.typeSlug}`);
      continue;
    }

    const garment = await prisma.garment.upsert({
      where: { slug: g.slug },
      update: {
        name: g.name,
        description: g.desc,
        formalityLevel: g.formality,
      },
      create: {
        name: g.name,
        slug: g.slug,
        garmentTypeId: typeId,
        description: g.desc,
        formalityLevel: g.formality,
        colors: { create: [{ colorId, isPrimary: true }] },
      },
    });
    garmentIds[g.slug] = garment.id;

    if (g.fitSlug && fitIds[g.fitSlug]) {
      await prisma.garmentFit.upsert({
        where: { garmentId_fitId: { garmentId: garment.id, fitId: fitIds[g.fitSlug] } },
        update: {},
        create: { garmentId: garment.id, fitId: fitIds[g.fitSlug], isPrimary: true },
      });
    }

    if (materialIds[g.materialSlug]) {
      await prisma.garmentMaterial.upsert({
        where: { garmentId_materialId: { garmentId: garment.id, materialId: materialIds[g.materialSlug] } },
        update: {},
        create: { garmentId: garment.id, materialId: materialIds[g.materialSlug], percentage: 100 },
      });
    }

    if (patternIds[g.patternSlug]) {
      await prisma.garmentPattern.upsert({
        where: { garmentId_patternId: { garmentId: garment.id, patternId: patternIds[g.patternSlug] } },
        update: {},
        create: { garmentId: garment.id, patternId: patternIds[g.patternSlug], isPrimary: true },
      });
    }

    for (const occ of occasions) {
      await prisma.garmentOccasion.upsert({
        where: { garmentId_occasionId: { garmentId: garment.id, occasionId: occ.id } },
        update: { suitability: occasionSuitability(g.formality, occ.formalityLevel) },
        create: { garmentId: garment.id, occasionId: occ.id, suitability: occasionSuitability(g.formality, occ.formalityLevel) },
      });
    }

    for (const season of seasons) {
      await prisma.garmentSeason.upsert({
        where: { garmentId_seasonId: { garmentId: garment.id, seasonId: season.id } },
        update: { suitability: seasonSuitability(g.seasonProfile, season.slug) },
        create: { garmentId: garment.id, seasonId: season.id, suitability: seasonSuitability(g.seasonProfile, season.slug) },
      });
    }
  }

  console.log(`Seeded ${Object.keys(garmentIds).length} new catalog garments with real fit/material/pattern/occasion/season data.`);

  // 4. RETROFIT — the original seed.ts garments never got Fit/Material/Pattern
  // rows, and their Occasion/Season suitability was flat (same value for
  // every occasion/season). Backfill both from the garment's name/type so the
  // scoring engine (pattern-clash, personalization, formality/season gating)
  // has real signal for the whole catalog, not just the new items.
  const existingGarments = await prisma.garment.findMany({
    where: { slug: { notIn: Object.keys(garmentIds) } },
    include: { garmentType: true, patterns: true, materials: true, fits: true },
  });

  const guessMaterial = (name: string, typeSlug: string): string => {
    const n = name.toLowerCase();
    if (n.includes('linen')) return 'linen';
    if (n.includes('leather')) return 'leather';
    if (n.includes('suede')) return 'suede';
    if (n.includes('denim') || n.includes('jeans')) return 'denim';
    if (n.includes('silk')) return 'silk';
    if (n.includes('cashmere')) return 'cashmere';
    if (n.includes('flannel')) return 'flannel';
    if (n.includes('corduroy')) return 'corduroy';
    if (n.includes('velvet')) return 'velvet';
    if (n.includes('seersucker')) return 'seersucker';
    if (n.includes('wool') || typeSlug === 'knitwear') return 'wool';
    if (typeSlug === 'trouser') return 'chino-twill';
    return 'cotton';
  };

  const guessPattern = (name: string): string => {
    const n = name.toLowerCase();
    if (n.includes('stripe')) return 'striped';
    if (n.includes('check') || n.includes('plaid')) return 'check';
    return 'solid';
  };

  const guessSeasonProfile = (name: string, typeSlug: string): SeasonProfile => {
    const n = name.toLowerCase();
    if (n.includes('linen') || n.includes('sneaker') || typeSlug === 'tshirt') return 'light';
    if (n.includes('wool') || n.includes('sweater') || n.includes('coat') || n.includes('boot') || typeSlug === 'knitwear' || typeSlug === 'jacket') return 'heavy';
    return 'all';
  };

  let retrofitted = 0;
  for (const g of existingGarments) {
    if (g.materials.length === 0) {
      const materialSlug = guessMaterial(g.name, g.garmentType.slug);
      if (materialIds[materialSlug]) {
        await prisma.garmentMaterial.upsert({
          where: { garmentId_materialId: { garmentId: g.id, materialId: materialIds[materialSlug] } },
          update: {},
          create: { garmentId: g.id, materialId: materialIds[materialSlug], percentage: 100 },
        });
      }
    }

    if (g.patterns.length === 0) {
      const patternSlug = guessPattern(g.name);
      if (patternIds[patternSlug]) {
        await prisma.garmentPattern.upsert({
          where: { garmentId_patternId: { garmentId: g.id, patternId: patternIds[patternSlug] } },
          update: {},
          create: { garmentId: g.id, patternId: patternIds[patternSlug], isPrimary: true },
        });
      }
    }

    if (g.fits.length === 0 && fitIds['regular-fit']) {
      await prisma.garmentFit.upsert({
        where: { garmentId_fitId: { garmentId: g.id, fitId: fitIds['regular-fit'] } },
        update: {},
        create: { garmentId: g.id, fitId: fitIds['regular-fit'], isPrimary: true },
      });
    }

    const profile = guessSeasonProfile(g.name, g.garmentType.slug);
    for (const occ of occasions) {
      await prisma.garmentOccasion.upsert({
        where: { garmentId_occasionId: { garmentId: g.id, occasionId: occ.id } },
        update: { suitability: occasionSuitability(g.formalityLevel, occ.formalityLevel) },
        create: { garmentId: g.id, occasionId: occ.id, suitability: occasionSuitability(g.formalityLevel, occ.formalityLevel) },
      });
    }
    for (const season of seasons) {
      await prisma.garmentSeason.upsert({
        where: { garmentId_seasonId: { garmentId: g.id, seasonId: season.id } },
        update: { suitability: seasonSuitability(profile, season.slug) },
        create: { garmentId: g.id, seasonId: season.id, suitability: seasonSuitability(profile, season.slug) },
      });
    }
    retrofitted++;
  }

  console.log(`Retrofitted fit/material/pattern/occasion/season data onto ${retrofitted} pre-existing garments.`);

  // 5. RECLASSIFY — a couple of items from the original seed are polos in
  // substance but were filed under the generic 'shirt' type before the
  // dedicated 'polo' type existed. Move them so they show up correctly.
  const reclassifications = [
    { slug: 'navy-polo-shirt', newTypeSlug: 'polo' },
    { slug: 'camel-knit-polo', newTypeSlug: 'polo' },
    { slug: 'burgundy-silk-tie', newTypeSlug: 'tie' },
    { slug: 'navy-knit-tie', newTypeSlug: 'tie' },
    { slug: 'white-linen-pocket-square', newTypeSlug: 'pocket-square' },
  ];
  let reclassified = 0;
  for (const r of reclassifications) {
    const newTypeId = typeIds[r.newTypeSlug];
    if (!newTypeId) continue;
    const result = await prisma.garment.updateMany({
      where: { slug: r.slug },
      data: { garmentTypeId: newTypeId },
    });
    reclassified += result.count;
  }
  console.log(`Reclassified ${reclassified} legacy polo garments into the 'polo' type.`);

  console.log('Catalog v2 seed complete.');
}

main()
  .catch((e) => {
    console.error('Error seeding catalog v2:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
