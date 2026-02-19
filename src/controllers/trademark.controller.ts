import crypto from 'crypto';
import fs from 'fs';
import { RequestHandler } from 'express';
import PizZip from 'pizzip';
import Docxtemplater from 'docxtemplater';
import { Readable } from 'stream';
import { pipeline } from 'stream/promises';

import logger from '@ipi-soft/logger';

import CustomError from './../utils/custom-error.utils';
import FileStorageUtil from './../utils/file-storage.util';
import LibreOfficeConverter from './../utils/libreoffice-converter.util';
import TemplateCacheUtil from './../utils/template-cache.util';
import { sanitizeObject } from './../utils/sanitize.util';
import {
  parseJsonField,
  validateTrademarkCustomerData,
  validateTrademarkData,
  validateCorrespondenceAddress,
  validatePowerOfAttorneyData,
} from './../utils/trademark-validation.util';
import { calculateTrademarkPrice } from './../config/trademark-pricing.config';

import TrademarkOrderDataLayer from './../data-layers/trademark-order.data-layer';
import DocumentDataLayer from './../data-layers/document.data-layer';
import UserDataLayer from './../data-layers/user.data-layer';

import { DocumentType } from './../models/document.model';
import { EmailType, EmailUtil } from './../utils/email.util';
import Config from './../config';

export default class TrademarkController {

  private logContext = 'Trademark Controller';

  private trademarkOrderDataLayer = TrademarkOrderDataLayer.getInstance();
  private documentDataLayer = DocumentDataLayer.getInstance();
  private userDataLayer = UserDataLayer.getInstance();
  private fileStorageUtil = FileStorageUtil.getInstance();
  private emailUtil = EmailUtil.getInstance();
  private config = Config.getInstance();

  private static readonly poaTemplateName = 'palnomoshno-trademark.docx';
  private static readonly warmTemplate = TemplateCacheUtil.preload(
    TrademarkController.poaTemplateName
  ).catch((err: unknown) => {
    const message = err instanceof Error ? err.message : String(err);
    logger.error(message, 'TrademarkController -> TemplateCache preload');
  });

