import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Expands curated CompatibilityRule / ColorCompatibilityRule coverage beyond
// the original hand-seeded ~13 rows each — covering the new garment types
// (T-shirt, Polo, Sweater, Cardigan, Tie) and more of the expanded color
// palette with genuine expert-style judgments, not just live HSL math.
// Everything not listed here still falls back to the (now-fixed) live
// color-wheel math and neutral-default compatibility scoring — this is a
// meaningful expansion, not an attempt at exhaustive coverage.

const garmentRules = [
  { a: 'white-crew-tshirt', b: 'navy-chinos', rating: 5.0, type: 'excellent', reason: 'A plain white tee with navy chinos is the most foolproof casual combination there is.' },
  { a: 'white-crew-tshirt', b: 'black-slim-jeans', rating: 4.8, type: 'excellent', reason: 'White tee and black jeans is a clean, high-contrast casual staple.' },
  { a: 'charcoal-grey-tshirt', b: 'black-slim-jeans', rating: 4.7, type: 'excellent', reason: 'Charcoal and black is an easy tonal casual pairing.' },
  { a: 'navy-pique-polo', b: 'beige-chinos', rating: 5.0, type: 'excellent', reason: 'Navy polo with beige chinos is the classic preppy smart-casual combination.' },
  { a: 'white-pique-polo', b: 'navy-chinos', rating: 5.0, type: 'excellent', reason: 'White polo with navy chinos is crisp and universally flattering.' },
  { a: 'charcoal-merino-sweater', b: 'navy-chinos', rating: 4.8, type: 'excellent', reason: 'A charcoal sweater grounds navy chinos for a sharp smart-casual look.' },
  { a: 'navy-vneck-sweater', b: 'charcoal-dress-trousers', rating: 4.5, type: 'excellent', reason: 'Navy over charcoal is a classic smart-layering combination for the office.' },
  { a: 'oatmeal-shawl-cardigan', b: 'navy-chinos', rating: 4.5, type: 'excellent', reason: 'A soft oatmeal cardigan pairs easily over navy chinos for relaxed layering.' },
  { a: 'navy-silk-tie', b: 'light-blue-dress-shirt', rating: 5.0, type: 'excellent', reason: 'Navy tie on a light blue shirt is a foolproof business-formal combination.' },
  { a: 'navy-silk-tie', b: 'white-oxford-shirt', rating: 5.0, type: 'excellent', reason: 'A navy tie against a crisp white shirt is a timeless formal pairing.' },
  { a: 'burgundy-tie', b: 'light-blue-dress-shirt', rating: 4.8, type: 'excellent', reason: 'Burgundy adds warmth and contrast against a light blue shirt.' },
  { a: 'navy-wool-blazer', b: 'beige-chinos', rating: 5.0, type: 'excellent', reason: 'The navy blazer and beige chino combination is a smart-casual cornerstone.' },
  { a: 'black-chino-trousers', b: 'white-oxford-shirt', rating: 4.5, type: 'excellent', reason: 'Black chinos with a white shirt is a clean, high-contrast smart-casual look.' },
  { a: 'black-chino-trousers', b: 'black-oxfords', rating: 5.0, type: 'excellent', reason: 'Matching black chinos with black formal shoes keeps the look sharp and cohesive.' },
  { a: 'black-chino-trousers', b: 'black-leather-belt', rating: 5.0, type: 'excellent', reason: 'Golden rule: black bottoms pair with a black leather belt.' },
  { a: 'black-chino-trousers', b: 'dark-brown-oxfords', rating: 2.0, type: 'avoid', reason: 'Black bottoms with brown formal shoes is a classic style clash — stick to black shoes with black.' },
  { a: 'white-casual-chinos', b: 'navy-polo-shirt', rating: 4.8, type: 'excellent', reason: 'White chinos and a navy polo is a fresh warm-weather smart-casual look.' },
  { a: 'white-casual-chinos', b: 'tan-penny-loafers', rating: 4.5, type: 'excellent', reason: 'White chinos with tan loafers is an easy summer combination.' },
];

