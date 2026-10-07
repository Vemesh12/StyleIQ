import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding StyleIQ Global Menswear Database...');

  // 1. ADMIN USER
  const hashedPassword = await bcrypt.hash('admin123', 10);
  const admin = await prisma.adminUser.upsert({
    where: { email: 'admin@styleiq.com' },
    update: {},
    create: {
      email: 'admin@styleiq.com',
      password: hashedPassword,
      name: 'Fashion Chief Editor',
    },
  });
  console.log('Created Admin User:', admin.email);

  // 2. GARMENT TYPES
  const typesData = [
    { name: 'Shirt', slug: 'shirt' },
    { name: 'Trouser', slug: 'trouser' },
    { name: 'Shoe', slug: 'shoe' },
    { name: 'Belt', slug: 'belt' },
    { name: 'Jacket', slug: 'jacket' },
    { name: 'Knitwear', slug: 'knitwear' },
    { name: 'Watch', slug: 'watch' },
    { name: 'Accessory', slug: 'accessory' },
  ];

  const types: Record<string, string> = {};
  for (const t of typesData) {
    const created = await prisma.garmentType.upsert({
      where: { slug: t.slug },
      update: {},
      create: t,
    });
    types[t.slug] = created.id;
  }

  // 3. COLORS (World Fashion & Basic Colors Palette)
  const colorsData = [
    // Neutrals & Greys
    { name: 'White', hex: '#FFFFFF', slug: 'white', family: 'Neutral', isNeutral: true },
    { name: 'Cream / Off-White', hex: '#F5F5DC', slug: 'ecru', family: 'Neutral', isNeutral: true },
    { name: 'Light Grey', hex: '#D3D3D3', slug: 'light-grey', family: 'Grey', isNeutral: true },
    { name: 'Medium Grey', hex: '#708090', slug: 'slate-grey', family: 'Grey', isNeutral: true },
    { name: 'Charcoal Grey', hex: '#333333', slug: 'charcoal-grey', family: 'Grey', isNeutral: true },
    { name: 'Black', hex: '#111111', slug: 'black', family: 'Neutral', isNeutral: true },

    // Blues
    { name: 'Sky Blue', hex: '#87CEEB', slug: 'sky-blue', family: 'Blue', isNeutral: false },
    { name: 'Light Blue', hex: '#ADD8E6', slug: 'light-blue', family: 'Blue', isNeutral: false },
    { name: 'Royal Blue', hex: '#4169E1', slug: 'royal-blue', family: 'Blue', isNeutral: false },
    { name: 'Dark Blue', hex: '#0047AB', slug: 'cobalt-blue', family: 'Blue', isNeutral: false },
    { name: 'Navy Blue', hex: '#1B2A4A', slug: 'navy-blue', family: 'Blue', isNeutral: true },

    // Earth Tones & Browns
    { name: 'Beige / Tan', hex: '#D2B48C', slug: 'beige-tan', family: 'Brown', isNeutral: true },
    { name: 'Khaki', hex: '#C3B091', slug: 'khaki', family: 'Brown', isNeutral: true },
    { name: 'Camel / Tan', hex: '#C19A6B', slug: 'camel', family: 'Brown', isNeutral: true },
    { name: 'Tan / Light Brown', hex: '#9A463D', slug: 'cognac', family: 'Brown', isNeutral: true },
    { name: 'Brown', hex: '#71503A', slug: 'tobacco-brown', family: 'Brown', isNeutral: true },
    { name: 'Dark Brown', hex: '#4A2C11', slug: 'dark-brown', family: 'Brown', isNeutral: true },

    // Greens
    { name: 'Mint Green', hex: '#98FF98', slug: 'mint-green', family: 'Green', isNeutral: false },
    { name: 'Light Green', hex: '#9DC183', slug: 'sage-green', family: 'Green', isNeutral: false },
    { name: 'Olive Green', hex: '#556B2F', slug: 'olive-green', family: 'Green', isNeutral: false },
    { name: 'Forest Green', hex: '#228B22', slug: 'forest-green', family: 'Green', isNeutral: false },
    { name: 'Dark Green', hex: '#50C878', slug: 'emerald-green', family: 'Green', isNeutral: false },

    // Reds, Oranges, Yellows
    { name: 'Red', hex: '#DC2626', slug: 'red', family: 'Red', isNeutral: false },
    { name: 'Maroon / Wine', hex: '#800020', slug: 'burgundy', family: 'Red', isNeutral: false },
    { name: 'Rust / Brick Red', hex: '#B7410E', slug: 'rust', family: 'Orange', isNeutral: false },
    { name: 'Peach / Coral', hex: '#FF7F50', slug: 'coral', family: 'Orange', isNeutral: false },
    { name: 'Yellow', hex: '#EAB308', slug: 'yellow', family: 'Yellow', isNeutral: false },
    { name: 'Mustard Yellow', hex: '#FFDB58', slug: 'mustard-yellow', family: 'Yellow', isNeutral: false },

    // Purples, Pinks & Teals
    { name: 'Pink', hex: '#FFB6C1', slug: 'pink', family: 'Pink', isNeutral: false },
    { name: 'Light Purple', hex: '#E6E6FA', slug: 'lavender', family: 'Purple', isNeutral: false },
    { name: 'Purple', hex: '#8E4585', slug: 'plum', family: 'Purple', isNeutral: false },
    { name: 'Teal Blue', hex: '#008080', slug: 'teal', family: 'Blue', isNeutral: false },
    { name: 'Sky Green / Turquoise', hex: '#40E0D0', slug: 'turquoise', family: 'Blue', isNeutral: false },
  ];

  const colors: Record<string, string> = {};
  for (const c of colorsData) {
    const created = await prisma.color.upsert({
      where: { slug: c.slug },
      update: {},
      create: c,
    });
    colors[c.slug] = created.id;
  }

  // 4. OCCASIONS
  const occasionsData = [
    { name: 'Black Tie', slug: 'black-tie', formalityLevel: 5, description: 'Tuxedos, formal galas, black-tie weddings.' },
    { name: 'Business Formal', slug: 'business-formal', formalityLevel: 4, description: 'Boardrooms, corporate meetings, formal interviews.' },
    { name: 'Business Casual', slug: 'business-casual', formalityLevel: 3, description: 'Modern corporate offices, client lunches, tech work places.' },
    { name: 'Smart Casual', slug: 'smart-casual', formalityLevel: 3, description: 'Dates, dinner parties, weekend events, stylish gatherings.' },
    { name: 'Casual', slug: 'casual', formalityLevel: 2, description: 'Relaxed weekends, errands, coffee runs, casual hangouts.' },
    { name: 'Wedding Guest', slug: 'wedding-guest', formalityLevel: 4, description: 'Formal and semi-formal wedding celebrations.' },
  ];

  const occasions: Record<string, string> = {};
  for (const o of occasionsData) {
    const created = await prisma.occasion.upsert({
      where: { slug: o.slug },
      update: {},
      create: o,
    });
    occasions[o.slug] = created.id;
  }

  // 5. SEASONS
  const seasonsData = [
    { name: 'Spring', slug: 'spring' },
    { name: 'Summer', slug: 'summer' },
    { name: 'Monsoon', slug: 'monsoon' },
    { name: 'Autumn / Fall', slug: 'autumn' },
    { name: 'Winter', slug: 'winter' },
  ];

  const seasons: Record<string, string> = {};
  for (const s of seasonsData) {
    const created = await prisma.season.upsert({
      where: { slug: s.slug },
      update: {},
      create: s,
    });
    seasons[s.slug] = created.id;
  }

  // 6. FITS, MATERIALS, PATTERNS
  const fitsData = [{ name: 'Slim Fit', slug: 'slim-fit' }, { name: 'Regular Fit', slug: 'regular-fit' }, { name: 'Relaxed Fit', slug: 'relaxed-fit' }, { name: 'Tailored Fit', slug: 'tailored-fit' }];
  for (const f of fitsData) await prisma.fit.upsert({ where: { slug: f.slug }, update: {}, create: f });

  const materialsData = [{ name: 'Cotton', slug: 'cotton' }, { name: 'Linen', slug: 'linen' }, { name: 'Wool', slug: 'wool' }, { name: 'Leather', slug: 'leather' }, { name: 'Suede', slug: 'suede' }, { name: 'Denim', slug: 'denim' }, { name: 'Silk', slug: 'silk' }, { name: 'Cashmere', slug: 'cashmere' }];
  for (const m of materialsData) await prisma.material.upsert({ where: { slug: m.slug }, update: {}, create: m });

  const patternsData = [{ name: 'Solid', slug: 'solid', isFormal: true }, { name: 'Striped', slug: 'striped', isFormal: true }, { name: 'Check / Plaid', slug: 'check', isFormal: false }];
  for (const p of patternsData) await prisma.pattern.upsert({ where: { slug: p.slug }, update: {}, create: p });

  // 7. GARMENTS (Global Master List - Simple Everyday Names + JSON Seed Integration)
  const baseGarmentsList = [
    // SHIRTS
    { name: 'White Cotton Button Shirt', slug: 'white-oxford-shirt', type: 'shirt', formality: 3, desc: 'The most versatile white shirt for any man. Easy to wear for work, office, or casual outings.', color: 'white' },
    { name: 'Light Blue Formal Shirt', slug: 'light-blue-dress-shirt', type: 'shirt', formality: 4, desc: 'A classic light blue shirt for office and formal wear. Looks clean, fresh, and smart.', color: 'light-blue' },
    { name: 'Navy Blue Polo T-Shirt', slug: 'navy-polo-shirt', type: 'shirt', formality: 2, desc: 'Classic navy blue collar T-shirt. Great for daily wear and weekend outings.', color: 'navy-blue' },
    { name: 'White Linen Casual Shirt', slug: 'white-linen-shirt', type: 'shirt', formality: 2, desc: 'Lightweight linen shirt for warm summer days. Very comfortable and airy.', color: 'white' },
    { name: 'Black Round Neck T-Shirt', slug: 'black-crew-neck-tshirt', type: 'shirt', formality: 1, desc: 'Simple plain black T-shirt for everyday casual wear.', color: 'black' },
    { name: 'Cream Silk Shirt', slug: 'ecru-silk-shirt', type: 'shirt', formality: 3, desc: 'Smooth cream off-white shirt for stylish parties and special occasions.', color: 'ecru' },
    { name: 'Dark Blue Formal Shirt', slug: 'cobalt-poplin-shirt', type: 'shirt', formality: 4, desc: 'Bright dark blue shirt for office wear and formal functions.', color: 'cobalt-blue' },
    { name: 'Olive Green Flannel Shirt', slug: 'olive-flannel-shirt', type: 'shirt', formality: 2, desc: 'Comfortable olive green soft cotton shirt for casual winter wear.', color: 'olive-green' },
    { name: 'Tan Knit Polo T-Shirt', slug: 'camel-knit-polo', type: 'shirt', formality: 3, desc: 'Soft tan collar T-shirt for smart casual wear.', color: 'camel' },
    { name: 'Maroon Collarless Shirt', slug: 'burgundy-grandad-shirt', type: 'shirt', formality: 3, desc: 'Maroon shirt without collar for a modern casual style.', color: 'burgundy' },

    // TROUSERS & PANTS
    { name: 'Navy Blue Chino Pants', slug: 'navy-chinos', type: 'trouser', formality: 3, desc: 'Versatile navy blue pants that match almost any shirt color.', color: 'navy-blue' },
    { name: 'Charcoal Grey Formal Pants', slug: 'charcoal-dress-trousers', type: 'trouser', formality: 4, desc: 'Essential dark grey formal pants for office, interviews, and events.', color: 'charcoal-grey' },
    { name: 'Beige / Khaki Chino Pants', slug: 'beige-chinos', type: 'trouser', formality: 3, desc: 'Classic khaki pants. Creates a great contrast with blue or dark shirts.', color: 'beige-tan' },
    { name: 'Dark Blue Jeans Pants', slug: 'dark-wash-jeans', type: 'trouser', formality: 2, desc: 'Clean dark blue jeans for daily casual wear.', color: 'navy-blue' },
    { name: 'Olive Green Chino Pants', slug: 'olive-chinos', type: 'trouser', formality: 3, desc: 'Stylish green pants that add nice variety to your daily wear.', color: 'olive-green' },
    { name: 'Medium Grey Formal Pants', slug: 'slate-grey-suit-trousers', type: 'trouser', formality: 4, desc: 'Comfortable medium grey formal trousers for work and events.', color: 'slate-grey' },
    { name: 'Brown Pleated Pants', slug: 'tobacco-brown-pleated-trousers', type: 'trouser', formality: 3, desc: 'Rich brown pants with comfortable pleats for smart wear.', color: 'tobacco-brown' },
    { name: 'Light Green Linen Pants', slug: 'sage-green-linen-trousers', type: 'trouser', formality: 2, desc: 'Cool light green linen pants for warm weather.', color: 'sage-green' },
    { name: 'White Cotton Formal Pants', slug: 'white-gurkha-trousers', type: 'trouser', formality: 3, desc: 'Crisp white pants for stylish summer functions.', color: 'white' },
    { name: 'Black Formal Pants', slug: 'black-wool-trousers', type: 'trouser', formality: 4, desc: 'Classic black formal trousers for evening wear and formal events.', color: 'black' },

    // SHOES
    { name: 'Dark Brown Leather Shoes', slug: 'dark-brown-oxfords', type: 'shoe', formality: 4, desc: 'Classic formal brown leather shoes for office and formal wear.', color: 'dark-brown' },
    { name: 'Black Formal Leather Shoes', slug: 'black-oxfords', type: 'shoe', formality: 5, desc: 'Formal black leather shoes for suit pants and formal functions.', color: 'black' },
    { name: 'Tan Loafer Shoes', slug: 'tan-penny-loafers', type: 'shoe', formality: 3, desc: 'Easy slip-on loafer shoes for smart casual wear and office.', color: 'beige-tan' },
    { name: 'White Casual Sneakers', slug: 'white-minimalist-sneakers', type: 'shoe', formality: 2, desc: 'Clean white leather sneakers for daily casual outfits.', color: 'white' },
    { name: 'Dark Brown Ankle Boots', slug: 'brown-suede-chelsea-boots', type: 'shoe', formality: 3, desc: 'Stylish brown boots for jeans and chino pants.', color: 'dark-brown' },
    { name: 'Maroon Loafer Shoes', slug: 'burgundy-tassel-loafers', type: 'shoe', formality: 4, desc: 'Rich maroon leather loafers for festive and smart wear.', color: 'burgundy' },
    { name: 'Brown Casual Boots', slug: 'tobacco-suede-chukka-boots', type: 'shoe', formality: 3, desc: 'Comfortable brown casual boots.', color: 'tobacco-brown' },

    // BELTS
    { name: 'Dark Brown Leather Belt', slug: 'dark-brown-leather-belt', type: 'belt', formality: 4, desc: 'Classic brown leather belt to match with brown shoes.', color: 'dark-brown' },
    { name: 'Black Leather Belt', slug: 'black-leather-belt', type: 'belt', formality: 5, desc: 'Classic black leather belt to match with black shoes.', color: 'black' },
    { name: 'Tan Woven Belt', slug: 'tan-braided-belt', type: 'belt', formality: 2, desc: 'Casual woven belt for jeans and chino pants.', color: 'beige-tan' },
    { name: 'Brown Suede Belt', slug: 'tobacco-suede-belt', type: 'belt', formality: 3, desc: 'Casual brown belt for casual shoes and boots.', color: 'tobacco-brown' },

    // JACKETS & COATS
    { name: 'Navy Blue Blazer Coat', slug: 'navy-wool-blazer', type: 'jacket', formality: 4, desc: 'Essential navy blue coat for office meetings, parties, and weddings.', color: 'navy-blue' },
    { name: 'Tan Overcoat / Coat', slug: 'camel-overcoat', type: 'jacket', formality: 4, desc: 'Warm tan long coat for winter style.', color: 'camel' },
    { name: 'Olive Green Casual Jacket', slug: 'olive-field-jacket', type: 'jacket', formality: 2, desc: 'Casual olive green jacket with pockets for daily wear.', color: 'olive-green' },
    { name: 'Black Leather Jacket', slug: 'black-leather-jacket', type: 'jacket', formality: 2, desc: 'Classic black leather jacket for casual wear.', color: 'black' },

    // KNITWEAR & SWEATERS
    { name: 'Cream Cable Knit Sweater', slug: 'ecru-cable-sweater', type: 'knitwear', formality: 2, desc: 'Warm cream wool sweater for winter days.', color: 'ecru' },
    { name: 'Purple V-Neck Sweater', slug: 'plum-merino-sweater', type: 'knitwear', formality: 3, desc: 'Soft purple sweater for smart layering over shirts.', color: 'plum' },
    { name: 'Charcoal High-Neck Sweater', slug: 'charcoal-cashmere-rollneck', type: 'knitwear', formality: 3, desc: 'Dark grey turtleneck sweater for winter warmth.', color: 'charcoal-grey' },

    // WATCHES
    { name: 'Silver Dial Watch with Leather Strap', slug: 'silver-dress-watch', type: 'watch', formality: 4, desc: 'Elegant silver watch with leather strap for formal wear.', color: 'light-grey' },
    { name: 'Brown Leather Strap Watch', slug: 'brown-chronograph-watch', type: 'watch', formality: 3, desc: 'Casual watch with brown leather strap.', color: 'dark-brown' },
    { name: 'Black Steel Sports Watch', slug: 'black-diver-watch', type: 'watch', formality: 2, desc: 'Sturdy black steel watch for daily wear.', color: 'black' },

    // ACCESSORIES
    { name: 'Maroon Silk Tie', slug: 'burgundy-silk-tie', type: 'accessory', formality: 5, desc: 'Classic maroon silk tie for suits and formal wear.', color: 'burgundy' },
    { name: 'White Pocket Square', slug: 'white-linen-pocket-square', type: 'accessory', formality: 4, desc: 'Simple white pocket handkerchief for suit coats.', color: 'white' },
    { name: 'Navy Blue Knit Tie', slug: 'navy-knit-tie', type: 'accessory', formality: 3, desc: 'Casual navy tie for blazer coats.', color: 'navy-blue' },
  ];

  const garmentsList = [...baseGarmentsList];

  const garmentsMap: Record<string, string> = {};

  for (const g of garmentsList) {
    const targetTypeId = types[g.type] || types['shirt'];
    const targetColorId = colors[g.color] || colors['white'];

    const created = await prisma.garment.upsert({
      where: { slug: g.slug },
      update: {
        name: g.name,
        description: g.desc,
        formalityLevel: g.formality,
      },
      create: {
        name: g.name,
        slug: g.slug,
        garmentTypeId: targetTypeId,
        formalityLevel: g.formality,
        description: g.desc,
        colors: {
          create: [{ colorId: targetColorId, isPrimary: true }],
        },
        occasions: {
          create: Object.values(occasions).map((occId) => ({ occasionId: occId, suitability: g.formality })),
        },
        seasons: {
          create: Object.values(seasons).map((sId) => ({ seasonId: sId, suitability: 4 })),
        },
      },
    });
    garmentsMap[g.slug] = created.id;
  }
  console.log(`Created ${Object.keys(garmentsMap).length} master garments across all world fashion categories.`);

  // 8. COMPATIBILITY RULES (Simple Descriptions)
  const rulesList = [
    { a: 'white-oxford-shirt', b: 'navy-chinos', rating: 5.0, type: 'excellent', reason: 'White shirt with navy blue pants is a clean, classic match.' },
    { a: 'white-oxford-shirt', b: 'charcoal-dress-trousers', rating: 5.0, type: 'excellent', reason: 'Classic white shirt and dark grey pants look very professional.' },
    { a: 'white-oxford-shirt', b: 'beige-chinos', rating: 4.8, type: 'excellent', reason: 'White shirt with khaki pants gives a fresh, clean look.' },
    { a: 'white-oxford-shirt', b: 'dark-wash-jeans', rating: 4.5, type: 'good', reason: 'Great smart casual look combining white shirt with dark blue jeans.' },
    { a: 'light-blue-dress-shirt', b: 'navy-chinos', rating: 4.9, type: 'excellent', reason: 'Light blue shirt with navy blue pants is a foolproof matching combination.' },
    { a: 'light-blue-dress-shirt', b: 'charcoal-dress-trousers', rating: 5.0, type: 'excellent', reason: 'Best office combination for daily wear.' },
    { a: 'navy-chinos', b: 'dark-brown-oxfords', rating: 4.9, type: 'excellent', reason: 'Brown leather shoes look great with navy blue pants.' },
    { a: 'navy-chinos', b: 'white-minimalist-sneakers', rating: 4.6, type: 'good', reason: 'White sneakers brighten up navy pants for daily casual wear.' },
    { a: 'charcoal-dress-trousers', b: 'black-oxfords', rating: 5.0, type: 'excellent', reason: 'Traditional black formal shoes with dark grey formal pants.' },
    { a: 'charcoal-dress-trousers', b: 'dark-brown-oxfords', rating: 4.7, type: 'excellent', reason: 'Brown shoes with dark grey pants for a modern formal look.' },
    { a: 'dark-brown-oxfords', b: 'dark-brown-leather-belt', rating: 5.0, type: 'excellent', reason: 'Golden rule: Always match brown belt leather with brown shoes.' },
    { a: 'black-oxfords', b: 'black-leather-belt', rating: 5.0, type: 'excellent', reason: 'Golden rule: Always match black belt leather with black shoes.' },
    { a: 'black-oxfords', b: 'dark-brown-leather-belt', rating: 1.0, type: 'avoid', reason: 'Never wear a brown belt with black formal shoes.' },
  ];

  for (const r of rulesList) {
    if (garmentsMap[r.a] && garmentsMap[r.b]) {
      await prisma.compatibilityRule.upsert({
        where: {
          garmentAId_garmentBId: {
            garmentAId: garmentsMap[r.a],
            garmentBId: garmentsMap[r.b],
          },
        },
        update: { rating: r.rating, compatibilityType: r.type, reason: r.reason },
        create: {
          garmentAId: garmentsMap[r.a],
          garmentBId: garmentsMap[r.b],
          rating: r.rating,
          compatibilityType: r.type,
          reason: r.reason,
        },
      });
    }
  }

  // 9. COLOR HARMONY RULES (Simple Terms)
  const colorRulesData = [
    { a: 'white', b: 'navy-blue', score: 10.0, harmony: 'contrast', type: 'neutral-anchor', reason: 'Clean high contrast that looks sharp and fresh.' },
    { a: 'white', b: 'black', score: 9.5, harmony: 'monochromatic', type: 'monochrome', reason: 'Classic black and white contrast.' },
    { a: 'light-blue', b: 'navy-blue', score: 9.8, harmony: 'analogous', type: 'monochromatic-family', reason: 'Matching blue tones that blend easily.' },
    { a: 'dark-brown', b: 'navy-blue', score: 9.6, harmony: 'complementary', type: 'earth-navy-balance', reason: 'Warm brown leather pairs beautifully with navy blue.' },
    { a: 'dark-brown', b: 'beige-tan', score: 9.5, harmony: 'analogous', type: 'earth-tone-gradient', reason: 'Natural earthy tones matching together.' },
    { a: 'olive-green', b: 'beige-tan', score: 9.4, harmony: 'analogous', type: 'safari-earth', reason: 'Olive green and beige match naturally.' },
    { a: 'camel', b: 'navy-blue', score: 9.9, harmony: 'complementary', type: 'sartorial-luxe', reason: 'Tan brown with navy blue is a stylish combination.' },
    { a: 'ecru', b: 'tobacco-brown', score: 9.7, harmony: 'analogous', type: 'mediterranean-luxe', reason: 'Off-white cream with brown gives a clean casual look.' },
    { a: 'sage-green', b: 'white', score: 9.3, harmony: 'fresh-neutral', type: 'summer-pastel', reason: 'Light green with white gives a fresh summer look.' },
    { a: 'plum', b: 'charcoal-grey', score: 9.5, harmony: 'jewel-neutral', type: 'autumn-formal', reason: 'Purple tone adds rich style to dark grey pants.' },
    { a: 'black', b: 'dark-brown', score: 3.0, harmony: 'avoid', type: 'clashing-dark-leathers', reason: 'Avoid mixing black and brown leathers together.' },
  ];

  for (const cr of colorRulesData) {
    if (colors[cr.a] && colors[cr.b]) {
      await prisma.colorCompatibilityRule.upsert({
        where: {
          colorAId_colorBId: {
            colorAId: colors[cr.a],
            colorBId: colors[cr.b],
          },
        },
        update: { score: cr.score, harmony: cr.harmony, ruleType: cr.type, reason: cr.reason },
        create: {
          colorAId: colors[cr.a],
          colorBId: colors[cr.b],
          score: cr.score,
          harmony: cr.harmony,
          ruleType: cr.type,
          reason: cr.reason,
        },
      });
    }
  }

  // 10. EDITORIAL GUIDES (Simple Friendly Guides)
  const guidesList = [
    {
      title: 'Easy Guide to Office & Smart Casual Wear',
      slug: 'business-casual-guide',
      category: 'occasion',
      excerpt: 'Learn how to dress smart and comfortable for office work and weekend outings.',
      content: 'Smart casual is simple once you know the basics. Pair a crisp cotton button shirt or polo T-shirt with comfortable chino pants or dark blue jeans. Always match your brown belt with brown shoes, or black belt with black shoes for a neat look.',
      seoTitle: 'Smart Casual Dressing Guide | StyleIQ',
      seoDesc: 'Learn easy smart casual dress rules for work and weekends.',
      published: true,
    },
    {
      title: 'Simple Color Matching Guide for Men',
      slug: 'color-matching-guide',
      category: 'style',
      excerpt: 'Learn how to match shirt, pants, and shoes colors effortlessly.',
      content: 'Color matching is easy with basic neutral colors. Keep 60% of your outfit in easy base colors (Navy Blue, Dark Grey, Khaki), 30% in secondary shirt colors (Light Blue, White, Cream), and 10% in shoes and belt accents.',
      seoTitle: 'Men Color Matching Guide | StyleIQ',
      seoDesc: 'Learn easy color matching rules for mens shirts, pants and shoes.',
      published: true,
    },
    {
      title: 'Summer & Warm Weather Dressing Tips',
      slug: 'summer-riviera-guide',
      category: 'season',
      excerpt: 'Stay cool and smart with lightweight cotton, linen pants, and casual shirts.',
      content: 'Beat the heat in style. Wear breathable fabrics like cotton and linen. Pair light green or cream linen pants with casual collar shirts and loafer shoes.',
      seoTitle: 'Summer Dressing Guide | StyleIQ',
      seoDesc: 'Learn easy summer clothes matching tips.',
      published: true,
    },
    {
      title: 'Shoe & Belt Matching Rules',
      slug: 'footwear-belt-matching-guide',
      category: 'accessory',
      excerpt: 'The simple rules for matching shoes, belts, and socks correctly.',
      content: 'Matching your belt color to your shoe color is the most important rule. Dark brown shoes need a dark brown belt, black shoes need a black belt, and casual sneakers go well with casual cloth or braided belts.',
      seoTitle: 'Shoe and Belt Matching Guide | StyleIQ',
      seoDesc: 'Learn how to match leather shoes and belts correctly.',
      published: true,
    },
  ];

  for (const g of guidesList) {
    await prisma.guide.upsert({
      where: { slug: g.slug },
      update: g,
      create: g,
    });
  }
  console.log('Seeded style guides.');

  // 11. STYLE RULES & MISTAKES (Simple Everyday Rules)
  const styleRulesList = [
    {
      title: 'Never Wear a Brown Belt with Black Shoes',
      ruleType: 'donts',
      category: 'accessory',
      explanation: 'Mixing black leather shoes with a brown leather belt looks odd and unmatched. Always match brown belt with brown shoes, and black belt with black shoes.',
    },
    {
      title: 'Always Leave the Bottom Button of a Suit Coat Open',
      ruleType: 'dos',
      category: 'fit',
      explanation: 'Suit coats are designed to fit properly when the bottom button is left unbuttoned. Buttoning it causes folds and restricts movement.',
    },
    {
      title: 'Match Patterned Shirts with Plain Pants',
      ruleType: 'pro-tip',
      category: 'color',
      explanation: 'When wearing a check, line, or printed shirt, pair it with simple plain navy, grey, or khaki pants to keep your outfit looking neat and balanced.',
    },
    {
      title: 'Avoid Short Sports Socks with Formal Suit Pants',
      ruleType: 'donts',
      category: 'occasion',
      explanation: 'Short ankle sports socks look out of place with formal suit pants. Wear formal socks that cover your calf for formal settings.',
    },
    {
      title: 'Match Tie Width to Coat Collar Width',
      ruleType: 'dos',
      category: 'fit',
      explanation: 'Slim collar coats look best with slim ties, while regular collar coats look best with classic width ties.',
    },
    {
      title: 'Never Wear a Casual Collarless Shirt with a Tuxedo Coat',
      ruleType: 'donts',
      category: 'occasion',
      explanation: 'Tuxedos are strictly formal and require a crisp formal dress shirt with formal cuffs.',
    },
  ];

  for (const sr of styleRulesList) {
    const existing = await prisma.styleRule.findFirst({
      where: { title: sr.title },
    });
    if (!existing) {
      await prisma.styleRule.create({ data: sr });
    }
  }
  console.log('Seeded style rules & tips.');

  console.log('StyleIQ Global Database Seeded Successfully!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