  /**
   * POST /api/trademark/create-order
   * Public endpoint (guest + auth) -- create a trademark registration order
   */
  public createOrder: RequestHandler = async (req, res) => {
    const logContext = `${this.logContext} -> createOrder()`;

    // ── 1. Parse JSON fields from FormData ──
    const customerData = sanitizeObject(parseJsonField<any>(req.body.customerData, 'customerData'));
    const trademarkData = sanitizeObject(parseJsonField<any>(req.body.trademarkData, 'trademarkData'));
    const correspondenceAddress = sanitizeObject(parseJsonField<any>(req.body.correspondenceAddress, 'correspondenceAddress'));

    let powerOfAttorneyData: any = undefined;
    if (req.body.powerOfAttorneyData) {
      powerOfAttorneyData = sanitizeObject(parseJsonField<any>(req.body.powerOfAttorneyData, 'powerOfAttorneyData'));
    }

    const powerOfAttorneyDelivery = req.body.powerOfAttorneyDelivery || undefined;
    const deliveryMethod = req.body.deliveryMethod || 'email';

    // ── 2. Validate all fields BEFORE uploading files ──
    validateTrademarkCustomerData(customerData);
    validateTrademarkData(trademarkData);
    validateCorrespondenceAddress(correspondenceAddress);

    if (powerOfAttorneyData) {
      validatePowerOfAttorneyData(powerOfAttorneyData);
    }

    if (powerOfAttorneyDelivery && !['upload', 'physical'].includes(powerOfAttorneyDelivery)) {
      throw new CustomError(400, 'powerOfAttorneyDelivery must be "upload" or "physical"');
    }
    if (!['email', 'address'].includes(deliveryMethod)) {
      throw new CustomError(400, 'deliveryMethod must be "email" or "address"');
    }

    // ── 3. Upload categorized files to GridFS ──
    const filesMap = (req.files || {}) as Record<string, Express.Multer.File[]>;
    const allUploadedFileRefs: any[] = [];

    const uploadCategoryFiles = async (fieldName: string, maxCount: number) => {
      const files = filesMap[fieldName] || [];
      if (files.length > maxCount) {
        throw new CustomError(400, `Too many files for ${fieldName}. Max: ${maxCount}`);
      }

      const refs = [];
      for (const file of files) {
        const fileStream = fs.createReadStream(file.path);
        const fileId = await this.fileStorageUtil.uploadFile(
          fileStream,
          file.originalname,
          file.mimetype,
        );

        const ref = {
          fileId,
          filename: file.originalname,
          mimetype: file.mimetype,
          size: file.size,
        };

        refs.push(ref);
        allUploadedFileRefs.push(ref);

        // Clean up temp file
        fs.unlinkSync(file.path);
      }
      return refs;
    };

    const markFileRefs = await uploadCategoryFiles('markFile', 1);
    const collectiveFileRefs = await uploadCategoryFiles('collectiveFile', 1);
    const certifiedFileRefs = await uploadCategoryFiles('certifiedFile', 1);
    const poaFileRefs = await uploadCategoryFiles('poaFiles', 10);
    const conventionCertificateFileRefs = await uploadCategoryFiles('conventionCertificateFiles', 10);
    const exhibitionDocumentFileRefs = await uploadCategoryFiles('exhibitionDocumentFiles', 10);
    const additionalFileRefs = await uploadCategoryFiles('additionalFiles', 5);

    // ── 4. Calculate dynamic pricing ──
    const niceClasses = trademarkData.niceClasses.map(Number);
    const isCollective = trademarkData.isCollective === true || trademarkData.isCollective === 'true';
    const isCertified = trademarkData.isCertified === true || trademarkData.isCertified === 'true';

    const conventionClaimCount = Array.isArray(trademarkData.priorityClaims) ? trademarkData.priorityClaims.length : 0;
    const exhibitionClaimCount = Array.isArray(trademarkData.exhibitionPriorities) ? trademarkData.exhibitionPriorities.length : 0;
    const totalPriorityClaimCount = conventionClaimCount + exhibitionClaimCount;

    const pricing = calculateTrademarkPrice({
      niceClassCount: niceClasses.length,
      priorityClaimCount: totalPriorityClaimCount,
      isCollective,
      isCertified,
    });

    // ── 5. Generate unique order ID ──
    const orderId = this.generateOrderId();

    // ── 6. Create the trademark order ──
    const order = await this.trademarkOrderDataLayer.create({
      orderId,
      status: 'pending',

      customerData: {
        email: customerData.email,
        firstName: customerData.firstName.trim(),
        lastName: customerData.lastName.trim(),
        phone: customerData.phone,
        address: customerData.address,
        city: customerData.city,
        postalCode: customerData.postalCode,
        isCompany: isCollective || isCertified || customerData.isCompany === true || customerData.isCompany === 'true',
        companyName: customerData.companyName,
        companyEik: customerData.companyEik,
        companyAddress: customerData.companyAddress,
        ip: req.ip,
      },

      trademarkData: {
        markType: trademarkData.markType,
        markText: trademarkData.markText,
        markImageFileId: markFileRefs.length > 0 ? markFileRefs[0].fileId : undefined,
        description: trademarkData.description,
        isCollective,
        isCertified,
        goodsAndServices: trademarkData.goodsAndServices || '',
        niceClasses,
        customTerms: trademarkData.customTerms || {},
        selectedTerms: trademarkData.selectedTerms || {},
        priorityClaims: (trademarkData.priorityClaims || []).map((c: any) => ({
          country: c.country,
          applicationDate: c.applicationDate,
          applicationNumber: c.applicationNumber,
          certificateAttached: c.certificateAttached === true || c.certificateAttached === 'true',
          partialPriority: c.partialPriority === true || c.partialPriority === 'true',
        })),
        exhibitionPriorities: (trademarkData.exhibitionPriorities || []).map((e: any) => ({
          exhibitionName: e.exhibitionName,
          firstShowingDate: e.firstShowingDate,
          documentAttached: e.documentAttached === true || e.documentAttached === 'true',
        })),
        hasInternationalTransformation: trademarkData.hasInternationalTransformation === true || trademarkData.hasInternationalTransformation === 'true',
        internationalRegistrationNumber: trademarkData.internationalRegistrationNumber,
        hasEuConversion: trademarkData.hasEuConversion === true || trademarkData.hasEuConversion === 'true',
        euConversion: trademarkData.euConversion ? {
          euTrademarkNumber: trademarkData.euConversion.euTrademarkNumber,
          manualEntry: trademarkData.euConversion.manualEntry === true || trademarkData.euConversion.manualEntry === 'true',
        } : undefined,
      },

      correspondenceAddress: {
        fullName: correspondenceAddress.fullName.trim(),
        streetAddress: correspondenceAddress.streetAddress.trim(),
        city: correspondenceAddress.city.trim(),
        postalCode: correspondenceAddress.postalCode.trim(),
        country: correspondenceAddress.country.trim(),
      },

      powerOfAttorneyData: powerOfAttorneyData ? {
        managerFullName: powerOfAttorneyData.managerFullName.trim(),
        managerEgn: powerOfAttorneyData.managerEgn,
        managerAddress: powerOfAttorneyData.managerAddress.trim(),
        companyName: powerOfAttorneyData.companyName.trim(),
        companyType: powerOfAttorneyData.companyType,
        city: powerOfAttorneyData.city.trim(),
      } : undefined,

      powerOfAttorneyDelivery,
      deliveryMethod,

      pricing: {
        subtotal: pricing.subtotal,
        vat: pricing.vat,
        total: pricing.total,
        currency: pricing.currency,
      },

      userId: req.user?._id,

      // Categorized file references
      markFile: markFileRefs[0] || undefined,
      collectiveFile: collectiveFileRefs[0] || undefined,
      certifiedFile: certifiedFileRefs[0] || undefined,
      poaFiles: poaFileRefs,
      conventionCertificateFiles: conventionCertificateFileRefs,
      exhibitionDocumentFiles: exhibitionDocumentFileRefs,
      additionalFiles: additionalFileRefs,

      // Backward-compatible flat list
      userUploadedFiles: allUploadedFileRefs,
    }, logContext);

    // ── 7. Send confirmation email to customer ──
    this.emailUtil.sendEmail({
      toEmail: customerData.email,
      subject: 'Потвърждение за поръчка: Регистрация на търговска марка',
      template: 'trademark-order-confirmation',
      payload: {
        orderId: order.orderId,
        createdAt: new Date().toLocaleString('bg-BG'),
        customerName: `${customerData.firstName} ${customerData.lastName}`,
        markType: this.getMarkTypeLabel(trademarkData.markType),
        markText: trademarkData.markText || '—',
        niceClasses: niceClasses.join(', '),
        goodsAndServices: trademarkData.goodsAndServices || '',
        subtotal: pricing.subtotal.toFixed(2),
        vat: pricing.vat.toFixed(2),
        total: pricing.total.toFixed(2),
        currency: pricing.currency,
      },
    }, EmailType.Info, logContext)
      .catch((err: any) => logger.error(`Failed to send customer confirmation email: ${err.message}`, logContext));

    // ── 8. Send new-order notification to admin ──
    this.emailUtil.sendEmail({
      toEmail: this.config.infoAccountEmail,
      subject: 'Нова поръчка: Регистрация на търговска марка',
      template: 'trademark-order-admin',
      payload: {
        orderId: order.orderId,
        createdAt: new Date().toLocaleString('bg-BG'),
        customerName: `${customerData.firstName} ${customerData.lastName}`,
        customerEmail: customerData.email,
        customerPhone: customerData.phone,
        isCompany: customerData.isCompany === true || customerData.isCompany === 'true',
        companyName: customerData.companyName || '—',
        companyEik: customerData.companyEik || '—',
        markType: this.getMarkTypeLabel(trademarkData.markType),
        markText: trademarkData.markText || '—',
        niceClasses: niceClasses.join(', '),
        isCollective,
        isCertified,
        priorityClaimCount: totalPriorityClaimCount,
        goodsAndServices: trademarkData.goodsAndServices || '',
        deliveryMethod: deliveryMethod === 'address' ? 'По адрес' : 'По имейл',
        total: pricing.total.toFixed(2),
        currency: pricing.currency,
        hasUploads: allUploadedFileRefs.length > 0,
        uploadCount: allUploadedFileRefs.length,
      },
    }, EmailType.Info, logContext)
      .catch((err: any) => logger.error(`Failed to send admin new order email: ${err.message}`, logContext));

    // ── 9. Track activity if user is authenticated ──
    if (req.user?._id) {
      this.userDataLayer.appendActivity(
        req.user._id,
        {
          type: 'trademark_order_created',
          orderId: order.orderId,
          createdAt: new Date(),
        },
        logContext,
      ).catch((err: any) => logger.error(`Failed to store activity: ${err.message}`, logContext));
    }

    // ── 10. Respond ──
    res.status(201).json({
      success: true,
      data: {
        orderId: order.orderId,
        status: order.status,
        pricing: {
          subtotal: pricing.subtotal,
          vat: pricing.vat,
          total: pricing.total,
          currency: pricing.currency,
        },
      },
    });
  }

