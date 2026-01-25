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
import UserDataLayer from './../data-layers/user.data-layer';
import OrderDataLayer from './../data-layers/order.data-layer';
import { EmailType, EmailUtil } from './../utils/email.util';
import {
  DOCUMENT_GENERATORS,
  DocumentRequestType,
} from './../config/document-templates.config';

export default class DocumentController {
  
  private logContext = 'Document Controller';
  private documentDataLayer = DocumentDataLayer.getInstance();
  private emailUtil = EmailUtil.getInstance();
  private userDataLayer = UserDataLayer.getInstance();
  private orderDataLayer = OrderDataLayer.getInstance();

  private static readonly warmTemplates: Record<DocumentRequestType, Promise<void>> = Object.entries(
    DOCUMENT_GENERATORS
  ).reduce((acc, [key, config]) => {
    acc[key as DocumentRequestType] = TemplateCacheUtil.preload(config.templateName).catch((err: unknown) => {
      const message = err instanceof Error ? err.message : String(err);
      logger.error(message, `DocumentController -> TemplateCache preload -> ${config.templateName}`);
    });
    return acc;
  }, {} as Record<DocumentRequestType, Promise<void>>);
  private static readonly warmFooter = Promise.resolve();

  public generateSpeciment: RequestHandler = async (req, res) => {
    await this.generateByType('speciment', req, res);
  }

  public downloadDocument: RequestHandler = async (req, res) => {
    const { orderId } = req.params;

    const logContext = `${this.logContext} -> downloadDocument()`;

    // Verify payment was completed
    const document = await this.documentDataLayer.getById(orderId, logContext);
    if (!document.orderId) {
      throw new CustomError(403, 'Payment required to download document');
    }

    const order = await this.orderDataLayer.getById(document.orderId.toString(), logContext);

    if (order.status !== 'paid' && order.status !== 'finished') {
      throw new CustomError(403, 'Payment required to download document');
    }

    const configEntry = Object.entries(DOCUMENT_GENERATORS).find(
      ([, config]) => config.type === document.type
    );

    if (!configEntry) {
      throw new CustomError(400, 'Unsupported document type for download');
    }

    const [documentKey, config] = configEntry as [DocumentRequestType, (typeof DOCUMENT_GENERATORS)[DocumentRequestType]];

    await Promise.allSettled([
      DocumentController.warmTemplates[documentKey],
      DocumentController.warmFooter,
    ]);

    const templateBuffer = await TemplateCacheUtil.getTemplate(config.templateName);
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

    const activityUserId = order.userId || req.user?._id;

    if (activityUserId) {
      this.userDataLayer.appendActivity(
        activityUserId,
        {
          type: 'document_downloaded',
          documentId: document._id,
          orderId: (document.data as any)?.orderId,
          documentName: config.documentName,
          createdAt: new Date(),
        },
        logContext
      ).catch((err: any) => logger.error(`Failed to store activity: ${err.message}`, logContext));
    }

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="${config.fileName}"`);

    res.end(pdfBuffer);
  }

  public generateMpsPowerOfAttorney: RequestHandler = async (req, res) => {
    await this.generateByType('mps_power_of_attorney', req, res);
  }

  public generateLeaveRequest: RequestHandler = async (req, res) => {
    await this.generateByType('leave_request', req, res);
  }

  public generateDocument: RequestHandler = async (req, res) => {
    const { type } = req.body;

    if (!type || typeof type !== 'string') {
      throw new CustomError(400, 'Missing document type');
    }

    await this.generateByType(type as DocumentRequestType, req, res);
  }

  private async generateByType(type: DocumentRequestType, req: any, res: any): Promise<void> {
    const config = DOCUMENT_GENERATORS[type];

    if (!config) {
      throw new CustomError(400, 'Unsupported document type');
    }

    const logContext = `${this.logContext} -> generateByType(${type})`;
    const documentData = { ...req.body };

    delete documentData.type;

    const missingFields = config.requiredFields.filter((field) => !documentData[field]);
    if (missingFields.length > 0) {
      throw new CustomError(400, `Missing fields: ${missingFields.join(' | ')}`);
    }

    if (config.validate) {
      config.validate(documentData);
    }

    const document = await this.documentDataLayer.create(
      {
        type: config.type,
        data: documentData,
        userId: req.user?._id,
      },
      logContext
    );

    const orderId = `ORD-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    const order = await this.orderDataLayer.create(
      {
        orderId,
        documentId: document._id,
        userId: req.user?._id,
        items: [
          {
            id: config.orderItem.id,
            type: 'document',
            name: config.orderItem.name,
            description: config.orderItem.description,
            price: 0,
            formData: documentData,
          },
        ],
        subtotal: 0,
        vat: 0,
        total: 0,
        expectedAmount: 0,
        currency: 'EUR',
        status: 'finished',
        customerData: {
          email: documentData.email,
          firstName: req.user?.firstName,
          lastName: req.user?.lastName,
          ip: req.ip || req.connection.remoteAddress,
        },
        documentsGenerated: true,
        documentsSent: false,
      },
      logContext
    );

    await this.documentDataLayer.update(
      document._id,
      {
        orderId: order._id,
        userId: req.user?._id,
      },
      logContext
    );

    const activityUserId = req.user?._id;

    if (activityUserId) {
      this.userDataLayer.appendActivity(
        activityUserId,
        {
          type: 'document_generated',
          documentId: document._id,
          documentName: config.documentName,
          createdAt: new Date(),
        },
        logContext
      ).catch((err: any) => logger.error(`Failed to store activity: ${err.message}`, logContext));
    }

    await Promise.allSettled([
      DocumentController.warmTemplates[type],
      DocumentController.warmFooter,
    ]);

    const templateBuffer = await TemplateCacheUtil.getTemplate(config.templateName);

    const filledDocx = DocumentController.renderTemplate(templateBuffer, documentData);

    let pdfStream: Readable;
    try {
      pdfStream = await LibreOfficeConverter.docxBufferToPdfStream(filledDocx);
    } catch (err) {
      throw new CustomError(500, (err as Error)?.message ?? 'Failed to convert DOCX to PDF', `${logContext} -> convertToPdf`);
    }

    const pdfBuffer = await DocumentController.streamToBuffer(pdfStream);

    const emailData = {
      toEmail: documentData.email,
      subject: 'Вашият документ е генериран',
      template: 'document-generated',
      payload: config.getEmailPayload(documentData),
      attachments: [
        {
          filename: config.fileName,
          content: pdfBuffer,
          contentType: 'application/pdf',
        },
      ],
    };

    this.emailUtil.sendEmail(emailData, EmailType.Info, this.logContext)
      .catch((err: any) => logger.error(`Failed to send document email: ${err.message}`, this.logContext));

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="${config.fileName}"`);
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
