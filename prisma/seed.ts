// Seeds (or re-syncs) a database from the data files in prisma/data:
//
//   catalog.json          garment types, colors, attributes, occasions/seasons,
//                         garments, curated rules, guides, style rules
//   personalization.json  personalization advice (expanded to one row per
//                         combination of inputs)
//
// plus an admin account. Run with `npx prisma db seed` (or `npm run db:setup`
// on a fresh database). Safe to re-run: everything is upserted by slug (style
// rules by title), so it never duplicates rows and never deletes users,
// wardrobes, saved outfits, or catalog items that aren't in the files.
// Regenerate the files from a curated database with `npm run db:export`.
import { PrismaClient, type Prisma } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { randomBytes } from 'crypto';
import fs from 'fs';
import path from 'path';

const prisma = new PrismaClient();
const DATA_DIR = path.join(__dirname, 'data');

interface Catalog {
  garmentTypes: { name: string; slug: string }[];
  colors: { name: string; slug: string; hex: string; family: string; isNeutral: boolean }[];
  fits: { name: string; slug: string }[];
  materials: { name: string; slug: string; breathability: number; formality: number }[];
  patterns: { name: string; slug: string; isFormal: boolean }[];
  occasions: { name: string; slug: string; formalityLevel: number; description: string }[];
  seasons: { name: string; slug: string }[];
  bodyTypes: { name: string; slug: string; description: string }[];
  skinTones: { name: string; slug: string; description: string }[];
  garments: {
    slug: string;
    name: string;
    type: string;
    formalityLevel: number;
    description: string;
    imageUrl: string;
    colors: { slug: string; isPrimary: boolean }[];
    fits: { slug: string; isPrimary: boolean }[];
    materials: { slug: string; percentage: number }[];
    patterns: { slug: string; isPrimary: boolean }[];
    occasions: Record<string, number>;
    seasons: Record<string, number>;
  }[];
  compatibilityRules: { a: string; b: string; rating: number; reason: string }[];
  colorRules: { a: string; b: string; score: number; harmony: string; ruleType: string; reason: string }[];
  guides: {
    slug: string;
    title: string;
    category: string;
    excerpt: string;
    content: string;
    seoTitle: string;
    seoDesc: string;
    published: boolean;
    imageUrl: string;
  }[];
  styleRules: { title: string; ruleType: string; category: string; explanation: string }[];
}

interface PersonalizationData {
  inputs: Record<'hairColor' | 'eyeColor' | 'skinTone' | 'underTone' | 'torsoLength' | 'bodyProportion', string[]>;
  adviceByUnderTone: Record<string, Record<string, string>>;
  adviceByBodyProportion: Record<string, Record<string, string>>;
  adviceByTorsoLength: Record<string, Record<string, string>>;
}

const readJson = <T>(file: string): T => JSON.parse(fs.readFileSync(path.join(DATA_DIR, file), 'utf8'));

function compatibilityTypeForRating(rating: number) {
  if (rating >= 4.5) return 'excellent';
  if (rating >= 3.5) return 'good';
  if (rating >= 2.5) return 'acceptable';
  return 'avoid';
}

function idMap(rows: { id: string; slug: string }[], what: string) {
  const map = new Map(rows.map((r) => [r.slug, r.id]));
  return (slug: string) => {
    const id = map.get(slug);
    if (!id) throw new Error(`catalog.json references unknown ${what} "${slug}"`);
    return id;
  };
}

async function seedAdmin() {
  // Credentials come from ADMIN_EMAIL / ADMIN_PASSWORD. If no password is
  // given, a random one is generated and printed once. An existing admin is
  // never modified; use `npm run admin:set-password` for that.
  const email = (process.env.ADMIN_EMAIL || 'admin@styleiq.com').trim().toLowerCase();
  if (await prisma.adminUser.findUnique({ where: { email } })) {
    console.log(`Admin ${email} already exists, leaving it unchanged.`);
    return;
  }
  const provided = process.env.ADMIN_PASSWORD;
  if (provided && provided.length < 12) throw new Error('ADMIN_PASSWORD must be at least 12 characters.');
  const password = provided || randomBytes(18).toString('base64url');
  await prisma.adminUser.create({ data: { email, password: await bcrypt.hash(password, 12), name: 'Fashion Chief Editor' } });
  console.log(`Created admin ${email}.`);
  if (!provided) console.log(`  Generated admin password (shown once, store it now): ${password}`);
}

