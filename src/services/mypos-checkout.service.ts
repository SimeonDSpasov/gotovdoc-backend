import crypto from 'crypto';
import axios from 'axios';
import logger from '@ipi-soft/logger';

import Config from '../config';

/**
 * myPOS Checkout API v1.4 Service
 * Documentation: https://merchant.mypos.com/pdf/recources/myPOS_Checkout_API_v1.4_EN_v1.pdf
 */

// IPC Method types
export enum IPCMethod {
  PURCHASE = 'IPCPurchase',
  PURCHASE_NOTIFY = 'IPCPurchaseNotify',
  PURCHASE_CANCEL = 'IPCPurchaseCancel',
  REFUND = 'IPCRefund',
  REVERSAL = 'IPCReversal',
  GET_TXN_STATUS = 'IPCGetTxnStatus',
  GET_TXN_LOG = 'IPCGetTxnLog',
  STORE_CARD = 'IPCIASStoreCard',
  REQUEST_MONEY = 'IPCRequestMoney',
  SEND_MONEY = 'IPCSendMoney',
}

// Cart item interface
export interface CartItem {
  article: string;
  quantity: number;
  price: number;
  amount: number;
  currency: string;
}

// Purchase request interface
export interface IPCPurchaseRequest {
  Amount: number; // Total amount (NOT in cents, in EUR)
  Currency: string; // ISO 4217 (EUR, USD, GBP, etc.)
  OrderID: string;
  URL_OK: string;
  URL_Cancel: string;
  URL_Notify: string;
  CustomerEmail: string; // Required when PaymentParametersRequired = 1
  CustomerFirstNames: string; // Required when PaymentParametersRequired = 1 (note: plural)
  CustomerFamilyName: string; // Required when PaymentParametersRequired = 1
  CustomerPhone?: string;
  CustomerIP?: string;
  Note?: string;
  CartItems?: CartItem[]; // Array of cart items
  Delivery?: number; // Delivery cost
}

// Refund request interface
export interface IPCRefundRequest {
  OrderID: string;
  IPC_Trnref: string; // Original transaction reference
  Amount: number;
  Currency: string;
  OutputFormat?: 'json' | 'xml';
}

// Transaction status request
export interface IPCGetTxnStatusRequest {
  OrderID: string;
  OutputFormat?: 'json' | 'xml';
}

// Response interfaces
export interface IPCResponse {
  IPCmethod: string;
  SID: string;
  Status: string;
  StatusMsg: string;
  [key: string]: any;
}

export default class MyPosCheckoutService {
  private static instance: MyPosCheckoutService;
  private config = Config.getInstance();

  private constructor() {
    // Validation and logging on initialization
    if (!this.config.mypos.sid) {
      const error = this.config.mypos.isProduction
        ? 'MYPOS_SID is required in production'
        : 'MYPOS_SID not configured (should auto-use test SID 000000000000010)';
      logger.error(error, 'MyPosCheckoutService');
    }
    
    if (!this.config.mypos.privateKey || !this.config.mypos.publicCert) {
      const envType = this.config.mypos.isProduction ? 'production' : 'test';
      logger.error(
        `Missing RSA keys for ${envType} environment. ` +
        `Generate keys in myPOS portal: https://merchant.mypos.com`,
        'MyPosCheckoutService'
      );
      
      if (!this.config.mypos.isProduction) {
        logger.info(
          'To get test RSA keys: ' +
          '1) Log in to myPOS portal, ' +
          '2) Create/select test store, ' +
          '3) Generate Configuration Pack or Key Pair, ' +
          '4) Add to .env: MYPOS_PRIVATE_KEY and MYPOS_PUBLIC_CERT'
        );
      }
    } else {
      // Log successful configuration
      const envType = this.config.mypos.isProduction ? 'PRODUCTION' : 'TEST';
      const baseURL = this.config.mypos.isProduction
        ? 'https://www.mypos.eu/vmp/checkout'
        : 'https://www.mypos.eu/vmp/checkout-test';
      
      logger.info(
        `myPOS Checkout configured for ${envType} environment | ` +
        `SID: ${this.config.mypos.sid} | ` +
        `Base URL: ${baseURL}`
      );
    }
  }

  public static getInstance(): MyPosCheckoutService {
    if (!MyPosCheckoutService.instance) {
      MyPosCheckoutService.instance = new MyPosCheckoutService();
    }
    return MyPosCheckoutService.instance;
  }

