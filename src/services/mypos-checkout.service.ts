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
  CustomerCountry?: string; // ISO 3166-1 alpha-3 (e.g. DEU, BGR, USA)
  CustomerCity?: string;
  CustomerZipCode?: string;
  CustomerAddress?: string;
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
        `Missing RSA keys for ${envType} environment`,
        'MyPosCheckoutService'
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
    try {
      // Concatenate all values in the exact order they appear in the request
      const dataString = Object.values(data).join('');
      
      // Create signature using private key with SHA1
      const sign = crypto.createSign('SHA1');
      sign.update(dataString);
      sign.end();
      
      const signature = sign.sign(this.config.mypos.privateKey, 'base64');
      
      return signature;
    } catch (error: any) {
      logger.error(`Failed to generate signature: ${error.message}`, 'MyPosCheckoutService');
      throw new Error('Failed to generate signature');
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
        PaymentParametersRequired: '1', // 1 = All fields required, 2 = Email only, 3 = No fields
        PaymentMethod: '1', // 1 = Card only, 2 = iCard only, 3 = Both Card and iCard
      };

      // Add REQUIRED customer parameters (when PaymentParametersRequired = 1)
      // MUST be lowercase per myPOS documentation example
      requestData.customeremail = params.CustomerEmail;
      requestData.customerfirstnames = params.CustomerFirstNames;
      requestData.customerfamilyname = params.CustomerFamilyName;
      
      // Add optional customer parameters (also lowercase)
      // IMPORTANT: All fields must be present in exact order for signature, even if empty
      requestData.customerphone = params.CustomerPhone || '';
      requestData.customercountry = params.CustomerCountry || '';
      requestData.customercity = params.CustomerCity || '';
      requestData.customerzipcode = params.CustomerZipCode || '';
      requestData.customeraddress = params.CustomerAddress || '';
      
      // Note and Source
      requestData.Note = params.Note || '';
      requestData.Source = ''; // Always empty per myPOS docs

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

      // Add delivery cost (0 if not provided)
      requestData.Delivery = params.Delivery ? params.Delivery.toFixed(2) : '0';

      // Generate signature BEFORE adding it
      const signature = this.generateSignature(requestData);
      requestData.Signature = signature;

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
      IPCLanguage: 'bg',
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
      PaymentParametersRequired: '1', // 1 = All fields required, 2 = Email only, 3 = No fields
      PaymentMethod: '1', // 1 = Card only, 2 = iCard only, 3 = Both Card and iCard
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
   * Verify signature from myPOS webhook notification
   * 
   * According to myPOS docs (https://developers.mypos.com/en/doc/online_payments/v1_4/336-authentication):
   * 1. Save the signature from the POST data
   * 2. Remove the Signature field from POST data
   * 3. Concatenate all remaining values with '-' separator
   * 4. Base64 encode the concatenated string
   * 5. Extract public key from myPOS certificate
   * 6. Verify signature using openssl_verify with SHA-256
   * 
   * IMPORTANT: Use myPOS's public certificate (MYPOS_PUBLIC_CERT), not the merchant's certificate!
   * 
   * @param data - Webhook data including Signature
   * @returns true if signature is valid
   */
  private verifyWebhookSignature(data: Record<string, any>): boolean {
    try {
      const signature = data.Signature;
      if (!signature) {
        logger.error('Webhook missing signature', 'MyPosCheckoutService');
        return false;
      }

      // Use myPOS's public certificate to verify the webhook signature
      // This is NOT the merchant's certificate - it's the certificate myPOS uses to sign webhooks
      // Get from MYPOS_SERVER_CERT (production) or MYPOS_TEST_SERVER_CERT (test)
      const myposCert = this.config.mypos.myposServerCert;
      
      if (!myposCert) {
        logger.error('No myPOS server certificate available (MYPOS_SERVER_CERT or MYPOS_TEST_SERVER_CERT)', 'MyPosCheckoutService');
        return false;
      }

      // Create a copy of data without the Signature field
      const dataWithoutSignature = { ...data };
      delete dataWithoutSignature.Signature;

      console.log(dataWithoutSignature);

      // Concatenate all values with '-' separator (as shown in PHP example)
      const values = Object.values(dataWithoutSignature).map(v => String(v));
      const concatenated = values.join('-');
      
      // Base64 encode the concatenated string
      const base64Data = Buffer.from(concatenated, 'utf8').toString('base64');

      // Verify RSA-SHA256 signature
      const verifier = crypto.createVerify('RSA-SHA256');
      verifier.update(base64Data, 'utf8');
      verifier.end();
      
      // Decode the signature from base64 and verify
      const isValid = verifier.verify(myposCert, signature, 'base64');

      if (!isValid) {
        logger.error(`Webhook signature verification failed`, 'MyPosCheckoutService');
      }

      return isValid;
    } catch (error: any) {
      logger.error(`Webhook signature verification error: ${error.message}`, 'MyPosCheckoutService');
      return false;
    }
  }

  /**
   * Process webhook notification from myPOS
   * 
   * Security layers:
   * 1. HTTPS/TLS - Railway provides SSL certificate for secure connection
   * 2. Signature verification - Verify webhook using myPOS's public certificate (MYPOS_PUBLIC_CERT)
   * 3. Amount verification - Always verify payment amount matches order
   * 
   * Note: Signature verification can be disabled with MYPOS_SKIP_SIGNATURE_VERIFICATION=true
   */
  public processWebhookNotification(data: Record<string, any>): {
    isValid: boolean;
    method: string;
    orderID?: string;
    amount?: number;
    currency?: string;
    transactionRef?: string;
    isSuccess?: boolean;
  } {
    try {
      // Verify signature (if enabled and certificate is available)
      if (!this.config.mypos.skipSignatureVerification) {
        const isSignatureValid = this.verifyWebhookSignature(data);
        
        if (!isSignatureValid) {
          logger.error('Invalid webhook signature - possible fraud attempt', 'MyPosCheckoutService');
          return { isValid: false, method: data.IPCmethod || 'unknown' };
        }
      }

      // Determine payment success based on IPCmethod
      // IPCPurchaseNotify or IPCPurchaseOK = Payment successful
      // IPCPurchaseRollback or IPCPurchaseCancel = Payment failed/cancelled
      const isSuccess = data.IPCmethod === 'IPCPurchaseNotify' || data.IPCmethod === 'IPCPurchaseOK';

      return {
        isValid: true,
        method: data.IPCmethod,
        orderID: data.OrderID,
        amount: data.Amount ? parseFloat(data.Amount) : undefined,
        currency: data.Currency,
        transactionRef: data.IPC_Trnref,
        isSuccess,
      };
    } catch (error: any) {
      logger.error(`Failed to process webhook: ${error.message}`, 'MyPosCheckoutService');
      return { isValid: false, method: 'error' };
    }
  }
}

