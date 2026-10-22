import { prisma } from '@/lib/prisma';
import { parseCsvRecords } from '@/lib/csv';
import { slugify } from '@/lib/utils';
import { compatibilityTypeForRating } from '@/lib/rule-engine/rating';
import { occasionSuitability, seasonSuitability, type SeasonProfile } from '@/lib/rule-engine/suitability';

// Admin bulk import from CSV. Every row is validated first; nothing is written
// unless the whole file is valid, and then everything is written in one
// transaction. A dry run returns the same report without writing.

export type ImportKind = 'garments' | 'compatibility' | 'colorRules';

export const IMPORT_COLUMNS: Record<ImportKind, { required: string[]; optional: string[]; example: string }> = {
  garments: {
    required: ['name', 'type', 'formality', 'colors'],
    optional: ['slug', 'fit', 'material', 'pattern', 'season', 'description'],
    example:
      'name,type,formality,colors,fit,material,pattern,season,description\n' +
      'Navy Linen Shirt,shirt,3,navy-blue,regular-fit,linen,solid,light,"Breathable summer shirt"\n' +
      'Grey Check Blazer,jacket,4,slate-grey;white,tailored-fit,wool,check,heavy,',
  },
  compatibility: {
    required: ['a', 'b', 'rating'],
    optional: ['reason'],
    example: 'a,b,rating,reason\nnavy-chinos,white-oxford-shirt,5,"A crisp classic"',
  },
  colorRules: {
    required: ['a', 'b', 'score', 'harmony'],
    optional: ['reason'],
    example: 'a,b,score,harmony,reason\nnavy-blue,camel,9.6,Classic Pairing,"Warm camel softens navy"',
  },
};

export interface ImportReport {
  kind: ImportKind;
  rows: number;
  created: number;
  updated: number;
  errors: { line: number; message: string }[];
  written: boolean;
}

type Plan = { line: number; action: 'create' | 'update'; apply: (tx: Tx) => Promise<void> };
type Tx = Parameters<Parameters<typeof prisma.$transaction>[0]>[0];

const MAX_ROWS = 2000;
const MAX_ERRORS = 100;

export async function runImport(kind: ImportKind, csv: string, dryRun: boolean): Promise<ImportReport> {
  const report: ImportReport = { kind, rows: 0, created: 0, updated: 0, errors: [], written: false };
  let parsed: ReturnType<typeof parseCsvRecords>;
  try {
    parsed = parseCsvRecords(csv);
  } catch (e) {
    report.errors.push({ line: 0, message: e instanceof Error ? e.message : 'Could not read the CSV.' });
    return report;
  }

  const { required } = IMPORT_COLUMNS[kind];
  const missingColumns = required.filter((c) => !parsed.headers.includes(c));
  if (missingColumns.length) {
    report.errors.push({ line: 1, message: `Missing column(s): ${missingColumns.join(', ')}. Expected: ${[...required, ...IMPORT_COLUMNS[kind].optional].join(', ')}.` });
    return report;
  }
  if (parsed.records.length === 0) {
    report.errors.push({ line: 2, message: 'The file has a header but no rows.' });
    return report;
  }
  if (parsed.records.length > MAX_ROWS) {
    report.errors.push({ line: 0, message: `Too many rows (${parsed.records.length}); import at most ${MAX_ROWS} at a time.` });
    return report;
  }
  report.rows = parsed.records.length;

  const plans: Plan[] = [];
  const error = (line: number, message: string) => {
    if (report.errors.length < MAX_ERRORS) report.errors.push({ line, message });
  };

  if (kind === 'garments') await planGarments(parsed.records, plans, error);
  else if (kind === 'compatibility') await planCompatibility(parsed.records, plans, error);
  else await planColorRules(parsed.records, plans, error);

  report.created = plans.filter((p) => p.action === 'create').length;
  report.updated = plans.filter((p) => p.action === 'update').length;
  if (report.errors.length || dryRun) return report;

  await prisma.$transaction(
    async (tx) => {
      for (const plan of plans) await plan.apply(tx);
    },
    { timeout: 120_000 }
  );
  report.written = true;
  return report;
}

