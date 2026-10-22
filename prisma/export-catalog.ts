// Exports the reference data from a database into the files the seed loads:
//
//   prisma/data/catalog.json          garment types, colors, attributes,
//                                     occasions/seasons, garments, curated
//                                     rules, guides, style rules
//   prisma/data/personalization.json  personalization advice (compact form)
//
//   npm run db:export
//
// Use it after curating data in the admin panel, then commit the JSON so a
// fresh clone (`npm run db:setup`) reproduces the same catalog. Output is
// sorted and contains no ids or timestamps, so diffs show real changes only.
import { PrismaClient } from '@prisma/client';
import fs from 'fs';
import path from 'path';

const prisma = new PrismaClient();
// EXPORT_DIR lets you export somewhere else, e.g. to diff two databases.
const DATA_DIR = process.env.EXPORT_DIR ? path.resolve(process.env.EXPORT_DIR) : path.join(__dirname, 'data');

const bySlug = <T extends { slug: string }>(a: T, b: T) => a.slug.localeCompare(b.slug);
const pair = (a: string, b: string): [string, string] => (a < b ? [a, b] : [b, a]);

async function exportCatalog() {
  const [garmentTypes, colors, fits, materials, patterns, occasions, seasons, bodyTypes, skinTones] = await Promise.all([
    prisma.garmentType.findMany(),
    prisma.color.findMany(),
    prisma.fit.findMany(),
    prisma.material.findMany(),
    prisma.pattern.findMany(),
    prisma.occasion.findMany(),
    prisma.season.findMany(),
    prisma.bodyType.findMany(),
    prisma.skinTone.findMany(),
  ]);

  // Users' own items (ownerId set) are personal data, never catalog content.
  const garments = await prisma.garment.findMany({
    where: { ownerId: null },
    include: {
      garmentType: true,
      colors: { include: { color: true } },
      fits: { include: { fit: true } },
      materials: { include: { material: true } },
      patterns: { include: { pattern: true } },
      occasions: { include: { occasion: true } },
      seasons: { include: { season: true } },
    },
  });

  const primaryFirst = <T extends { isPrimary: boolean }>(rows: T[], key: (r: T) => string) =>
    [...rows].sort((a, b) => Number(b.isPrimary) - Number(a.isPrimary) || key(a).localeCompare(key(b)));

  const compat = await prisma.compatibilityRule.findMany({ include: { garmentA: true, garmentB: true } });
  const colorRules = await prisma.colorCompatibilityRule.findMany({ include: { colorA: true, colorB: true } });
  const guides = await prisma.guide.findMany();
  const styleRules = await prisma.styleRule.findMany();

  const catalog = {
    garmentTypes: garmentTypes.map(({ name, slug }) => ({ name, slug })).sort(bySlug),
    colors: colors.map(({ name, slug, hex, family, isNeutral }) => ({ name, slug, hex, family, isNeutral })).sort(bySlug),
    fits: fits.map(({ name, slug }) => ({ name, slug })).sort(bySlug),
    materials: materials.map(({ name, slug, breathability, formality }) => ({ name, slug, breathability, formality })).sort(bySlug),
    patterns: patterns.map(({ name, slug, isFormal }) => ({ name, slug, isFormal })).sort(bySlug),
    occasions: occasions.map(({ name, slug, formalityLevel, description }) => ({ name, slug, formalityLevel, description })).sort(bySlug),
    seasons: seasons.map(({ name, slug }) => ({ name, slug })).sort(bySlug),
    bodyTypes: bodyTypes.map(({ name, slug, description }) => ({ name, slug, description })).sort(bySlug),
    skinTones: skinTones.map(({ name, slug, description }) => ({ name, slug, description })).sort(bySlug),
    garments: garments
      .map((g) => ({
        slug: g.slug,
        name: g.name,
        type: g.garmentType.slug,
        formalityLevel: g.formalityLevel,
        description: g.description,
        imageUrl: g.imageUrl,
        colors: primaryFirst(g.colors, (r) => r.color.slug).map((r) => ({ slug: r.color.slug, isPrimary: r.isPrimary })),
        fits: primaryFirst(g.fits, (r) => r.fit.slug).map((r) => ({ slug: r.fit.slug, isPrimary: r.isPrimary })),
        materials: [...g.materials]
          .sort((a, b) => b.percentage - a.percentage || a.material.slug.localeCompare(b.material.slug))
          .map((r) => ({ slug: r.material.slug, percentage: r.percentage })),
        patterns: primaryFirst(g.patterns, (r) => r.pattern.slug).map((r) => ({ slug: r.pattern.slug, isPrimary: r.isPrimary })),
        occasions: Object.fromEntries(g.occasions.map((o) => [o.occasion.slug, o.suitability]).sort()),
        seasons: Object.fromEntries(g.seasons.map((s) => [s.season.slug, s.suitability]).sort()),
      }))
      .sort(bySlug),
    // One entry per unordered pair (the DB and admin API enforce this too).
    compatibilityRules: compat
      .map((r) => {
        const [a, b] = pair(r.garmentA.slug, r.garmentB.slug);
        return { a, b, rating: r.rating, reason: r.reason };
      })
      .sort((x, y) => `${x.a}|${x.b}`.localeCompare(`${y.a}|${y.b}`)),
    colorRules: colorRules
      .map((r) => {
        const [a, b] = pair(r.colorA.slug, r.colorB.slug);
        return { a, b, score: r.score, harmony: r.harmony, ruleType: r.ruleType, reason: r.reason };
      })
      .sort((x, y) => `${x.a}|${x.b}`.localeCompare(`${y.a}|${y.b}`)),
    guides: guides
      .map(({ slug, title, category, excerpt, content, seoTitle, seoDesc, published, imageUrl }) => ({
        slug, title, category, excerpt, content, seoTitle, seoDesc, published, imageUrl,
      }))
      .sort(bySlug),
    styleRules: styleRules
      .map(({ title, ruleType, category, explanation }) => ({ title, ruleType, category, explanation }))
      .sort((x, y) => x.title.localeCompare(y.title)),
  };

  fs.writeFileSync(path.join(DATA_DIR, 'catalog.json'), JSON.stringify(catalog, null, 2) + '\n');
  console.log(
    `catalog.json: ${catalog.garments.length} garments, ${catalog.colors.length} colors, ` +
      `${catalog.compatibilityRules.length} garment rules, ${catalog.colorRules.length} color rules, ` +
      `${catalog.guides.length} guides, ${catalog.styleRules.length} style rules`
  );
}

