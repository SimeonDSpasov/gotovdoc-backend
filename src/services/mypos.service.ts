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
      const response = await this.axiosInstance.post<CreatePaymentLinkResponse>(
        '/v1/transactions/payment-links',
        {
          amount: params.amount,
          currency: params.currency,
          order_id: params.order_id,
          customer: {
            email: params.customer_email,
            name: params.customer_name || '',
          },
          note: params.note || '',
          success_url: params.success_url || this.config.mypos.successUrl,
          cancel_url: params.cancel_url || this.config.mypos.cancelUrl,
        },
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      logger.info(`Payment link created: ${response.data.payment_url}`, 'MyPosService');
      return response.data;
    } catch (error: any) {
      logger.error(
        error.response?.data?.message || error.message,
        'MyPosService -> createPaymentLink'
      );
      throw new Error('Failed to create payment link');
    }
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


