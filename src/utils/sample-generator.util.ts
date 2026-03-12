import { promises as fs } from 'fs';
import path from 'path';
import sharp from 'sharp';
import { fromBuffer } from 'pdf2pic';

import logger from '@ipi-soft/logger';

import { SAMPLE_DATA } from './../config/sample-data.config';
import {
 DOCUMENT_GENERATORS,
 DocumentRequestType,
 toBulgarianDate,
} from './../config/document-templates.config';
import DocumentController from './../controllers/document.controller';
import TemplateCacheUtil from './template-cache.util';
import LibreOfficeConverter from './libreoffice-converter.util';

const SAMPLES_DIR = path.join(process.cwd(), 'src', 'assets', 'samples');

const WATERMARK_SVG = Buffer.from(`
 <svg width="1240" height="1754">
  <text x="50%" y="50%"
   text-anchor="middle"
   dominant-baseline="middle"
   transform="rotate(-45, 620, 877)"
   font-size="140"
   font-family="sans-serif"
   fill="rgba(255, 0, 0, 0.25)"
   font-weight="bold">
   ОБРАЗЕЦ
  </text>
 </svg>
`);

export default class SampleGenerator {

 public static async generateSample(type: DocumentRequestType): Promise<Buffer> {
  const config = DOCUMENT_GENERATORS[type];
  const data = structuredClone(SAMPLE_DATA[type]);

  // Run validation (computes derived fields like loan_amount_words, legal_basis, etc.)
  if (config.validate) {
   config.validate(data);
  }

  // Format date fields to Bulgarian format
  if (config.dateFields) {
   for (const field of config.dateFields) {
    if (data[field]) {
     data[field] = toBulgarianDate(data[field]);
    }
   }
  }

  // Prepare render data (sets boolean flags for template conditionals)
  if (config.prepareRenderData) {
   config.prepareRenderData(data);
  }

  // Load and render DOCX template
  const templateBuffer = await TemplateCacheUtil.getTemplate(config.templateName);
  const filledDocx = DocumentController.renderTemplate(templateBuffer, data);

  // Convert DOCX to PDF
  const pdfStream = await LibreOfficeConverter.docxBufferToPdfStream(filledDocx);
  const pdfBuffer = await DocumentController.streamToBuffer(pdfStream);

  // Convert PDF to PNG
  const converter = fromBuffer(pdfBuffer, {
   density: 150,
   format: 'png',
   width: 1240,
   height: 1754,
  });

  const result = await converter(1, { responseType: 'buffer' }); // first page only

  if (!result.buffer) {
   throw new Error(`Failed to convert PDF to PNG for ${type}`);
  }

  // Apply watermark overlay
  const watermarkedPng = await sharp(result.buffer)
   .composite([{ input: WATERMARK_SVG, blend: 'over' }])
   .png({ quality: 80 })
   .toBuffer();

  return watermarkedPng;
 }

 public static async generateAll(): Promise<void> {
  await fs.mkdir(SAMPLES_DIR, { recursive: true });

  const types = Object.keys(DOCUMENT_GENERATORS) as DocumentRequestType[];

  for (const type of types) {
   try {
    logger.info(`Generating sample for: ${type}`, 'SampleGenerator');
    const png = await this.generateSample(type);
    const outputPath = path.join(SAMPLES_DIR, `${type}.png`);
    await fs.writeFile(outputPath, png);
    logger.info(`Saved: ${outputPath}`, 'SampleGenerator');
   } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error(`Failed to generate sample for ${type}: ${message}`, 'SampleGenerator');
   }
  }
 }
}
