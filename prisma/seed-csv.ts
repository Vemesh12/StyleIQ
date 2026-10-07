import { Prisma, PrismaClient } from '@prisma/client';
import fs from 'fs';
import path from 'path';

const prisma = new PrismaClient();

function parseCsvLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim().replace(/^"|"$/g, ''));
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current.trim().replace(/^"|"$/g, ''));
  return result;
}

async function seedCsv() {
  console.log('Starting CSV seeding into personalization_rules table...');

  const csvFilePath = process.env.RECOMMENDATIONS_CSV_PATH
    ? path.resolve(process.env.RECOMMENDATIONS_CSV_PATH)
    : path.resolve(__dirname, '../../recommendations.csv');
  console.log('Reading CSV from path:', csvFilePath);

  if (!fs.existsSync(csvFilePath)) {
    console.error('CSV file not found at:', csvFilePath);
    return;
  }

  const content = fs.readFileSync(csvFilePath, 'utf8');
  const lines = content.split(/\r?\n/).filter((line) => line.trim().length > 0);
  console.log(`Found ${lines.length} total lines in CSV.`);

  // Clear existing rules
  await prisma.personalizationRule.deleteMany();
  console.log('Cleared existing personalization rules.');

  let batch: Prisma.PersonalizationRuleCreateManyInput[] = [];
  let totalInserted = 0;
  const BATCH_SIZE = 1000;

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    const row = parseCsvLine(line);
    if (row.length < 18) continue;

    batch.push({
      hairColor: row[0],
      eyeColor: row[1],
      skinTone: row[2],
      underTone: row[3],
      torsoLength: row[4],
      bodyProportion: row[5],
      recommendedClothingColors: row[6],
      avoidClothingColors: row[7],
      recommendedFittingStyle: row[8],
      recommendedMaterials: row[9],
      recommendedPatterns: row[10],
      recommendedJewelryMetal: row[11],
      recommendedShoes: row[12],
      recommendedClothingColorWheelRegion: row[13],
      avoidClothingColorWheelRegion: row[14],
      fabricNature: row[15],
      dontExaggerate: row[16],
      doExaggerate: row[17],
    });

    if (batch.length >= BATCH_SIZE) {
      await prisma.personalizationRule.createMany({
        data: batch,
      });
      totalInserted += batch.length;
      console.log(`Inserted ${totalInserted} / ${lines.length - 1} rules...`);
      batch = [];
    }
  }

  if (batch.length > 0) {
    await prisma.personalizationRule.createMany({
      data: batch,
    });
    totalInserted += batch.length;
  }

  console.log(`🎉 Successfully inserted ${totalInserted} personalization rules into PostgreSQL!`);
}

seedCsv()
  .catch((e) => {
    console.error('Error seeding CSV:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
