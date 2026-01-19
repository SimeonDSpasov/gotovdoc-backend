import { RequestHandler } from 'express';

import PizZip from "pizzip";
import Docxtemplater from "docxtemplater";
import { Readable } from 'stream';
import { pipeline } from 'stream/promises';
import logger from '@ipi-soft/logger';
// Footer disabled for performance testing
// import PdfFooterUtil from '../utils/pdf-footer.util';
import LibreOfficeConverter from './../utils/libreoffice-converter.util';
import TemplateCacheUtil from './../utils/template-cache.util';

import CustomError from './../utils/custom-error.utils';
import DocumentDataLayer from './../data-layers/document.data-layer';
import { DocumentType } from './../models/document.model';
import MyPosService from './../services/mypos.service';
import { EmailType, EmailUtil } from './../utils/email.util';

export default class DocumentController {
  
  private logContext = 'Document Controller';
  private documentDataLayer = DocumentDataLayer.getInstance();
  private myposService = MyPosService.getInstance();
  private emailUtil = EmailUtil.getInstance();

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

    const logContext = `${this.logContext} -> generateSpeciment()`;
  
    const documentData = {
      three_names,
      egn,
      id_number,
      id_year,
      id_issuer,
      company_name,
      company_adress,
      email,
    };

    // Save document to database
    await this.documentDataLayer.create(
      {
        type: DocumentType.Speciment,
        data: documentData,
      },
      logContext
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
      throw new CustomError(500, (err as Error)?.message ?? 'Failed to convert DOCX to PDF', `${logContext} -> convertToPdf`);
    }

    const pdfBuffer = await DocumentController.streamToBuffer(pdfStream);

    const emailData = {
      toEmail: email,
      subject: 'Вашият документ е генериран',
      template: 'document-generated',
      payload: {
        fullName: three_names,
        companyName: company_name,
        documentName: 'Спесимент',
      },
      attachments: [
        {
          filename: 'specimen-document.pdf',
          content: pdfBuffer,
          contentType: 'application/pdf',
        },
      ],
    };

    this.emailUtil.sendEmail(emailData, EmailType.Info, this.logContext)
      .catch((err: any) => logger.error(`Failed to send document email: ${err.message}`, this.logContext));

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="specimen-document.pdf"`);
    res.end(pdfBuffer);
  }

  public downloadDocument: RequestHandler = async (req, res) => {
    const { orderId } = req.params;

    const logContext = `${this.logContext} -> downloadDocument()`;

    // Verify payment was completed
    const document = await this.documentDataLayer.getById(orderId, logContext);

    if (!(document.orderData as any)?.paid) {
      throw new CustomError(403, 'Payment required to download document');
    }

    await Promise.allSettled([
      DocumentController.warmTemplate,
      DocumentController.warmFooter,
    ]);

    const templateBuffer = await TemplateCacheUtil.getTemplate(DocumentController.templateName);
    const filledDocx = DocumentController.renderTemplate(templateBuffer, document.data);
  
    let pdfStream: Readable;
    try {
      pdfStream = await LibreOfficeConverter.docxBufferToPdfStream(filledDocx);
    } catch (err) {
      throw new CustomError(500, (err as Error)?.message ?? 'Failed to convert DOCX to PDF', `${logContext} -> convertToPdf`);
    }

    const recipientEmail = document.data?.email;

    if (!recipientEmail) {
      throw new CustomError(400, 'Email is missing for this document');
    }

    const pdfBuffer = await DocumentController.streamToBuffer(pdfStream);

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="specimen-document.pdf"`);

    res.end(pdfBuffer);
  }

  private static renderTemplate(templateBuffer: Buffer, data: Record<string, unknown>): Buffer {
    const zip = new PizZip(templateBuffer);
    const doc = new Docxtemplater(zip, { paragraphLoop: true, linebreaks: true });
    doc.render(data);
    return doc.getZip().generate({ type: "nodebuffer" });
  }

  private static streamToBuffer(stream: Readable): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const chunks: Buffer[] = [];
      stream.on('data', (chunk) => {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
      });
      stream.on('error', reject);
      stream.on('end', () => resolve(Buffer.concat(chunks)));
    });
  }
}
