import fs from 'fs';
import path from 'path';
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import { Readable } from 'stream';

import fontkit from '@pdf-lib/fontkit';

import sharp from 'sharp';

export class PdfFooterUtil {

 private static initialized = false;
 private static logoPngCache?: Buffer;
 private static unicodeFontBytes?: Buffer;
 private static readonly logoSvgPath = path.join(process.cwd(), 'src/assets/img', 'logo-title.svg');
 private static readonly unicodeFontPath = path.join(process.cwd(), 'src/assets/fonts', 'NotoSans-Regular.ttf');

 private static async ensureInitialized(): Promise<void> {
  if (this.initialized) return;

  // Warm caches synchronously at first call
  if (fs.existsSync(this.logoSvgPath)) {
   const logoSvg = fs.readFileSync(this.logoSvgPath);
 
   this.logoPngCache = await sharp(logoSvg).png().toBuffer();
  }

  if (fs.existsSync(this.unicodeFontPath)) {
   this.unicodeFontBytes = fs.readFileSync(this.unicodeFontPath);
  }
  this.initialized = true;
 }

 public static async preload(): Promise<void> {
  await this.ensureInitialized();
 }

 public static async addFooter(pdfBuffer: Buffer): Promise<Buffer> {
  await this.ensureInitialized();

  const pdfDoc = await PDFDocument.load(pdfBuffer);

  (pdfDoc as any).registerFontkit(fontkit);

  // Embed logo (use cached PNG buffer)
  const pngImage = this.logoPngCache ? await pdfDoc.embedPng(this.logoPngCache) : undefined;

  // Load fonts (Unicode preferred)
  const unicodeFont = this.unicodeFontBytes ? await pdfDoc.embedFont(this.unicodeFontBytes) : undefined;
  const helveticaFont = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontToUse = (unicodeFont ?? helveticaFont);

  const pages = pdfDoc.getPages();

  for (const page of pages) {
   const { width } = page.getSize();

   const leftPadding = 24;
   const rightPadding = 24;
   const bottomPadding = 24;
   const logoTargetWidth = Math.min(70, width * 0.16);
   const logoTargetHeight = pngImage
    ? (pngImage.height / pngImage.width) * logoTargetWidth
    : 0;

   const lineY = bottomPadding + logoTargetHeight + 10;
   page.drawRectangle({ x: 0, y: lineY, width, height: 0.8, color: rgb(0.78, 0.78, 0.78) });

   const logoX = leftPadding;
   const logoY = bottomPadding;

   if (pngImage) {
    page.drawImage(pngImage, { x: logoX, y: logoY, width: logoTargetWidth, height: logoTargetHeight });
   }

   const textCyr = 'gotovdoc.bg — автоматизирано генериране на документи';
   const textAsciiFallback = 'gotovdoc.bg - document generation';
   const text = unicodeFont ? textCyr : textAsciiFallback;
   const baseFontSize = 9;

   const maxTextWidth = width - rightPadding - (logoX + logoTargetWidth + 12);
   let fontSize = baseFontSize;
   let computedWidth = fontToUse.widthOfTextAtSize(text, fontSize);

   if (computedWidth > maxTextWidth) {
    const scale = maxTextWidth / computedWidth;

    fontSize = Math.max(7, Math.floor(baseFontSize * scale));
    computedWidth = fontToUse.widthOfTextAtSize(text, fontSize);
   }

   const textX = width - rightPadding - computedWidth;
   const textY = logoY + (logoTargetHeight - fontSize) / 2 + 2;
   page.drawText(text, { x: textX, y: textY, size: fontSize, font: fontToUse, color: rgb(0.25, 0.25, 0.25) });
  }

  return Buffer.from(await pdfDoc.save());
 }

 private static async streamToBuffer(stream: Readable): Promise<Buffer> {
  const chunks: Buffer[] = [];
  for await (const chunk of stream) {
   chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks);
 }

 public static async addFooterFromStream(stream: Readable): Promise<Buffer> {
  const buffer = await this.streamToBuffer(stream);
  return this.addFooter(buffer);
 }

}

export default PdfFooterUtil;


