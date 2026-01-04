import axios, { AxiosInstance } from 'axios';
import logger from '@ipi-soft/logger';
import Config from '../config';

interface MyPosTokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
}

interface CreatePaymentLinkRequest {
  amount: number;
  currency: string;
  order_id: string;
  customer_email: string;
  customer_name?: string;
  note?: string;
  success_url?: string;
  cancel_url?: string;
}

interface CreatePaymentLinkResponse {
  payment_link_id: string;
  payment_url: string;
  status: string;
}

export default class MyPosService {
  private static instance: MyPosService;
  private axiosInstance: AxiosInstance;
  private config = Config.getInstance();
  private accessToken: string | null = null;
  private tokenExpiry: number = 0;

  private constructor() {
    const baseURL = this.config.mypos.isProduction
      ? 'https://api.mypos.com'
      : 'https://sandbox-api.mypos.com';

    this.axiosInstance = axios.create({
      baseURL,
      headers: {
        'Content-Type': 'application/json',
      },
    });
  }

  public static getInstance(): MyPosService {
    if (!MyPosService.instance) {
      MyPosService.instance = new MyPosService();
    }
    return MyPosService.instance;
  }

  private async authenticate(): Promise<string> {
    // Check if token is still valid
    if (this.accessToken && Date.now() < this.tokenExpiry) {
      return this.accessToken;
    }

    const authUrl = this.config.mypos.isProduction
      ? 'https://auth-api.mypos.com/oauth/token'
      : 'https://sandbox-auth-api.mypos.com/oauth/token';

    const credentials = Buffer.from(
      `${this.config.mypos.clientId}:${this.config.mypos.clientSecret}`
    ).toString('base64');

    try {
      const response = await axios.post<MyPosTokenResponse>(
        authUrl,
        new URLSearchParams({ grant_type: 'client_credentials' }),
        {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            Authorization: `Basic ${credentials}`,
          },
        }
      );

      this.accessToken = response.data.access_token;
      // Set expiry 5 minutes before actual expiry for safety
      this.tokenExpiry = Date.now() + (response.data.expires_in - 300) * 1000;

      logger.info('MyPOS OAuth token generated successfully', 'MyPosService');
      return this.accessToken;
    } catch (error: any) {
      logger.error(error.message, 'MyPosService -> authenticate');
      throw new Error('Failed to authenticate with myPOS');
    }
  }

  public async createPaymentLink(params: CreatePaymentLinkRequest): Promise<CreatePaymentLinkResponse> {
    const token = await this.authenticate();

    try {
      // Generate unique request ID (UUID format)
      const requestId = this.generateRequestId();
      // API Key is the same as Client ID
      const apiKey = this.config.mypos.clientId;

      if (!apiKey) {
        throw new Error('MYPOS_CLIENT_ID is required');
      }

      const requestBody = {
        item_name: params.note || 'Specimen Document',
        item_price: params.amount,
        pref_language: 'BG',
        currency: params.currency,
        account_number: '',
        custom_name: 'Payment Link',
        quantity: 1,
        website: this.config.frontendUrl,
        send_sms: false,
        send_email: true,
        ask_for_customer_name: true,
        hide_quantity: true,
      };

      logger.info(`Creating payment link with request ID: ${requestId}`, 'MyPosService');
      logger.info(`Request body: ${JSON.stringify(requestBody)}`, 'MyPosService');

      // Use Transactions API v1.1
      const endpoint = 'https://transactions-api.mypos.com/v1.1/online-payments/link';
      
      const response = await axios.post<CreatePaymentLinkResponse>(
        endpoint,
        requestBody,
        {
          headers: {
            'API-Key': apiKey,
            'X-Request-ID': requestId,
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        }
      );

      logger.info(`Payment link created: ${response.data.payment_url}`, 'MyPosService');
      return response.data;
    } catch (error: any) {
      const errorMessage = error.response?.data 
        ? JSON.stringify(error.response.data)
        : error.message;
      
      logger.error(
        `Failed to create payment link: ${errorMessage}`,
        'MyPosService -> createPaymentLink'
      );
      
      if (error.response?.status) {
        logger.error(`HTTP Status: ${error.response.status}`, 'MyPosService');
      }
      
      throw new Error(`Failed to create payment link: ${errorMessage}`);
    }
  }

  private generateRequestId(): string {
    // Generate UUID-like request ID: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
    const s4 = () => Math.floor((1 + Math.random()) * 0x10000).toString(16).substring(1);
    return `${s4()}${s4()}-${s4()}-${s4()}-${s4()}-${s4()}${s4()}${s4()}`;
  }

  public async getPaymentDetails(paymentLinkId: string): Promise<any> {
    const token = await this.authenticate();

    try {
      const response = await this.axiosInstance.get(
        `/v1/transactions/payment-links/${paymentLinkId}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      return response.data;
    } catch (error: any) {
      logger.error(
        error.response?.data?.message || error.message,
        'MyPosService -> getPaymentDetails'
      );
      throw new Error('Failed to get payment details');
    }
  }
}