const num = (v: string) => (v === '' ? NaN : Number(v));

async function planGarments(records: { line: number; values: Record<string, string> }[], plans: Plan[], error: (l: number, m: string) => void) {
  const [types, colors, fits, materials, patterns, occasions, seasons, existing] = await Promise.all([
    prisma.garmentType.findMany(),
    prisma.color.findMany(),
    prisma.fit.findMany(),
    prisma.material.findMany(),
    prisma.pattern.findMany(),
    prisma.occasion.findMany(),
    prisma.season.findMany(),
    prisma.garment.findMany({ select: { id: true, slug: true, ownerId: true } }),
  ]);
  const bySlug = <T extends { slug: string }>(rows: T[]) => new Map(rows.map((r) => [r.slug, r]));
  const [typeBy, colorBy, fitBy, materialBy, patternBy] = [bySlug(types), bySlug(colors), bySlug(fits), bySlug(materials), bySlug(patterns)];
  const existingBy = new Map(existing.map((g) => [g.slug, g]));
  const seenSlugs = new Set<string>();

  for (const { line, values: v } of records) {
    const problems: string[] = [];
    const slug = slugify(v.slug || v.name);
    if (!v.name) problems.push('name is required');
    if (!slug) problems.push('name/slug must contain letters or digits');
    if (seenSlugs.has(slug)) problems.push(`slug "${slug}" appears twice in this file`);
    seenSlugs.add(slug);
    const prior = existingBy.get(slug);
    if (prior?.ownerId) problems.push(`slug "${slug}" belongs to a user's private item`);

    const type = typeBy.get(v.type);
    if (!type) problems.push(`unknown type "${v.type}"`);
    const formality = num(v.formality);
    if (!Number.isInteger(formality) || formality < 1 || formality > 5) problems.push('formality must be a whole number 1-5');
    const colorSlugs = v.colors.split(/[;|]/).map((c) => c.trim()).filter(Boolean);
    if (colorSlugs.length === 0) problems.push('colors is required (separate several with ;)');
    const unknownColors = colorSlugs.filter((c) => !colorBy.has(c));
    if (unknownColors.length) problems.push(`unknown color(s): ${unknownColors.join(', ')}`);
    const fit = v.fit ? fitBy.get(v.fit) : undefined;
    if (v.fit && !fit) problems.push(`unknown fit "${v.fit}"`);
    const material = v.material ? materialBy.get(v.material) : undefined;
    if (v.material && !material) problems.push(`unknown material "${v.material}"`);
    const pattern = patternBy.get(v.pattern || 'solid');
    if (!pattern) problems.push(`unknown pattern "${v.pattern}"`);
    const season = (v.season || 'all') as SeasonProfile;
    if (!['light', 'heavy', 'all'].includes(season)) problems.push('season must be light, heavy or all');

    if (problems.length) {
      error(line, problems.join('; '));
      continue;
    }

    plans.push({
      line,
      action: prior ? 'update' : 'create',
      apply: async (tx) => {
        const fields = { name: v.name, garmentTypeId: type!.id, formalityLevel: formality, description: v.description ?? '' };
        const { id } = await tx.garment.upsert({ where: { slug }, update: fields, create: { slug, ...fields } });
        await tx.garmentColor.deleteMany({ where: { garmentId: id } });
        await tx.garmentColor.createMany({ data: [...new Set(colorSlugs)].map((c, i) => ({ garmentId: id, colorId: colorBy.get(c)!.id, isPrimary: i === 0 })) });
        await tx.garmentPattern.deleteMany({ where: { garmentId: id } });
        await tx.garmentPattern.create({ data: { garmentId: id, patternId: pattern!.id, isPrimary: true } });
        if (material) {
          await tx.garmentMaterial.deleteMany({ where: { garmentId: id } });
          await tx.garmentMaterial.create({ data: { garmentId: id, materialId: material.id, percentage: 100 } });
        }
        if (fit) {
          await tx.garmentFit.deleteMany({ where: { garmentId: id } });
          await tx.garmentFit.create({ data: { garmentId: id, fitId: fit.id, isPrimary: true } });
        }
        await tx.garmentOccasion.deleteMany({ where: { garmentId: id } });
        await tx.garmentOccasion.createMany({ data: occasions.map((o) => ({ garmentId: id, occasionId: o.id, suitability: occasionSuitability(formality, o.formalityLevel) })) });
        await tx.garmentSeason.deleteMany({ where: { garmentId: id } });
        await tx.garmentSeason.createMany({ data: seasons.map((s) => ({ garmentId: id, seasonId: s.id, suitability: seasonSuitability(season, s.slug) })) });
      },
    });
  }
}