const colorRules = [
  { a: 'graphite-grey', b: 'burgundy', score: 9.5, harmony: 'jewel-neutral', ruleType: 'autumn-formal', reason: 'Burgundy adds rich contrast against a graphite-grey base.' },
  { a: 'forest-green', b: 'camel', score: 9.4, harmony: 'analogous', ruleType: 'safari-earth', reason: 'Forest green and camel is a natural, earthy autumn pairing.' },
  { a: 'navy-blue', b: 'burgundy', score: 9.3, harmony: 'complementary', ruleType: 'preppy-classic', reason: 'Navy and burgundy is a rich, classic preppy color combination.' },
  { a: 'steel-blue', b: 'camel', score: 9.2, harmony: 'analogous', ruleType: 'smart-neutral', reason: 'Steel blue and camel create a soft, smart-casual balance.' },
  { a: 'olive-green', b: 'navy-blue', score: 9.0, harmony: 'complementary', ruleType: 'modern-military', reason: 'Olive and navy give a modern, military-inspired contrast.' },
  { a: 'terracotta', b: 'navy-blue', score: 9.1, harmony: 'complementary', ruleType: 'warm-cool-balance', reason: 'Warm terracotta balances cool navy for an eye-catching pair.' },
  { a: 'mustard-yellow', b: 'navy-blue', score: 9.3, harmony: 'complementary', ruleType: 'statement-classic', reason: 'Mustard against navy is a confident, statement-making combination.' },
];

async function main() {
  console.log('Seeding expanded compatibility & color-rule coverage...');

  const garmentsBySlug: Record<string, string> = {};
  const neededGarmentSlugs = Array.from(new Set(garmentRules.flatMap((r) => [r.a, r.b])));
  const garments = await prisma.garment.findMany({ where: { slug: { in: neededGarmentSlugs } } });
  for (const g of garments) garmentsBySlug[g.slug] = g.id;

  let garmentRuleCount = 0;
  for (const r of garmentRules) {
    const aId = garmentsBySlug[r.a];
    const bId = garmentsBySlug[r.b];
    if (!aId || !bId) {
      console.warn(`Skipping compatibility rule ${r.a} <-> ${r.b}: garment not found.`);
      continue;
    }
    await prisma.compatibilityRule.upsert({
      where: { garmentAId_garmentBId: { garmentAId: aId, garmentBId: bId } },
      update: { rating: r.rating, compatibilityType: r.type, reason: r.reason },
      create: { garmentAId: aId, garmentBId: bId, rating: r.rating, compatibilityType: r.type, reason: r.reason },
    });
    garmentRuleCount++;
  }

  const colorsBySlug: Record<string, string> = {};
  const neededColorSlugs = Array.from(new Set(colorRules.flatMap((r) => [r.a, r.b])));
  const colors = await prisma.color.findMany({ where: { slug: { in: neededColorSlugs } } });
  for (const c of colors) colorsBySlug[c.slug] = c.id;

  let colorRuleCount = 0;
  for (const r of colorRules) {
    const aId = colorsBySlug[r.a];
    const bId = colorsBySlug[r.b];
    if (!aId || !bId) {
      console.warn(`Skipping color rule ${r.a} <-> ${r.b}: color not found.`);
      continue;
    }
    await prisma.colorCompatibilityRule.upsert({
      where: { colorAId_colorBId: { colorAId: aId, colorBId: bId } },
      update: { score: r.score, harmony: r.harmony, ruleType: r.ruleType, reason: r.reason },
      create: { colorAId: aId, colorBId: bId, score: r.score, harmony: r.harmony, ruleType: r.ruleType, reason: r.reason },
    });
    colorRuleCount++;
  }

  console.log(`Seeded ${garmentRuleCount} compatibility rules and ${colorRuleCount} color-compatibility rules.`);
}

main()
  .catch((e) => {
    console.error('Error seeding rule expansion:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
