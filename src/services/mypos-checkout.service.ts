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

// Purchase request interface
export interface IPCPurchaseRequest {
  Amount: number; // In minor currency units (cents)
  Currency: string; // ISO 4217 (EUR, USD, GBP, etc.)
  OrderID: string;
  URL_OK: string;
  URL_Cancel: string;
  URL_Notify: string;
  CustomerEmail?: string;
  CustomerPhone?: string;
  CustomerFirstName?: string;
  CustomerLastName?: string;
  CustomerIP?: string;
  Note?: string;
  CartItems?: number;
  ArticleName?: string;
  Quantity?: number;
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
  private baseURL: string;
  private SID: string;
  private privateKey: string;
  private publicCert: string;

  private constructor() {
    // Use test environment if not production
    this.baseURL = this.config.mypos.isProduction
      ? 'https://www.mypos.eu/vmp/checkout'
      : 'https://www.mypos.eu/vmp/checkout-test';

    // Get credentials from config
    this.SID = this.config.mypos.sid;
    this.privateKey = this.config.mypos.privateKey;
    this.publicCert = this.config.mypos.publicCert;

    if (!this.SID) {
      logger.error('MYPOS_SID is not configured', 'MyPosCheckoutService');
    }
    
    if (!this.privateKey) {
      logger.error('MYPOS_PRIVATE_KEY is not configured', 'MyPosCheckoutService');
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
   */
  private generateSignature(data: Record<string, any>): string {
    try {
      // Concatenate all values in the order they appear in the request
      const dataString = Object.values(data).join('');
      
      // Create signature using private key
      const sign = crypto.createSign('SHA1');
      sign.update(dataString);
      sign.end();
      
      const signature = sign.sign(this.privateKey, 'base64');
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
      // Remove signature from data for verification
      const { Signature, ...dataWithoutSig } = data;
      
      // Concatenate all values
      const dataString = Object.values(dataWithoutSig).join('');
      
      // Verify signature using public certificate
      const verify = crypto.createVerify('SHA1');
      verify.update(dataString);
      verify.end();
      
      return verify.verify(this.publicCert, signature, 'base64');
    } catch (error: any) {
      logger.error(`Failed to verify signature: ${error.message}`, 'MyPosCheckoutService');
      return false;
    }
  }

  /**
   * Create a purchase transaction (redirects customer to payment page)
   */
  public async createPurchase(params: IPCPurchaseRequest): Promise<string> {
    try {
      const requestData: Record<string, any> = {
        IPCmethod: IPCMethod.PURCHASE,
        IPCVersion: '1.4',
        IPCLanguage: 'en',
        SID: this.SID,
        WalletNumber: this.config.mypos.walletNumber,
        KeyIndex: this.config.mypos.keyIndex,
        Amount: params.Amount,
        Currency: params.Currency,
        OrderID: params.OrderID,
        URL_OK: params.URL_OK,
        URL_Cancel: params.URL_Cancel,
        URL_Notify: params.URL_Notify,
      };

      // Add optional parameters
      if (params.CustomerEmail) requestData.CustomerEmail = params.CustomerEmail;
      if (params.CustomerPhone) requestData.CustomerPhone = params.CustomerPhone;
      if (params.CustomerFirstName) requestData.CustomerFirstName = params.CustomerFirstName;
      if (params.CustomerLastName) requestData.CustomerLastName = params.CustomerLastName;
      if (params.CustomerIP) requestData.CustomerIP = params.CustomerIP;
      if (params.Note) requestData.Note = params.Note;
      if (params.CartItems) requestData.CartItems = params.CartItems;
      if (params.ArticleName) requestData.ArticleName = params.ArticleName;
      if (params.Quantity) requestData.Quantity = params.Quantity;

      // Generate signature
      const signature = this.generateSignature(requestData);
      requestData.Signature = signature;

      logger.info(`Creating purchase for OrderID: ${params.OrderID}`, 'MyPosCheckoutService');

      // Return the checkout URL with form data
      // The frontend will need to submit this as a POST form
      return this.baseURL;
    } catch (error: any) {
      logger.error(`Failed to create purchase: ${error.message}`, 'MyPosCheckoutService');
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
        SID: this.SID,
        WalletNumber: this.config.mypos.walletNumber,
        KeyIndex: this.config.mypos.keyIndex,
        OrderID: params.OrderID,
        OutputFormat: params.OutputFormat || 'json',
      };

      // Generate signature
      const signature = this.generateSignature(requestData);
      requestData.Signature = signature;

      logger.info(`Getting transaction status for OrderID: ${params.OrderID}`, 'MyPosCheckoutService');

      // Make POST request
      const response = await axios.post(this.baseURL, new URLSearchParams(requestData), {
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
        SID: this.SID,
        WalletNumber: this.config.mypos.walletNumber,
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

      logger.info(`Creating refund for OrderID: ${params.OrderID}`, 'MyPosCheckoutService');

      // Make POST request
      const response = await axios.post(this.baseURL, new URLSearchParams(requestData), {
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
    const requestData: Record<string, any> = {
      IPCmethod: IPCMethod.PURCHASE,
      IPCVersion: '1.4',
      IPCLanguage: 'en',
      SID: this.SID,
      WalletNumber: this.config.mypos.walletNumber,
      KeyIndex: this.config.mypos.keyIndex,
      Amount: params.Amount,
      Currency: params.Currency,
      OrderID: params.OrderID,
      URL_OK: params.URL_OK,
      URL_Cancel: params.URL_Cancel,
      URL_Notify: params.URL_Notify,
    };

    // Add optional parameters
    if (params.CustomerEmail) requestData.CustomerEmail = params.CustomerEmail;
    if (params.CustomerPhone) requestData.CustomerPhone = params.CustomerPhone;
    if (params.CustomerFirstName) requestData.CustomerFirstName = params.CustomerFirstName;
    if (params.CustomerLastName) requestData.CustomerLastName = params.CustomerLastName;
    if (params.CustomerIP) requestData.CustomerIP = params.CustomerIP;
    if (params.Note) requestData.Note = params.Note;

    // Generate signature
    const signature = this.generateSignature(requestData);
    requestData.Signature = signature;

    // Build HTML form
    let formHTML = `<form id="mypos-checkout-form" method="POST" action="${this.baseURL}">\n`;
    
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
      const signature = data.Signature;
      
      if (!signature) {
        logger.error('No signature in webhook data', 'MyPosCheckoutService');
        return { isValid: false, method: data.IPCmethod || 'unknown' };
      }

      // Verify signature
      const isValid = this.verifySignature(data, signature);

      if (!isValid) {
        logger.error('Invalid signature in webhook', 'MyPosCheckoutService');
        return { isValid: false, method: data.IPCmethod || 'unknown' };
      }

      logger.info(`Valid webhook received: ${data.IPCmethod}`, 'MyPosCheckoutService');

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
      logger.error(`Failed to process webhook: ${error.message}`, 'MyPosCheckoutService');
      return { isValid: false, method: 'error' };
    }
  }
}