async function planCompatibility(records: { line: number; values: Record<string, string> }[], plans: Plan[], error: (l: number, m: string) => void) {
  const garments = await prisma.garment.findMany({ where: { ownerId: null }, select: { id: true, slug: true } });
  const idBy = new Map(garments.map((g) => [g.slug, g.id]));
  const rules = await prisma.compatibilityRule.findMany({ select: { id: true, garmentAId: true, garmentBId: true } });
  const ruleBy = new Map(rules.map((r) => [[r.garmentAId, r.garmentBId].sort().join('|'), r.id]));
  const seen = new Set<string>();

  for (const { line, values: v } of records) {
    const problems: string[] = [];
    const a = idBy.get(v.a);
    const b = idBy.get(v.b);
    if (!a) problems.push(`unknown garment "${v.a}"`);
    if (!b) problems.push(`unknown garment "${v.b}"`);
    if (a && a === b) problems.push('a and b must be different garments');
    const rating = num(v.rating);
    if (!(rating >= 1 && rating <= 5)) problems.push('rating must be between 1 and 5');
    const key = a && b ? [a, b].sort().join('|') : '';
    if (key && seen.has(key)) problems.push('this pair appears twice in the file');
    seen.add(key);
    if (problems.length) {
      error(line, problems.join('; '));
      continue;
    }
    const existingId = ruleBy.get(key);
    const data = { rating, reason: v.reason ?? '', compatibilityType: compatibilityTypeForRating(rating) };
    plans.push({
      line,
      action: existingId ? 'update' : 'create',
      apply: async (tx) => {
        if (existingId) await tx.compatibilityRule.update({ where: { id: existingId }, data });
        else await tx.compatibilityRule.create({ data: { garmentAId: a!, garmentBId: b!, ...data } });
      },
    });
  }
}

async function planColorRules(records: { line: number; values: Record<string, string> }[], plans: Plan[], error: (l: number, m: string) => void) {
  const colors = await prisma.color.findMany({ select: { id: true, slug: true } });
  const idBy = new Map(colors.map((c) => [c.slug, c.id]));
  const rules = await prisma.colorCompatibilityRule.findMany({ select: { id: true, colorAId: true, colorBId: true } });
  const ruleBy = new Map(rules.map((r) => [[r.colorAId, r.colorBId].sort().join('|'), r.id]));
  const seen = new Set<string>();

  for (const { line, values: v } of records) {
    const problems: string[] = [];
    const a = idBy.get(v.a);
    const b = idBy.get(v.b);
    if (!a) problems.push(`unknown color "${v.a}"`);
    if (!b) problems.push(`unknown color "${v.b}"`);
    if (a && a === b) problems.push('a and b must be different colors');
    const score = num(v.score);
    if (!(score >= 0 && score <= 10)) problems.push('score must be between 0 and 10');
    if (!v.harmony || v.harmony.length > 60) problems.push('harmony label is required (max 60 characters)');
    const key = a && b ? [a, b].sort().join('|') : '';
    if (key && seen.has(key)) problems.push('this pair appears twice in the file');
    seen.add(key);
    if (problems.length) {
      error(line, problems.join('; '));
      continue;
    }
    const existingId = ruleBy.get(key);
    const data = { score, harmony: v.harmony, reason: v.reason ?? '', ruleType: 'curated' };
    plans.push({
      line,
      action: existingId ? 'update' : 'create',
      apply: async (tx) => {
        if (existingId) await tx.colorCompatibilityRule.update({ where: { id: existingId }, data });
        else await tx.colorCompatibilityRule.create({ data: { colorAId: a!, colorBId: b!, ...data } });
      },
    });
  }
}