  /**
   * GET /api/trademark/orders/:orderId
   * Authenticated -- returns order by orderId for the owning user
   */
  public getOrder: RequestHandler = async (req, res) => {
    const logContext = `${this.logContext} -> getOrder()`;

    const { orderId } = req.params;

    if (!orderId) {
      throw new CustomError(400, 'Order ID is required');
    }

    const order = await this.trademarkOrderDataLayer.getByOrderId(orderId, logContext);

    // Verify the order belongs to the authenticated user
    if (order.userId && req.user?._id && order.userId.toString() !== req.user._id.toString()) {
      throw new CustomError(403, 'Access denied');
    }

    res.status(200).json({
      success: true,
      data: order,
    });
  }

  /**
   * GET /api/trademark/orders
   * Authenticated -- returns all trademark orders for the user
   */
  public getUserOrders: RequestHandler = async (req, res) => {
    const logContext = `${this.logContext} -> getUserOrders()`;

    const userId = req.user?._id;

    if (!userId) {
      throw new CustomError(401, 'Authentication required');
    }

    const orders = await this.trademarkOrderDataLayer.getUserOrders(userId, logContext);

    res.status(200).json({
      success: true,
      data: orders,
    });
  }

  /**
   * GET /api/trademark/power-of-attorney/:orderId
   * Public (by orderId + email verification or auth)
   * Generates and streams the Power of Attorney PDF
   */
  public downloadPowerOfAttorney: RequestHandler = async (req, res) => {
    const logContext = `${this.logContext} -> downloadPowerOfAttorney()`;

    const { orderId } = req.params;
    const { email } = req.query;

    if (!orderId) {
      throw new CustomError(400, 'Order ID is required');
    }

    const order = await this.trademarkOrderDataLayer.getByOrderId(orderId, logContext);

    // Verify order is paid
    if (order.status === 'pending' || order.status === 'cancelled' || order.status === 'rejected') {
      throw new CustomError(403, 'Payment required to download power of attorney');
    }

    // Verify access: either authenticated user owns the order, or email matches
    const isOwner = req.user?._id && order.userId && req.user._id.toString() === order.userId.toString();
    const emailMatch = email && typeof email === 'string' && email.toLowerCase() === order.customerData.email.toLowerCase();

    if (!isOwner && !emailMatch) {
      throw new CustomError(403, 'Access denied. Provide a valid email or authenticate.');
    }

    // Wait for template to be cached
    await TrademarkController.warmTemplate;

    // Get template from cache
    const templateBuffer = await TemplateCacheUtil.getTemplate(TrademarkController.poaTemplateName);

    // Prepare template data
    const customerName = `${order.customerData.firstName} ${order.customerData.lastName}`;
    const niceClassesStr = order.trademarkData.niceClasses.join(', ');

    const documentData: Record<string, string> = {
      'three_names': order.powerOfAttorneyData?.managerFullName || customerName,
      'egn': order.powerOfAttorneyData?.managerEgn || '',
      'address': order.powerOfAttorneyData?.managerAddress || order.customerData.address || order.customerData.city || '',
      'company_name': order.powerOfAttorneyData?.companyName || order.customerData.companyName || '',
      'company_eik': order.customerData.companyEik || '',
      'mark_text': order.trademarkData.markText || '',
      'nice_classes': niceClassesStr,
      'goods_services': order.trademarkData.goodsAndServices,
    };

    // Fill template with data
    const filledDocx = TrademarkController.renderTemplate(templateBuffer, documentData);

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

    // Track activity
    const activityUserId = order.userId || req.user?._id;
    if (activityUserId) {
      this.userDataLayer.appendActivity(
        activityUserId,
        {
          type: 'trademark_poa_downloaded',
          orderId: order.orderId,
          createdAt: new Date(),
        },
        logContext,
      ).catch((err: any) => logger.error(`Failed to store activity: ${err.message}`, logContext));
    }

    // Stream PDF to response
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="palnomoshno-trademark-${orderId}.pdf"`);

    await pipeline(pdfStream, res);
  }

  private static decodeHtmlEntities(value: string): string {
    return value
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&amp;/g, '&');
  }

  private static renderTemplate(templateBuffer: Buffer, data: Record<string, unknown>): Buffer {
    const sanitized: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(data)) {
      sanitized[key] = typeof value === 'string' ? TrademarkController.decodeHtmlEntities(value) : value;
    }

    const zip = new PizZip(templateBuffer);
    const doc = new Docxtemplater(zip, { paragraphLoop: true, linebreaks: true });
    doc.render(sanitized);
    return doc.getZip().generate({ type: 'nodebuffer' });
  }

  private generateOrderId(): string {
    const timestamp = Date.now().toString(36).toUpperCase();
    const random = crypto.randomBytes(4).toString('hex').toUpperCase();
    return `TM-${timestamp}-${random}`;
  }

  private getMarkTypeLabel(markType: string): string {
    const labels: Record<string, string> = {
      'word': 'Словна',
      'figurative': 'Фигуративна',
      'combined': 'Комбинирана',
      '3d': 'Триизмерна',
      'color': 'Цветова',
      'sound': 'Звукова',
      'hologram': 'Холограмна',
      'position': 'Позиционна',
      'pattern': 'Десен',
      'motion': 'Анимационна',
      'multimedia': 'Мултимедийна',
      'other': 'Друга',
    };
    return labels[markType] || markType;
  }
}
