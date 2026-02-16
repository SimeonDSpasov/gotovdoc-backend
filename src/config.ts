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

  // Stripe
  public stripeApiSecretKey = process.env.STRIPE_API_SECRET_KEY || '';
  public stripeWebhookSigningSecret = process.env.STRIPE_WEBHOOK_SIGNING_SECRET || '';

  private static instance: Config;

  public static getInstance(): Config {
    if (!Config.instance) {
      Config.instance = new Config();
    }

    return Config.instance;
  }

}
