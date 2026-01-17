import path from 'path';
import * as dotenv from 'dotenv';

type EnvType = 'dev' | 'test' | 'prod';

const _env = (process.env.Project_ENV || 'dev') as EnvType;

((): void => {
  const envFileRelativePath = _env === 'dev' ? './../.env' : '.env';

  dotenv.config({ path: path.resolve(__dirname, envFileRelativePath) });
})();

export default class Config {

  public env = _env;
  public isMaintenance = false;

  // Server
  public server = {
    port: Number(process.env.PORT) || 3000,
    hostname: '127.0.0.1',
  };

  public get frontendUrl(): string {
    return {
      dev: 'http://localhost:4200',
      test: 'https://gotovdoc.bg',
      prod: 'https://gotovdoc.bg',
    }[this.env];
  };

  public databases = {
    main: `gotovdoc-${this.env}`,
  }

  public redis = {
    url: process.env.REDIS_URL || '',
    keyPrefix: process.env.REDIS_KEY_PREFIX || 'gotovdoc',
  }

  // Email
  public emailPassword = process.env.EMAIL_PASSWORD || '';

  public get infoAccountEmail(): string {
    return {
      dev: 'info@gotovdoc.bg',
      test: 'info@gotovdoc.bg',
      prod: 'info@gotovdoc.bg',
    }[this.env];
  }

  public get supportAccountEmail(): string {
    return {
      dev: 'support@gotovdoc.bg',
      test: 'support@gotovdoc.bg',
      prod: 'support@gotovdoc.bg',
    }[this.env];
  }

  // Auth / JWT
  public jwt = {
    accessExpireTime: 3600, // 1 hour
    refreshExpireTime: 43200, // 12 hours
    accessSecret: process.env.JWT_ACCESS_SECRET || 'your-access-secret-key-change-in-production',
    refreshSecret: process.env.JWT_REFRESH_SECRET || 'your-refresh-secret-key-change-in-production',
  };

  // MyPOS Configuration
  public mypos = (() => {
    // Determine if production based on env and SID
    const isProduction = this.env === 'prod';
    
    // Use test or production credentials based on environment
    const sid = isProduction 
      ? (process.env.MYPOS_SID || '')
      : (process.env.MYPOS_TEST_SID || process.env.MYPOS_SID || '000000000000010');
    
    const walletNumber = isProduction
      ? (process.env.MYPOS_WALLET_NUMBER || '')
      : (process.env.MYPOS_TEST_WALLET_NUMBER || process.env.MYPOS_WALLET_NUMBER || '61938166610');
    
    const keyIndex = isProduction
      ? parseInt(process.env.MYPOS_KEY_INDEX || '1')
      : parseInt(process.env.MYPOS_TEST_KEY_INDEX || process.env.MYPOS_KEY_INDEX || '1');
    
    const privateKey = isProduction
      ? (process.env.MYPOS_PRIVATE_KEY || '')
      : (process.env.MYPOS_TEST_PRIVATE_KEY || process.env.MYPOS_PRIVATE_KEY || '');
    
    const publicCert = isProduction
      ? (process.env.MYPOS_PUBLIC_CERT || '')
      : (process.env.MYPOS_TEST_PUBLIC_CERT || process.env.MYPOS_PUBLIC_CERT || '');
    
    // myPOS server certificate for verifying THEIR webhook signatures
    // This is DIFFERENT from the merchant certificate above!
    const myposServerCert = isProduction
      ? (process.env.MYPOS_SERVER_CERT || '')
      : (process.env.MYPOS_TEST_SERVER_CERT || process.env.MYPOS_SERVER_CERT || '');
    
    return {
      // REST API v1.1 credentials
      clientId: process.env.MYPOS_CLIENT_ID || '',
      clientSecret: process.env.MYPOS_CLIENT_SECRET || '',
      
      // Checkout API v1.4 credentials
      sid,
      walletNumber,
      keyIndex,
      privateKey,
      publicCert, // OUR merchant certificate (for signing our requests)
      myposServerCert, // myPOS's certificate (for verifying their webhooks)
      
      // Common settings
      isProduction,
      successUrl: process.env.MYPOS_SUCCESS_URL || `${this.frontendUrl}/payment/success`,
      cancelUrl: process.env.MYPOS_CANCEL_URL || `${this.frontendUrl}/payment/cancel`,
      webhookSecret: process.env.MYPOS_WEBHOOK_SECRET || '',
      
      // Skip signature verification by default (since we don't have myPOS's server certificate)
      // Set to 'false' to enable if you have MYPOS_SERVER_CERT configured
      skipSignatureVerification: process.env.MYPOS_SKIP_SIGNATURE_VERIFICATION !== 'false',
      
      // Allowed IP addresses for webhook requests (optional - leave empty to allow all and just log IPs)
      // Add myPOS server IPs here after seeing them in logs
      // Example: ['34.65.222.69', '35.195.100.']
      allowedWebhookIPs: process.env.MYPOS_ALLOWED_IPS 
        ? process.env.MYPOS_ALLOWED_IPS.split(',').map(ip => ip.trim())
        : [],
    };
  })();

  private static instance: Config;

  public static getInstance(): Config {
    if (!Config.instance) {
      Config.instance = new Config();
    }

    return Config.instance;
  }

}
