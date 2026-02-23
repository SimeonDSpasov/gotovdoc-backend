import { RequestHandler } from 'express';
import fs from 'fs';

import logger from '@ipi-soft/logger';

import CustomError from './../utils/custom-error.utils';
import FileStorageUtil from './../utils/file-storage.util';

import OrderDataLayer from './../data-layers/order.data-layer';
import UserDataLayer from './../data-layers/user.data-layer';

import { EmailType, EmailUtil } from './../utils/email.util';
import Config from './../config';

export default class PropertySearchController {

  private logContext = 'Property Search Controller';

  private orderDataLayer = OrderDataLayer.getInstance();
  private userDataLayer = UserDataLayer.getInstance();
  private fileStorageUtil = FileStorageUtil.getInstance();
  private emailUtil = EmailUtil.getInstance();
  private config = Config.getInstance();

  /**
   * POST /api/property-search/order
   * Create a property registry search order
   */
  public createOrder: RequestHandler = async (req, res) => {
    const logContext = `${this.logContext} -> createOrder()`;

    const {
      email,
      phone,
      firstName,
      lastName,
      middleName,
      isCompany,
      companyName,
      companyEik,
      purpose,
      propertyIdentifier,
    } = req.body;

    // Validate required fields
    if (!email || !phone || !purpose) {
      throw new CustomError(400, 'Missing required fields: email, phone, purpose');
    }

    if (!firstName || !lastName) {
      throw new CustomError(400, 'Missing required fields: firstName, lastName');
    }

    const files = (req.files as Express.Multer.File[]) || [];

    // At least one of propertyIdentifier or file must be provided
    if (!propertyIdentifier && files.length === 0) {
      throw new CustomError(400, 'Either propertyIdentifier or a file (sketch) must be provided');
    }

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

    // Create Order — fixed price of €7, no VAT (government service fee)
    const price = 7;
    const orderId = `ORD-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

    const isCompanyBool = isCompany === 'true' || isCompany === true;

    const applicantName = isCompanyBool
      ? companyName
      : `${firstName} ${middleName || ''} ${lastName}`.replace(/\s+/g, ' ').trim();

    const order = await this.orderDataLayer.create({
      orderId,
      userId: req.user?._id,
      userUploadedFiles: uploadedFiles,
      subtotal: price,
      vat: 0,
      total: price,
      expectedAmount: price,
      currency: 'EUR',
      status: 'pending',
      items: [{
        id: 'property-search',
        type: 'package',
        name: 'Справка в Имотен регистър',
        description: `Справка за имот: ${propertyIdentifier || 'по документ'}`,
        price: price,
        formData: {
          applicantName,
          isCompany: isCompanyBool,
          companyName: isCompanyBool ? companyName : undefined,
          companyEik: isCompanyBool ? companyEik : undefined,
          firstName: !isCompanyBool ? firstName : undefined,
          middleName: !isCompanyBool ? middleName : undefined,
          lastName: !isCompanyBool ? lastName : undefined,
          purpose,
          propertyIdentifier: propertyIdentifier || '',
          uploadedFiles
        }
      }],
      customerData: {
        email,
        firstName: isCompanyBool ? companyName : firstName,
        lastName: isCompanyBool ? '' : lastName,
        phone,
        ip: req.ip
      },
      documentsGenerated: false,
      documentsSent: false,
    }, logContext);

    // Track user activity
    if (req.user?._id) {
      this.userDataLayer.appendActivity(
        req.user._id,
        {
          type: 'order_created',
          orderId: order.orderId,
          orderType: 'property-search',
          createdAt: new Date(),
        },
        logContext
      ).catch((err: any) => logger.error(`Failed to store activity: ${err.message}`, logContext));
    }

    // Send admin notification email
    const emailData = {
      toEmail: this.config.infoAccountEmail,
      subject: 'Нова поръчка: Справка в Имотен регистър',
      template: 'new-order',
      payload: {
        orderId: order.orderId,
        createdAt: new Date().toLocaleString('bg-BG'),
        customerName: applicantName,
        customerEmail: email,
        customerPhone: phone,
        companyName: isCompanyBool ? companyName : '—',
        companyEik: isCompanyBool ? companyEik : '—',
        notes: `Цел: ${purpose}\nИдентификатор: ${propertyIdentifier || 'Приложен документ'}`,
        includeRegistration: '—',
        deliveryMethod: 'Имейл',
        hasUploads: uploadedFiles.length > 0,
        downloadAllUrl: '',
        uploadedFiles: [],
      },
    };

    this.emailUtil.sendEmail(emailData, EmailType.Info, logContext)
      .catch((err: any) => logger.error(`Failed to send new order email: ${err.message}`, logContext));

    res.status(201).json({
      success: true,
      data: order
    });
  }
}