  /**
   * Generate RSA signature for request
   * Per myPOS docs: concatenate all parameter VALUES (not keys) in order, then sign with SHA1
   */
  private generateSignature(data: Record<string, any>): string {
    console.log('data', data);
    try {
      // Concatenate all values in the exact order they appear in the request
      const dataString = Object.values(data).join('');
      
      logger.info(`Data for signature: ${dataString}`);
      
      // Create signature using private key with SHA1
      const sign = crypto.createSign('SHA1');
      sign.update(dataString);
      sign.end();
      
      console.log('this.config.mypos.privateKey', this.config.mypos.privateKey);
      const signature = sign.sign(this.config.mypos.privateKey, 'base64');
      logger.info(`Generated signature: ${signature.substring(0, 50)}...`);
      
      return signature;
    } catch (error: any) {
      logger.error(`Failed to generate signature: ${error.message}`, 'MyPosCheckoutService');
      throw new Error('Failed to generate signature');
    }
  }

  /**
   * Verify RSA signature from myPOS response
   */
  public verifySignature(data: Record<string, any>, signature: string): boolean {
    try {
      logger.info(`[verifySignature] Starting signature verification...`);
      
      // TEMPORARY: Skip signature verification in test mode if enabled
      if (this.config.mypos.skipSignatureVerification) {
        logger.error(`[verifySignature] ⚠️  SKIPPING signature verification (MYPOS_SKIP_SIGNATURE_VERIFICATION=true)`, 'MyPosCheckoutService');
        logger.error(`[verifySignature] ⚠️  This should ONLY be used in test mode!`, 'MyPosCheckoutService');
        return true;
      }
      
      // Remove signature from data for verification
      const { Signature, ...dataWithoutSig } = data;
      logger.info(`[verifySignature] Data fields (without signature): ${Object.keys(dataWithoutSig).join(', ')}`);
      
      // Concatenate all values
      const dataString = Object.values(dataWithoutSig).join('');
      logger.info(`[verifySignature] Data string for verification (first 100 chars): ${dataString.substring(0, 100)}...`);
      logger.info(`[verifySignature] Data string length: ${dataString.length}`);
      
      // Use myPOS server certificate to verify THEIR signatures (webhooks)
      // NOT our merchant certificate!
      const certToUse = this.config.mypos.myposServerCert || this.config.mypos.publicCert;
      logger.info(`[verifySignature] Using myPOS server cert: ${!!this.config.mypos.myposServerCert}`);
      logger.info(`[verifySignature] Cert available: ${!!certToUse}`);
      logger.info(`[verifySignature] Cert length: ${certToUse?.length || 0}`);
      
      if (!certToUse) {
        logger.error(`[verifySignature] No certificate available for webhook verification!`, 'MyPosCheckoutService');
        return false;
      }
      
      // Verify signature using myPOS server certificate
      const verify = crypto.createVerify('SHA1');
      verify.update(dataString);
      verify.end();
      
      const isValid = verify.verify(certToUse, signature, 'base64');
      logger.info(`[verifySignature] Verification result: ${isValid}`);
      
      return isValid;
    } catch (error: any) {
      logger.error(`[verifySignature] Failed to verify signature: ${error.message}`, 'MyPosCheckoutService');
      logger.error(`[verifySignature] Error stack: ${error.stack}`, 'MyPosCheckoutService');
      return false;
    }
  }

