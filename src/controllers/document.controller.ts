import { RequestHandler } from 'express';

import fs from 'fs';
import path from 'path';
import PizZip from "pizzip";
import Docxtemplater from "docxtemplater";
import { Readable } from 'stream';
import { pipeline } from 'stream/promises';
import PQueue from 'p-queue';
import logger from '@ipi-soft/logger';
import PdfFooterUtil from '../utils/pdf-footer.util';
import LibreOfficeConverter from '../utils/libreoffice-converter.util';

import CustomError from '../utils/custom-error.utils';

export default class DocumentController {
  
  private logContext = 'Document Controller';

  private static readonly templatePath = path.join(process.cwd(), "src/assets/docs", "speciment.docx");
  private static readonly templateBuffer = DocumentController.loadTemplate();
  private static readonly warmFooter = PdfFooterUtil.preload().catch((err: unknown) => {
    const message = err instanceof Error ? err.message : String(err);
    logger.error(message, 'DocumentController -> PdfFooterUtil.preload');
  });

  private static conversionQueue = new PQueue({
    concurrency: Number(process.env.DOC_CONVERSION_CONCURRENCY ?? 1) || 1,
  });

  private static conversionTimeoutMs = Number(process.env.DOC_CONVERSION_TIMEOUT_MS ?? 120000) || 120000;

  public generateSpeciment: RequestHandler = async (req, res) => {
    const { three_names, egn, id_number, id_year, id_issuer, company_name, company_adress } = req.body;

    if (!three_names || !egn || !id_number || !id_year || !id_issuer || !company_name || !company_adress) {
      throw new CustomError(400, 'Missing fields: three_names | egn | id_number | id_year | id_issuer | company_name | company_adress');
    }
  
    const filledDocx = DocumentController.renderTemplate({
      three_names,
      egn,
      id_number,
      id_year,
      id_issuer,
      company_name,
      company_adress,
    });
  
    let pdfStream: Readable;
    try {
      pdfStream = await DocumentController.conversionQueue.add(
        () => LibreOfficeConverter.docxBufferToPdfStream(filledDocx),
        {
          timeout: DocumentController.conversionTimeoutMs,
          throwOnTimeout: true,
        },
      );
    } catch (err) {
      throw new CustomError(500, (err as Error)?.message ?? 'Failed to convert DOCX to PDF', `${this.logContext} -> convertToPdf`);
    }

    const finalizedPdf = await PdfFooterUtil.addFooterFromStream(pdfStream).catch((err) => {
      throw new CustomError(500, (err as Error)?.message, `${this.logContext} -> addFooter`);
    });

    if (!finalizedPdf) {
      throw new CustomError(500, 'Failed to add footer to PDF', `${this.logContext} -> addFooter`);
    }

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="document.pdf"`);

    const stream = Readable.from(finalizedPdf);
    await pipeline(stream, res);
  }

  private static loadTemplate(): Buffer {
    try {
      return fs.readFileSync(this.templatePath);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      logger.error(message, 'DocumentController -> loadTemplate');
      throw err;
    }
  }

  private static renderTemplate(data: Record<string, unknown>): Buffer {
    const zip = new PizZip(this.templateBuffer);
    const doc = new Docxtemplater(zip, { paragraphLoop: true, linebreaks: true });
    doc.render(data);
    return doc.getZip().generate({ type: "nodebuffer" });
  }
}
