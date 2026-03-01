/**
 * Script to parse the НКПД-2011 PDF and seed data into MongoDB.
 * Only imports actual occupations (rows with two code columns),
 * skipping category/subcategory headers.
 *
 * Prerequisites: pdftotext (from poppler) must be installed.
 *   macOS: brew install poppler
 *
 * Usage:
 *   npx ts-node src/scripts/parse-nkpd-pdf.ts <path-to-pdf>
 *
 * Example:
 *   npx ts-node src/scripts/parse-nkpd-pdf.ts /tmp/nkpd-occupations.pdf
 */
import { execSync } from 'child_process';
import * as fs from 'fs';
import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

interface NkpdEntry {
  code: string;
  name: string;
  groupCode: string;
}

function parsePdf(pdfPath: string): NkpdEntry[] {
  console.log(`Extracting text from: ${pdfPath}`);
  const rawText = execSync(`pdftotext -layout "${pdfPath}" -`, { maxBuffer: 50 * 1024 * 1024 }).toString('utf-8');

  const lines = rawText.split('\n');
  const entries: NkpdEntry[] = [];

  // Only match occupation lines: 4-digit group + 4-digit specific + name
  const occupationRegex = /^\s*(\d{4})\s+(\d{4})\s+(.+)$/;

  let skippedHeader = false;

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    // Skip the header lines (title, column headers)
    if (!skippedHeader) {
      if (trimmed.startsWith('Код') || trimmed.startsWith('Приложение') ||
          trimmed.startsWith('СПИСЪК') || trimmed.startsWith('В НАЦИОНАЛНАТА')) {
        continue;
      }
      if (/^\d/.test(trimmed)) {
        skippedHeader = true;
      } else {
        continue;
      }
    }

    // Only match lines with two code columns (actual occupations)
    const occMatch = line.match(occupationRegex);
    if (occMatch) {
      const groupCode = occMatch[1];
      const specificCode = occMatch[2];
      const name = occMatch[3].trim();
      entries.push({
        code: groupCode + specificCode,
        name,
        groupCode,
      });
    }
  }

  return entries;
}

async function seedToMongoDB(entries: NkpdEntry[]): Promise<void> {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error('MONGODB_URI env variable is not set. Check your .env file.');
    process.exit(1);
  }

  const dbName = process.env.Project_ENV === 'prod'
    ? 'gotovdoc-prod'
    : process.env.Project_ENV === 'test'
      ? 'gotovdoc-test'
      : 'gotovdoc-dev';

  console.log(`\nConnecting to MongoDB (${dbName})...`);
  await mongoose.connect(uri);
  const db = mongoose.connection.useDb(dbName);

  const NkpdOccupation = db.model('NkpdOccupation', new mongoose.Schema({
    code: { type: String, required: true, index: true },
    name: { type: String, required: true },
    groupCode: { type: String, required: true },
  }, {
    timestamps: true,
    collection: 'nkpd_occupations',
  }));

  // Check existing count
  const existingCount = await NkpdOccupation.countDocuments();
  if (existingCount > 0) {
    console.log(`Collection already has ${existingCount} documents. Dropping and re-seeding...`);
    await NkpdOccupation.deleteMany({});
  }

  // Insert in batches
  const BATCH_SIZE = 500;
  let inserted = 0;

  for (let i = 0; i < entries.length; i += BATCH_SIZE) {
    const batch = entries.slice(i, i + BATCH_SIZE);
    await NkpdOccupation.insertMany(batch, { ordered: false });
    inserted += batch.length;
    console.log(`  Inserted ${inserted}/${entries.length}...`);
  }

  // Create indexes for search
  await NkpdOccupation.collection.createIndex({ name: 'text' });

  console.log(`\nSeeded ${inserted} occupations into '${dbName}.nkpd_occupations'`);

  await mongoose.disconnect();
}

// Main
(async () => {
  const pdfPath = process.argv[2];
  if (!pdfPath) {
    console.error('Usage: npx ts-node src/scripts/parse-nkpd-pdf.ts <path-to-pdf>');
    process.exit(1);
  }

  if (!fs.existsSync(pdfPath)) {
    console.error(`File not found: ${pdfPath}`);
    process.exit(1);
  }

  const entries = parsePdf(pdfPath);

  console.log(`\nParsed ${entries.length} occupations (skipped category headers)`);

  console.log(`\nFirst 5:`);
  entries.slice(0, 5).forEach(e => console.log(`  ${e.groupCode} ${e.code.slice(4)} | ${e.name}`));

  console.log(`\nLast 5:`);
  entries.slice(-5).forEach(e => console.log(`  ${e.groupCode} ${e.code.slice(4)} | ${e.name}`));

  await seedToMongoDB(entries);

  console.log('\nDone!');
  process.exit(0);
})();