  /**
   * Create a purchase transaction for Embedded SDK
   * Returns payment parameters with signature for frontend
   */
  public createPurchaseParams(params: IPCPurchaseRequest): Record<string, any> {
    try {
      // Build request data in the EXACT order required for signature
      // Order matters for signature generation!
      // NOTE: Parameter names are CASE SENSITIVE! Use lowercase for customer fields per myPOS docs
      const requestData: Record<string, any> = {
        IPCmethod: IPCMethod.PURCHASE,
        IPCVersion: '1.4',
        IPCLanguage: 'bg', // Bulgarian
        SID: this.config.mypos.sid,
        walletnumber: this.config.mypos.walletNumber, // LOWERCASE per myPOS docs
        Amount: params.Amount.toFixed(2), // Format to 2 decimals
        Currency: params.Currency,
        OrderID: params.OrderID,
        URL_OK: params.URL_OK,
        URL_Cancel: params.URL_Cancel,
        URL_Notify: params.URL_Notify,
        CardTokenRequest: '0',
        KeyIndex: this.config.mypos.keyIndex,
        PaymentParametersRequired: '1',
      };

      // Add REQUIRED customer parameters (when PaymentParametersRequired = 1)
      // MUST be lowercase per myPOS documentation example
      requestData.customeremail = params.CustomerEmail;
      requestData.customerfirstnames = params.CustomerFirstNames;
      requestData.customerfamilyname = params.CustomerFamilyName;
      
      // Add optional customer parameters (also lowercase)
      if (params.CustomerPhone) requestData.customerphone = params.CustomerPhone;
      if (params.CustomerIP) requestData.customerip = params.CustomerIP;
      if (params.Note) requestData.Note = params.Note;

      // Add cart items if provided
      if (params.CartItems && params.CartItems.length > 0) {
        requestData.CartItems = params.CartItems.length;
        
        // Add each cart item with indexed parameters
        params.CartItems.forEach((item, index) => {
          const itemIndex = index + 1;
          requestData[`Article_${itemIndex}`] = item.article;
          requestData[`Quantity_${itemIndex}`] = item.quantity;
          requestData[`Price_${itemIndex}`] = item.price.toFixed(2);
          requestData[`Amount_${itemIndex}`] = item.amount.toFixed(2);
          requestData[`Currency_${itemIndex}`] = item.currency;
        });
      }

      // Add delivery cost if provided
      if (params.Delivery) {
        requestData.Delivery = params.Delivery.toFixed(2);
      }

      // Generate signature BEFORE adding it
      const signature = this.generateSignature(requestData);
      requestData.Signature = signature;

      logger.info(`Created purchase params for OrderID: ${params.OrderID}`);
      logger.info(`Amount: ${params.Amount}, SID: ${this.config.mypos.sid}`);

      return requestData;
    } catch (error: any) {
      logger.error(`Failed to create purchase params: ${error.message}`, 'MyPosCheckoutService');
      throw error;
    }
  }

  /**
   * Get transaction status
   */
  public async getTransactionStatus(params: IPCGetTxnStatusRequest): Promise<IPCResponse> {
    try {
      const requestData: Record<string, any> = {
        IPCmethod: IPCMethod.GET_TXN_STATUS,
        IPCVersion: '1.4',
        IPCLanguage: 'en',
        SID: this.config.mypos.sid,
        walletnumber: this.config.mypos.walletNumber, // LOWERCASE per myPOS docs
        KeyIndex: this.config.mypos.keyIndex,
        OrderID: params.OrderID,
        OutputFormat: params.OutputFormat || 'json',
      };

      // Generate signature
      const signature = this.generateSignature(requestData);
      requestData.Signature = signature;

      logger.info(`Getting transaction status for OrderID: ${params.OrderID}`);

      // Determine base URL
      const baseURL = this.config.mypos.isProduction
        ? 'https://www.mypos.eu/vmp/checkout'
        : 'https://www.mypos.eu/vmp/checkout-test';

      // Make POST request
      const response = await axios.post(baseURL, new URLSearchParams(requestData), {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
      });

      return response.data;
    } catch (error: any) {
      logger.error(`Failed to get transaction status: ${error.message}`, 'MyPosCheckoutService');
      throw error;
    }
  }

  /**
   * Process refund for a transaction
   */
  public async createRefund(params: IPCRefundRequest): Promise<IPCResponse> {
    try {
      const requestData: Record<string, any> = {
        IPCmethod: IPCMethod.REFUND,
        IPCVersion: '1.4',
        IPCLanguage: 'en',
        SID: this.config.mypos.sid,
        walletnumber: this.config.mypos.walletNumber, // LOWERCASE per myPOS docs
        KeyIndex: this.config.mypos.keyIndex,
        OrderID: params.OrderID,
        IPC_Trnref: params.IPC_Trnref,
        Amount: params.Amount,
        Currency: params.Currency,
        OutputFormat: params.OutputFormat || 'json',
      };

      // Generate signature
      const signature = this.generateSignature(requestData);
      requestData.Signature = signature;

      logger.info(`Creating refund for OrderID: ${params.OrderID}`);

      // Determine base URL
      const baseURL = this.config.mypos.isProduction
        ? 'https://www.mypos.eu/vmp/checkout'
        : 'https://www.mypos.eu/vmp/checkout-test';

      // Make POST request
      const response = await axios.post(baseURL, new URLSearchParams(requestData), {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
      });

      return response.data;
    } catch (error: any) {
      logger.error(`Failed to create refund: ${error.message}`, 'MyPosCheckoutService');
      throw error;
    }
  }

