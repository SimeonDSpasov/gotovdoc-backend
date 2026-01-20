import { RequestHandler } from 'express';

import fs from 'fs';
import PizZip from "pizzip";
import Docxtemplater from "docxtemplater";
import { Readable } from 'stream';
import { pipeline } from 'stream/promises';
import archiver from 'archiver';

import logger from '@ipi-soft/logger';

import CustomError from './../utils/custom-error.utils';
import FileStorageUtil from './../utils/file-storage.util';
import LibreOfficeConverter from './../utils/libreoffice-converter.util';
import TemplateCacheUtil from './../utils/template-cache.util';

import DocumentDataLayer from './../data-layers/document.data-layer';
import OrderDataLayer from './../data-layers/order.data-layer';

import { DocumentType } from './../models/document.model';
import { EmailType, EmailUtil } from './../utils/email.util';
import Config from './../config';

export default class CapitalRevaluationController {

  private logContext = 'Capital Revaluation Controller';

  private documentDataLayer = DocumentDataLayer.getInstance();
  private orderDataLayer = OrderDataLayer.getInstance();
  private fileStorageUtil = FileStorageUtil.getInstance();
  private emailUtil = EmailUtil.getInstance();
  private config = Config.getInstance();

  private static readonly templateName = 'revaluation-pulnomoshtno.docx';
  private static readonly warmTemplate = TemplateCacheUtil.preload(
    CapitalRevaluationController.templateName
  ).catch((err: unknown) => {
    const message = err instanceof Error ? err.message : String(err);
    logger.error(message, 'CapitalRevaluationController -> TemplateCache preload');
  });

  /**
   * Generate power of attorney for capital revaluation
   * 
   * Template fields mapping:
   * - {three_names} -> managerFullName
   * - {egn} -> managerEgn
   * - {grad} -> city
   * - {company name} -> companyName
   * - {company type} -> companyType
   * - {id of the company} -> companyEik
   * - {date} -> date
   * - {town} -> city
   */
  public generatePowerOfAttorney: RequestHandler = async (req, res) => {
    const logContext = `${this.logContext} -> generatePowerOfAttorney()`;

    const {
      managerFullName,
      managerEgn,
      managerAddress,
      companyName,
      companyType,
      companyEik,
      city,
      date
    } = req.body;

    // Validation
    if (!managerFullName || !managerEgn || !managerAddress || !companyName || !companyType || !companyEik || !city) {
      throw new CustomError(
        400,
        'Missing required fields: managerFullName, managerEgn, managerAddress, companyName, companyType, companyEik, city'
      );
    }

    // Generate current date in Bulgarian format if not provided
    const currentDate = date || new Date().toLocaleDateString('bg-BG', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    });

    // Map frontend data to template placeholders
    const documentData = {
      'three_names': managerFullName,
      'egn': managerEgn,
      'grad': city,
      'company name': companyName,
      'company type': companyType,
      'id of the company': companyEik,
      'date': currentDate,
      'town': city,
    };
    // Save document to database
    await this.documentDataLayer.create(
      {
        type: DocumentType.PowerOfAttorney,
        data: {
          managerFullName,
          managerEgn,
          managerAddress,
          companyName,
          companyType,
          companyEik,
          city,
          date: currentDate,
        },
      },
      logContext
    );


    // Wait for template to be cached
    await CapitalRevaluationController.warmTemplate;

    // Get template from cache
    const templateBuffer = await TemplateCacheUtil.getTemplate(
      CapitalRevaluationController.templateName
    );

    // Fill template with data
    const filledDocx = CapitalRevaluationController.renderTemplate(templateBuffer, documentData);

    // Convert to PDF
    let pdfStream: Readable;
    try {
      pdfStream = await LibreOfficeConverter.docxBufferToPdfStream(filledDocx);
    } catch (err) {
      throw new CustomError(
        500,
        (err as Error)?.message ?? 'Failed to convert DOCX to PDF',
        `${logContext} -> convertToPdf`
      );
    }

