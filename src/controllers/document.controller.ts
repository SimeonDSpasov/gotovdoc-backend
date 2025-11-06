import { RequestHandler } from 'express';

import PizZip from "pizzip";
import Docxtemplater from "docxtemplater";
import { Readable } from 'stream';
import { pipeline } from 'stream/promises';
import logger from '@ipi-soft/logger';
// Footer disabled for performance testing
// import PdfFooterUtil from '../utils/pdf-footer.util';
import LibreOfficeConverter from '../utils/libreoffice-converter.util';
import TemplateCacheUtil from '../utils/template-cache.util';

import CustomError from '../utils/custom-error.utils';
import DocumentDataLayer from '../data-layers/document.data-layer';
import { DocumentType } from '../models/document.model';

export default class DocumentController {
  
  private logContext = 'Document Controller';
  private documentDataLayer = DocumentDataLayer.getInstance();

  private static readonly templateName = 'speciment.docx';
  private static readonly warmTemplate = TemplateCacheUtil.preload(DocumentController.templateName).catch((err: unknown) => {
    const message = err instanceof Error ? err.message : String(err);
    logger.error(message, 'DocumentController -> TemplateCache preload');
  });
  private static readonly warmFooter = Promise.resolve();

  public generateSpeciment: RequestHandler = async (req, res) => {
    const { three_names, egn, id_number, id_year, id_issuer, company_name, company_adress, email } = req.body;

    if (!three_names || !egn || !id_number || !id_year || !id_issuer || !company_name || !company_adress || !email) {
      throw new CustomError(400, 'Missing fields: three_names | egn | id_number | id_year | id_issuer | company_name | company_adress | email');
    }
  
    const documentData = {
      three_names,
      egn,
      id_number,
      id_year,
      id_issuer,
      company_name,
      company_adress,
    };

    await this.documentDataLayer.create(
      {
        type: DocumentType.Speciment,
        data: documentData,
        orderData: {
          email,
          cost: 0,
        },
      },
      this.logContext
    );

    await Promise.allSettled([
      DocumentController.warmTemplate,
      DocumentController.warmFooter,
    ]);

    const templateBuffer = await TemplateCacheUtil.getTemplate(DocumentController.templateName);

    const filledDocx = DocumentController.renderTemplate(templateBuffer, documentData);
  
    let pdfStream: Readable;
    try {
      pdfStream = await LibreOfficeConverter.docxBufferToPdfStream(filledDocx);
    } catch (err) {
      throw new CustomError(500, (err as Error)?.message ?? 'Failed to convert DOCX to PDF', `${this.logContext} -> convertToPdf`);
    }

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="document.pdf"`);

    await pipeline(pdfStream, res);
  }

  private static renderTemplate(templateBuffer: Buffer, data: Record<string, unknown>): Buffer {
    const zip = new PizZip(templateBuffer);
    const doc = new Docxtemplater(zip, { paragraphLoop: true, linebreaks: true });
    doc.render(data);
    return doc.getZip().generate({ type: "nodebuffer" });
  }
}