  /**
   * Build form HTML for purchase (frontend will submit this)
   */
  public buildPurchaseForm(params: IPCPurchaseRequest): string {
    // NOTE: Parameter names are CASE SENSITIVE! Use lowercase for customer fields per myPOS docs
    const requestData: Record<string, any> = {
      IPCmethod: IPCMethod.PURCHASE,
      IPCVersion: '1.4',
      IPCLanguage: 'en',
      SID: this.config.mypos.sid,
      walletnumber: this.config.mypos.walletNumber, // LOWERCASE per myPOS docs
      Amount: params.Amount,
      Currency: params.Currency,
      OrderID: params.OrderID,
      URL_OK: params.URL_OK,
      URL_Cancel: params.URL_Cancel,
      URL_Notify: params.URL_Notify,
      CardTokenRequest: '0',
      KeyIndex: this.config.mypos.keyIndex,
      PaymentParametersRequired: '1',
    };

    // Add required customer parameters (MUST be lowercase)
    requestData.customeremail = params.CustomerEmail;
    requestData.customerfirstnames = params.CustomerFirstNames;
    requestData.customerfamilyname = params.CustomerFamilyName;
    
    // Add optional parameters (also lowercase)
    if (params.CustomerPhone) requestData.customerphone = params.CustomerPhone;
    if (params.CustomerIP) requestData.customerip = params.CustomerIP;
    if (params.Note) requestData.Note = params.Note;

    // Generate signature
    const signature = this.generateSignature(requestData);
    requestData.Signature = signature;

    // Determine base URL
    const baseURL = this.config.mypos.isProduction
      ? 'https://www.mypos.eu/vmp/checkout'
      : 'https://www.mypos.eu/vmp/checkout-test';

    // Build HTML form
    let formHTML = `<form id="mypos-checkout-form" method="POST" action="${baseURL}">\n`;
    
    for (const [key, value] of Object.entries(requestData)) {
      formHTML += `  <input type="hidden" name="${key}" value="${value}" />\n`;
    }
    
    formHTML += `  <button type="submit">Pay with myPOS</button>\n`;
    formHTML += `</form>\n`;
    formHTML += `<script>document.getElementById('mypos-checkout-form').submit();</script>`;

    return formHTML;
  }

  /**
   * Process webhook notification from myPOS
   */
  public processWebhookNotification(data: Record<string, any>): {
    isValid: boolean;
    method: string;
    orderID?: string;
    amount?: number;
    currency?: string;
    transactionRef?: string;
    status?: string;
    statusMsg?: string;
  } {
    try {
      logger.info(`[processWebhookNotification] Starting webhook processing...`);
      logger.info(`[processWebhookNotification] Data type: ${typeof data}`);
      logger.info(`[processWebhookNotification] Data keys: ${data ? Object.keys(data).join(', ') : 'NO DATA'}`);
      
      const signature = data.Signature;
      logger.info(`[processWebhookNotification] Signature present: ${!!signature}`);
      
      if (!signature) {
        logger.error('[processWebhookNotification] No signature in webhook data', 'MyPosCheckoutService');
        return { isValid: false, method: data.IPCmethod || 'unknown' };
      }

      logger.info(`[processWebhookNotification] Signature value: ${signature.substring(0, 50)}...`);
      logger.info(`[processWebhookNotification] Verifying signature...`);

      // Verify signature
      const isValid = this.verifySignature(data, signature);
      logger.info(`[processWebhookNotification] Signature verification result: ${isValid}`);

      if (!isValid) {
        logger.error('[processWebhookNotification] Invalid signature in webhook', 'MyPosCheckoutService');
        logger.error(`[processWebhookNotification] Webhook data: ${JSON.stringify(data)}`, 'MyPosCheckoutService');
        return { isValid: false, method: data.IPCmethod || 'unknown' };
      }

      logger.info(`[processWebhookNotification] ✅ Valid webhook received: ${data.IPCmethod}`);
      logger.info(`[processWebhookNotification] OrderID: ${data.OrderID}, Status: ${data.Status}, Amount: ${data.Amount}`);

      return {
        isValid: true,
        method: data.IPCmethod,
        orderID: data.OrderID,
        amount: data.Amount ? parseFloat(data.Amount) : undefined,
        currency: data.Currency,
        transactionRef: data.IPC_Trnref,
        status: data.Status,
        statusMsg: data.StatusMsg,
      };
    } catch (error: any) {
      logger.error(`[processWebhookNotification] Failed to process webhook: ${error.message}`, 'MyPosCheckoutService');
      logger.error(`[processWebhookNotification] Error stack: ${error.stack}`, 'MyPosCheckoutService');
      return { isValid: false, method: 'error' };
    }
  }
}