    // Set response headers
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="pulnomoshtno-${companyEik}.pdf"`);

    // Stream PDF to response
    await pipeline(pdfStream, res);
  }

  /**
   * Download previously generated power of attorney (requires payment)
   * TODO: Add authentication
   */
  public downloadPowerOfAttorney: RequestHandler = async (req, res) => {
    const { orderId } = req.params;
    const logContext = `${this.logContext} -> downloadPowerOfAttorney()`;

    // Verify payment was completed
    const document = await this.documentDataLayer.getById(orderId, logContext);

    if (!(document.orderData as any)?.paid) {
      throw new CustomError(403, 'Payment required to download document');
    }

    // Wait for template to be cached
    await CapitalRevaluationController.warmTemplate;

    // Get template from cache
    const templateBuffer = await TemplateCacheUtil.getTemplate(
      CapitalRevaluationController.templateName
    );

    // Map stored data to template placeholders
    const storedData = document.data as any;
    const documentData = {
      'three_names': storedData.managerFullName,
      'egn': storedData.managerEgn,
      'grad': storedData.city,
      'company name': storedData.companyName,
      'company type': storedData.companyType,
      'id of the company': storedData.companyEik,
      'date': storedData.date || new Date().toLocaleDateString('bg-BG', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
      }),
      'town': storedData.city,
    };


    // Fill template with data
    const filledDocx = CapitalRevaluationController.renderTemplate(templateBuffer, documentData);

    // Convert to PDF
    let pdfStream: Readable;
    try {
      pdfStream = await LibreOfficeConverter.docxBufferToPdfStream(filledDocx);
    } catch (err) {
      throw new CustomError(
        500,
        (err as Error)?.message ?? 'Failed to convert DOCX to PDF',
        `${logContext} -> convertToPdf`
      );
    }

    // Set response headers
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="pulnomoshtno-${storedData.companyEik}.pdf"`);

    // Stream PDF to response
    await pipeline(pdfStream, res);
  }


  /**
   * Render docx template with data
   */
  /**
   * Create order for capital revaluation with file upload
   */
  public createOrder: RequestHandler = async (req, res) => {
    const logContext = `${this.logContext} -> createOrder()`;
    const {
      email,
      firstName,
      lastName,
      phone,
      companyName,
      companyEik,
      notes,
      includeRegistration
    } = req.body;

    // Validate required fields
    if (!email || !firstName || !lastName || !phone || !companyName || !companyEik) {
      throw new CustomError(400, 'Missing required fields');
    }

    const files = (req.files as Express.Multer.File[]) || [];
    // Files are optional now (e.g. for physical delivery)
    // if (!files || files.length === 0) {
    //   throw new CustomError(400, 'At least one file is required');
    // }

    // Upload files to GridFS
    const uploadedFiles = [];

    for (const file of files) {
      const fileStream = fs.createReadStream(file.path);
      const fileId = await this.fileStorageUtil.uploadFile(
        fileStream,
        file.originalname,
        file.mimetype
      );

      uploadedFiles.push({
        fileId: fileId,
        filename: file.originalname,
        mimetype: file.mimetype,
        size: file.size
      });

      // Clean up temp file
      fs.unlinkSync(file.path);
    }

    // Create Order
    let price = 0.4; // Base price for documents
    if (includeRegistration === 'true' || includeRegistration === true) {
      price += 0.2; // Add 0.20 EUR for registration
    }

    const vat = price * 0.2;
    const total = price + vat;
    const orderId = `ORD-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

    const order = await this.orderDataLayer.create({
      orderId,
      userUploadedFiles: uploadedFiles,
      subtotal: 0.5,
      vat: 0,
      total: 0.5,
      expectedAmount: 0.5,
      currency: 'EUR',
      status: 'pending',
      items: [{
        id: 'capital-revaluation',
        type: 'package',
        name: 'Capital Revaluation',
        description: `Capital Revaluation for ${companyName}`,
        price: 0.5,
        formData: {
          companyName,
          companyEik,
          notes,
          uploadedFiles
        }
      }],
      customerData: {
        email,
        firstName,
        lastName,
        phone,
        ip: req.ip
      },
      documentsGenerated: false,
      documentsSent: false,
      deliveryMethod: uploadedFiles.length > 0 ? 'upload' : 'physical'
    }, logContext);

    const host = req.get('host');
    const baseUrl = host ? `${req.protocol}://${host}` : '';
    const hasUploads = uploadedFiles.length > 0;
    const includeRegistrationLabel = includeRegistration === 'true' || includeRegistration === true ? 'Да' : 'Не';

    const emailData = {
      toEmail: this.config.infoAccountEmail,
      subject: 'Нова поръчка: Преоценка на капитала',
      template: 'new-order',
      payload: {
        orderId: order.orderId,
        createdAt: new Date().toLocaleString('bg-BG'),
        customerName: `${firstName} ${lastName}`,
        customerEmail: email,
        customerPhone: phone,
        companyName,
        companyEik,
        notes: notes || '—',
        includeRegistration: includeRegistrationLabel,
        deliveryMethod: hasUploads ? 'Качени файлове' : 'Физическо предаване',
        hasUploads,
        downloadAllUrl: hasUploads && baseUrl
          ? `${baseUrl}/api/capital-revaluation/order/${order.orderId}/uploads`
          : '',
        uploadedFiles: uploadedFiles.map((file) => ({
          filename: file.filename,
          size: file.size,
          mimetype: file.mimetype,
          downloadUrl: baseUrl
            ? `${baseUrl}/api/capital-revaluation/order/${order.orderId}/uploads/${file.fileId}`
            : '',
        })),
      },
    };

    this.emailUtil.sendEmail(emailData, EmailType.Info, logContext)
      .catch((err: any) => logger.error(`Failed to send new order email: ${err.message}`, logContext));

    res.status(201).json({
      success: true,
      data: order
    });
  }

  // Admin Download for requirement files/
  public downloadOrderFile: RequestHandler = async (req, res) => {
    const logContext = `${this.logContext} -> downloadOrderFile`;

    const id = req.body?.orderId || req.params?.orderId || req.query?.orderId;

    if (!id) {
      throw new CustomError(400, 'Order id is missing.');
    }

    const order = String(id).startsWith('ORD-')
      ? await this.orderDataLayer.getByOrderId(String(id), logContext)
      : await this.orderDataLayer.getById(String(id), logContext);

    const orderObj = order.toObject();
    const files = CapitalRevaluationController.collectUploadedFiles(orderObj);

    if (files.length === 0) {
      throw new CustomError(404, 'No files found for this order.');
    }

    const orderedFiles = files
      .map((file, index) => ({ ...file, orderIndex: index }))
      .sort((a, b) => {
        if (a.uploadedAt && b.uploadedAt) {
          return new Date(a.uploadedAt).getTime() - new Date(b.uploadedAt).getTime();
        }
        return a.orderIndex - b.orderIndex;
      });

    const archive = archiver('zip', { zlib: { level: 9 } });
    const baseName = orderObj.orderId || orderObj._id?.toString?.() || 'order';

    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename="${baseName}-uploads.zip"`);

    archive.pipe(res);

    for (const [index, file] of orderedFiles.entries()) {
      if (!file?.fileId) {
        continue;
      }

      const fileStream = await this.fileStorageUtil.downloadFile(String(file.fileId));
      const safeName = file.filename || `file-${index + 1}`;
      const numberedName = `${String(index + 1).padStart(2, '0')}-${safeName}`;

      archive.append(fileStream, { name: numberedName });
    }

    await new Promise<void>((resolve, reject) => {
      archive.on('error', reject);
      res.on('finish', resolve);
      archive.finalize();
    });
  }

  public downloadOrderSingleFile: RequestHandler = async (req, res) => {
    const logContext = `${this.logContext} -> downloadOrderSingleFile`;

    const id = req.body?.orderId;
    const fileId = req.body?.fileId;

    if (!id) {
      throw new CustomError(400, 'Order id is missing.');
    }

    if (!fileId) {
      throw new CustomError(400, 'File id is missing.');
    }

    const order = String(id).startsWith('ORD-')
      ? await this.orderDataLayer.getByOrderId(String(id), logContext)
      : await this.orderDataLayer.getById(String(id), logContext);
      

    const orderObj = order.toObject();
    const files = CapitalRevaluationController.collectUploadedFiles(orderObj);
    const target = files.find((file) => String(file?.fileId) === String(fileId));

    if (!target) {
      throw new CustomError(404, 'File not found for this order.');
    }

    const fileStream = await this.fileStorageUtil.downloadFile(String(target.fileId));

    res.setHeader('Content-Type', target.mimetype || 'application/octet-stream');
    res.setHeader('Content-Disposition', `attachment; filename="${target.filename || 'download'}"`);

    await pipeline(fileStream, res);
  }

  private static collectUploadedFiles(order: any): Array<{
    fileId: string;
    filename?: string;
    mimetype?: string;
    size?: number;
    uploadedAt?: Date;
  }> {
    const uploads: Array<any> = [];

    if (Array.isArray(order?.userUploadedFiles)) {
      order.userUploadedFiles.forEach((file: any) => uploads.push(file));
    }

    const items = Array.isArray(order?.items) ? order.items : [];
    items.forEach((item: any) => {
      const itemUploads = item?.formData?.uploadedFiles;
      if (Array.isArray(itemUploads)) {
        itemUploads.forEach((file: any) => uploads.push(file));
      }
    });

    const uniqueById = new Map<string, any>();
    uploads.forEach((file) => {
      const fileId = file?.fileId?.toString ? file.fileId.toString() : String(file.fileId);
      if (fileId && !uniqueById.has(fileId)) {
        uniqueById.set(fileId, file);
      }
    });

    return Array.from(uniqueById.values());
  }

  private static renderTemplate(templateBuffer: Buffer, data: Record<string, unknown>): Buffer {
    const zip = new PizZip(templateBuffer);
    const doc = new Docxtemplater(zip, { paragraphLoop: true, linebreaks: true });
    doc.render(data);
    return doc.getZip().generate({ type: "nodebuffer" });
  }
}