async function seedReferenceData(c: Catalog) {
  await prisma.$transaction(async (tx) => {
    for (const t of c.garmentTypes) await tx.garmentType.upsert({ where: { slug: t.slug }, update: t, create: t });
    for (const x of c.colors) await tx.color.upsert({ where: { slug: x.slug }, update: x, create: x });
    for (const x of c.fits) await tx.fit.upsert({ where: { slug: x.slug }, update: x, create: x });
    for (const x of c.materials) await tx.material.upsert({ where: { slug: x.slug }, update: x, create: x });
    for (const x of c.patterns) await tx.pattern.upsert({ where: { slug: x.slug }, update: x, create: x });
    for (const x of c.occasions) await tx.occasion.upsert({ where: { slug: x.slug }, update: x, create: x });
    for (const x of c.seasons) await tx.season.upsert({ where: { slug: x.slug }, update: x, create: x });
    for (const x of c.bodyTypes) await tx.bodyType.upsert({ where: { slug: x.slug }, update: x, create: x });
    for (const x of c.skinTones) await tx.skinTone.upsert({ where: { slug: x.slug }, update: x, create: x });
  }, { timeout: 120_000 });
  console.log(`Reference data: ${c.garmentTypes.length} types, ${c.colors.length} colors, ${c.occasions.length} occasions, ${c.seasons.length} seasons.`);
}

async function seedGarments(c: Catalog) {
  const [types, colors, fits, materials, patterns, occasions, seasons] = await Promise.all([
    prisma.garmentType.findMany(),
    prisma.color.findMany(),
    prisma.fit.findMany(),
    prisma.material.findMany(),
    prisma.pattern.findMany(),
    prisma.occasion.findMany(),
    prisma.season.findMany(),
  ]);
  const typeId = idMap(types, 'garment type');
  const colorId = idMap(colors, 'color');
  const fitId = idMap(fits, 'fit');
  const materialId = idMap(materials, 'material');
  const patternId = idMap(patterns, 'pattern');
  const occasionId = idMap(occasions, 'occasion');
  const seasonId = idMap(seasons, 'season');

  await prisma.$transaction(async (tx) => {
    for (const g of c.garments) {
      const fields = {
        name: g.name,
        garmentTypeId: typeId(g.type),
        formalityLevel: g.formalityLevel,
        description: g.description,
        imageUrl: g.imageUrl,
      };
      const { id } = await tx.garment.upsert({ where: { slug: g.slug }, update: fields, create: { slug: g.slug, ...fields } });

      // Attribute rows are replaced wholesale so the garment matches the file exactly.
      await tx.garmentColor.deleteMany({ where: { garmentId: id } });
      await tx.garmentFit.deleteMany({ where: { garmentId: id } });
      await tx.garmentMaterial.deleteMany({ where: { garmentId: id } });
      await tx.garmentPattern.deleteMany({ where: { garmentId: id } });
      await tx.garmentOccasion.deleteMany({ where: { garmentId: id } });
      await tx.garmentSeason.deleteMany({ where: { garmentId: id } });
      await tx.garmentColor.createMany({ data: g.colors.map((x) => ({ garmentId: id, colorId: colorId(x.slug), isPrimary: x.isPrimary })) });
      await tx.garmentFit.createMany({ data: g.fits.map((x) => ({ garmentId: id, fitId: fitId(x.slug), isPrimary: x.isPrimary })) });
      await tx.garmentMaterial.createMany({ data: g.materials.map((x) => ({ garmentId: id, materialId: materialId(x.slug), percentage: x.percentage })) });
      await tx.garmentPattern.createMany({ data: g.patterns.map((x) => ({ garmentId: id, patternId: patternId(x.slug), isPrimary: x.isPrimary })) });
      await tx.garmentOccasion.createMany({
        data: Object.entries(g.occasions).map(([slug, suitability]) => ({ garmentId: id, occasionId: occasionId(slug), suitability })),
      });
      await tx.garmentSeason.createMany({
        data: Object.entries(g.seasons).map(([slug, suitability]) => ({ garmentId: id, seasonId: seasonId(slug), suitability })),
      });
    }
  }, { timeout: 300_000 });
  console.log(`Garments: ${c.garments.length} upserted with colors, fits, materials, patterns, occasions and seasons.`);
}

