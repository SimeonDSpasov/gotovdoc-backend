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

    const {
      // Customer data
      email,
      firstName,
      lastName,
      phone,
      address,
      city,
      postalCode,
      isCompany,
      companyName,
      companyEik,
      companyAddress,
      // Trademark data
      markType,
      markText,
      goodsAndServices,
      niceClasses,
      priorityDocument,
      // Delivery
      deliveryMethod,
    } = req.body;

    // Validate required fields
    if (!email || !firstName || !lastName || !phone) {
      throw new CustomError(400, 'Missing required customer fields: email, firstName, lastName, phone');
    }

    if (!markType || !goodsAndServices || !niceClasses || !Array.isArray(niceClasses) || niceClasses.length === 0) {
      throw new CustomError(400, 'Missing required trademark fields: markType, goodsAndServices, niceClasses');
    }

    const validMarkTypes = ['word', 'combined', 'figurative', 'other'];
    if (!validMarkTypes.includes(markType)) {
      throw new CustomError(400, `Invalid markType. Must be one of: ${validMarkTypes.join(', ')}`);
    }

    // For combined/figurative marks, an image is expected (uploaded as a file)
    const files = (req.files as Express.Multer.File[]) || [];
    const uploadedFiles = [];
    let markImageFileId: any = undefined;

    for (const file of files) {
      const fileStream = fs.createReadStream(file.path);
      const fileId = await this.fileStorageUtil.uploadFile(
        fileStream,
        file.originalname,
        file.mimetype
      );

      uploadedFiles.push({
        fileId,
        filename: file.originalname,
        mimetype: file.mimetype,
        size: file.size,
      });

      // First image file is treated as the mark image for combined/figurative marks
      if (!markImageFileId && file.mimetype.startsWith('image/')) {
        markImageFileId = fileId;
      }

      // Clean up temp file
      fs.unlinkSync(file.path);
    }

    // Generate unique order ID
    const orderId = this.generateOrderId();

    // Pricing -- the plan doesn't specify exact prices, use a placeholder price
    // This should be configured in document-prices.config.ts
    const subtotal = 150; // EUR -- placeholder, should come from PriceValidationService
    const vat = Math.round(subtotal * 0.20 * 100) / 100;
    const total = Math.round((subtotal + vat) * 100) / 100;

    // Create the trademark order
    const order = await this.trademarkOrderDataLayer.create({
      orderId,
      status: 'pending',
      customerData: {
        email,
        firstName,
        lastName,
        phone,
        address,
        city,
        postalCode,
        isCompany: isCompany === true || isCompany === 'true',
        companyName,
        companyEik,
        companyAddress,
        ip: req.ip,
      },
      trademarkData: {
        markType,
        markText,
        markImageFileId,
        goodsAndServices,
        niceClasses: niceClasses.map(Number),
        priorityDocument,
      },
      deliveryMethod: deliveryMethod || 'email',
      pricing: {
        subtotal,
        vat,
        total,
        currency: 'EUR',
      },
      userId: req.user?._id,
      userUploadedFiles: uploadedFiles,
    }, logContext);

    // Send confirmation email to customer
    this.emailUtil.sendEmail({
      toEmail: email,
      subject: 'Потвърждение за поръчка: Регистрация на търговска марка',
      template: 'trademark-order-confirmation',
      payload: {
        orderId: order.orderId,
        createdAt: new Date().toLocaleString('bg-BG'),
        customerName: `${firstName} ${lastName}`,
        markType: this.getMarkTypeLabel(markType),
        markText: markText || '—',
        niceClasses: niceClasses.join(', '),
        goodsAndServices,
        subtotal: subtotal.toFixed(2),
        vat: vat.toFixed(2),
        total: total.toFixed(2),
        currency: 'EUR',
      },
    }, EmailType.Info, logContext)
      .catch((err: any) => logger.error(`Failed to send customer confirmation email: ${err.message}`, logContext));

    // Send new-order notification to admin
    this.emailUtil.sendEmail({
      toEmail: this.config.infoAccountEmail,
      subject: 'Нова поръчка: Регистрация на търговска марка',
      template: 'trademark-order-admin',
      payload: {
        orderId: order.orderId,
        createdAt: new Date().toLocaleString('bg-BG'),
        customerName: `${firstName} ${lastName}`,
        customerEmail: email,
        customerPhone: phone,
        isCompany: isCompany === true || isCompany === 'true',
        companyName: companyName || '—',
        companyEik: companyEik || '—',
        markType: this.getMarkTypeLabel(markType),
        markText: markText || '—',
        niceClasses: niceClasses.join(', '),
        goodsAndServices,
        deliveryMethod: deliveryMethod === 'address' ? 'По адрес' : 'По имейл',
        total: total.toFixed(2),
        currency: 'EUR',
        hasUploads: uploadedFiles.length > 0,
        uploadCount: uploadedFiles.length,
      },
    }, EmailType.Info, logContext)
      .catch((err: any) => logger.error(`Failed to send admin new order email: ${err.message}`, logContext));

    // Track activity if user is authenticated
    if (req.user?._id) {
      this.userDataLayer.appendActivity(
        req.user._id,
        {
          type: 'trademark_order_created',
          orderId: order.orderId,
          createdAt: new Date(),
        },
        logContext
      ).catch((err: any) => logger.error(`Failed to store activity: ${err.message}`, logContext));
    }

    res.status(201).json({
      success: true,
      data: {
        orderId: order.orderId,
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
      'three_names': customerName,
      'egn': '', // EGN is not collected in the order -- placeholder
      'address': order.customerData.address || order.customerData.city || '',
      'company_name': order.customerData.companyName || '',
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
        logContext
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
      'combined': 'Комбинирана',
      'figurative': 'Фигуративна',
      'other': 'Друга',
    };
    return labels[markType] || markType;
  }
}
