/**
 * Script to generate sample/образец preview images for all document types.
 * Run with: npx tsx src/scripts/generate-samples.ts
 *
 * Prerequisites:
 * - LibreOffice must be installed
 * - GraphicsMagick or ImageMagick must be installed (for pdf2pic)
 */
import SampleGenerator from '../utils/sample-generator.util';

async function main() {
 console.log('Generating sample document images...\n');
 await SampleGenerator.generateAll();
 console.log('\nDone! Sample images saved to src/assets/samples/');
}

main()
 .then(() => process.exit(0))
 .catch((err) => {
  console.error('Failed to generate samples:', err);
  process.exit(1);
 });