// Personalization rows are every combination of six inputs, and each advice
// column depends on exactly one input. Store that compactly (and verify the
// assumption, so a future dataset that breaks it fails loudly here).
const INPUTS = ['hairColor', 'eyeColor', 'skinTone', 'underTone', 'torsoLength', 'bodyProportion'] as const;
const ADVICE_BY_INPUT = {
  underTone: ['recommendedClothingColors', 'avoidClothingColors', 'recommendedJewelryMetal', 'recommendedClothingColorWheelRegion', 'avoidClothingColorWheelRegion'],
  bodyProportion: ['recommendedFittingStyle', 'recommendedMaterials', 'recommendedPatterns', 'fabricNature', 'dontExaggerate', 'doExaggerate'],
  torsoLength: ['recommendedShoes'],
} as const;

async function exportPersonalization() {
  const rows = await prisma.personalizationRule.findMany();
  if (rows.length === 0) {
    console.log('personalization.json: skipped (table is empty)');
    return;
  }

  const inputs = Object.fromEntries(INPUTS.map((k) => [k, [...new Set(rows.map((r) => r[k]))].sort()]));
  const expected = INPUTS.reduce((n, k) => n * inputs[k].length, 1);
  if (expected !== rows.length) {
    throw new Error(`Personalization rows (${rows.length}) are not the full grid of input values (${expected}); export would lose data.`);
  }

  const advice: Record<string, Record<string, Record<string, string>>> = {};
  for (const [input, columns] of Object.entries(ADVICE_BY_INPUT)) {
    advice[input] = {};
    for (const r of rows) {
      const key = r[input as keyof typeof r] as string;
      const entry = Object.fromEntries(columns.map((c) => [c, r[c as keyof typeof r] as string]));
      const prev = advice[input][key];
      if (prev && JSON.stringify(prev) !== JSON.stringify(entry)) {
        throw new Error(`Advice for ${input}=${key} varies with other inputs; the compact format can't represent it.`);
      }
      advice[input][key] = entry;
    }
    advice[input] = Object.fromEntries(Object.entries(advice[input]).sort(([a], [b]) => a.localeCompare(b)));
  }

  const data = {
    description:
      'Personalization advice. The seed generates one personalization_rules row per combination of `inputs`; ' +
      'each advice group depends only on the named input.',
    inputs,
    adviceByUnderTone: advice.underTone,
    adviceByBodyProportion: advice.bodyProportion,
    adviceByTorsoLength: advice.torsoLength,
  };
  fs.writeFileSync(path.join(DATA_DIR, 'personalization.json'), JSON.stringify(data, null, 2) + '\n');
  console.log(`personalization.json: ${rows.length} rows -> ${Object.keys(advice.underTone).length + Object.keys(advice.bodyProportion).length + Object.keys(advice.torsoLength).length} advice entries`);
}

async function main() {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  await exportCatalog();
  await exportPersonalization();
}

main()
  .catch((e) => {
    console.error(e instanceof Error ? e.message : e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