async function seedRules(c: Catalog) {
  const garmentId = idMap(await prisma.garment.findMany({ select: { id: true, slug: true } }), 'garment');
  const colorId = idMap(await prisma.color.findMany({ select: { id: true, slug: true } }), 'color');

  await prisma.$transaction(async (tx) => {
    // One rule per unordered pair: update whichever direction exists.
    for (const r of c.compatibilityRules) {
      const [a, b] = [garmentId(r.a), garmentId(r.b)];
      const data = { rating: r.rating, reason: r.reason, compatibilityType: compatibilityTypeForRating(r.rating) };
      const existing = await tx.compatibilityRule.findFirst({ where: { OR: [{ garmentAId: a, garmentBId: b }, { garmentAId: b, garmentBId: a }] } });
      if (existing) await tx.compatibilityRule.update({ where: { id: existing.id }, data });
      else await tx.compatibilityRule.create({ data: { garmentAId: a, garmentBId: b, ...data } });
    }
    for (const r of c.colorRules) {
      const [a, b] = [colorId(r.a), colorId(r.b)];
      const data = { score: r.score, harmony: r.harmony, ruleType: r.ruleType, reason: r.reason };
      const existing = await tx.colorCompatibilityRule.findFirst({ where: { OR: [{ colorAId: a, colorBId: b }, { colorAId: b, colorBId: a }] } });
      if (existing) await tx.colorCompatibilityRule.update({ where: { id: existing.id }, data });
      else await tx.colorCompatibilityRule.create({ data: { colorAId: a, colorBId: b, ...data } });
    }
  }, { timeout: 120_000 });
  console.log(`Curated rules: ${c.compatibilityRules.length} garment pairs, ${c.colorRules.length} color pairs.`);
}

async function seedContent(c: Catalog) {
  await prisma.$transaction(async (tx) => {
    for (const g of c.guides) await tx.guide.upsert({ where: { slug: g.slug }, update: g, create: g });
    for (const r of c.styleRules) {
      const existing = await tx.styleRule.findFirst({ where: { title: r.title } });
      if (existing) await tx.styleRule.update({ where: { id: existing.id }, data: r });
      else await tx.styleRule.create({ data: r });
    }
  });
  console.log(`Content: ${c.guides.length} guides, ${c.styleRules.length} style rules.`);
}

async function seedPersonalization(d: PersonalizationData) {
  const { hairColor, eyeColor, skinTone, underTone, torsoLength, bodyProportion } = d.inputs;
  const rows: Prisma.PersonalizationRuleCreateManyInput[] = [];
  for (const h of hairColor)
    for (const e of eyeColor)
      for (const s of skinTone)
        for (const u of underTone)
          for (const t of torsoLength)
            for (const b of bodyProportion) {
              const byU = d.adviceByUnderTone[u];
              const byB = d.adviceByBodyProportion[b];
              const byT = d.adviceByTorsoLength[t];
              if (!byU || !byB || !byT) throw new Error(`personalization.json is missing advice for ${u} / ${b} / ${t}`);
              rows.push({
                hairColor: h,
                eyeColor: e,
                skinTone: s,
                underTone: u,
                torsoLength: t,
                bodyProportion: b,
                recommendedClothingColors: byU.recommendedClothingColors,
                avoidClothingColors: byU.avoidClothingColors,
                recommendedJewelryMetal: byU.recommendedJewelryMetal,
                recommendedClothingColorWheelRegion: byU.recommendedClothingColorWheelRegion,
                avoidClothingColorWheelRegion: byU.avoidClothingColorWheelRegion,
                recommendedFittingStyle: byB.recommendedFittingStyle,
                recommendedMaterials: byB.recommendedMaterials,
                recommendedPatterns: byB.recommendedPatterns,
                fabricNature: byB.fabricNature,
                dontExaggerate: byB.dontExaggerate,
                doExaggerate: byB.doExaggerate,
                recommendedShoes: byT.recommendedShoes,
              });
            }

  // Replace atomically: a failure part-way leaves the previous rows intact
  // (the old CSV import deleted everything first, outside a transaction).
  await prisma.$transaction(async (tx) => {
    await tx.personalizationRule.deleteMany();
    for (let i = 0; i < rows.length; i += 2000) {
      await tx.personalizationRule.createMany({ data: rows.slice(i, i + 2000) });
    }
  }, { timeout: 300_000 });
  console.log(`Personalization: ${rows.length} rows generated.`);
}

async function main() {
  console.log('Seeding StyleIQ from prisma/data ...');
  const catalog = readJson<Catalog>('catalog.json');
  const personalization = readJson<PersonalizationData>('personalization.json');

  await seedAdmin();
  await seedReferenceData(catalog);
  await seedGarments(catalog);
  await seedRules(catalog);
  await seedContent(catalog);
  await seedPersonalization(personalization);
  console.log('Seed complete.');
}

main()
  .catch((e) => {
    console.error('Seed failed:', e instanceof Error ? e.message : e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
