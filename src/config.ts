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
      
      // Common settings
      isProduction,
      successUrl: process.env.MYPOS_SUCCESS_URL || `${this.frontendUrl}/payment/success`,
      cancelUrl: process.env.MYPOS_CANCEL_URL || `${this.frontendUrl}/payment/cancel`,
      webhookSecret: process.env.MYPOS_WEBHOOK_SECRET || '',
      
      // TEMPORARY: Skip signature verification in test mode if certificate is incorrect
      // Set to 'true' to bypass signature verification (ONLY for testing!)
      skipSignatureVerification: process.env.MYPOS_SKIP_SIGNATURE_VERIFICATION === 'true',
    };
  })();

  private static instance: Config;

  public static getInstance(): Config {
    if (!Config.instance) {
      Config.instance = new Config();
    }

    return Config.instance;
  }

  /**
   * Log myPOS configuration on startup (with masked sensitive data)
   */
  public logMyPosConfig(): void {
    const maskKey = (key: string | undefined) => {
      if (!key) return '❌ NOT SET';
      if (key.length < 100) return `✅ Set (${key.length} chars)`;
      return `✅ Set (${key.length} chars) - ${key.substring(0, 50)}...${key.substring(key.length - 20)}`;
    };

    console.log('\n╔════════════════════════════════════════════════════════════════╗');
    console.log('║              myPOS CONFIGURATION CHECK                         ║');
    console.log('╚════════════════════════════════════════════════════════════════╝\n');
    
    console.log(`🌍 Environment: ${this.env}`);
    console.log(`🏭 Is Production: ${this.mypos.isProduction ? '🚀 YES (LIVE)' : '🧪 NO (TEST)'}`);
    console.log(`🌐 Frontend URL: ${this.frontendUrl}`);
    console.log('');
    
    console.log('📦 myPOS Credentials:');
    console.log(`  SID: ${this.mypos.sid || '❌ NOT SET'}`);
    console.log(`  Wallet Number: ${this.mypos.walletNumber || '❌ NOT SET'}`);
    console.log(`  Key Index: ${this.mypos.keyIndex}`);
    console.log('');
    
    console.log('🔐 RSA Keys (YOUR merchant keys):');
    console.log(`  Private Key: ${maskKey(this.mypos.privateKey)}`);
    console.log(`    └─ Used to sign outgoing requests TO myPOS`);
    console.log(`  Public Cert: ${maskKey(this.mypos.publicCert)}`);
    console.log(`    └─ Used to verify incoming webhooks FROM myPOS`);
    console.log('');
    console.log('  ℹ️  Note: Same keypair is used for both directions');
    
    console.log('🌐 Endpoints:');
    console.log(`  Base URL: ${this.mypos.isProduction ? 'https://www.mypos.eu/vmp/checkout' : 'https://www.mypos.eu/vmp/checkout-test'}`);
    console.log(`  Success URL: ${this.mypos.successUrl}`);
    console.log(`  Cancel URL: ${this.mypos.cancelUrl}`);
    console.log('');
    
    // Validation warnings
    const warnings: string[] = [];
    
    if (!this.mypos.sid) warnings.push('⚠️  MYPOS_SID is not set!');
    if (!this.mypos.walletNumber) warnings.push('⚠️  MYPOS_WALLET_NUMBER is not set!');
    if (!this.mypos.privateKey) warnings.push('⚠️  MYPOS_PRIVATE_KEY is not set! Cannot sign requests.');
    if (!this.mypos.publicCert) warnings.push('⚠️  MYPOS_PUBLIC_CERT is not set!');
    
    if (this.mypos.skipSignatureVerification) {
      warnings.push('🔓 Webhook signature verification is DISABLED');
      warnings.push('   Security: Relying on HTTPS/TLS + amount verification');
      warnings.push('   To enable: Set MYPOS_SKIP_SIGNATURE_VERIFICATION=false');
    } else if (this.mypos.publicCert) {
      console.log('✅ Webhook signature verification is ENABLED');
    } else {
      warnings.push('⚠️  Webhook signature verification ENABLED but public cert is missing!');
      warnings.push('   Set MYPOS_PUBLIC_CERT or disable with MYPOS_SKIP_SIGNATURE_VERIFICATION=true');
    }
    
    if (warnings.length > 0) {
      console.log('⚠️  WARNINGS:');
      warnings.forEach(w => console.log(`  ${w}`));
      console.log('');
    }
    
    // Environment detection
    if (this.mypos.sid === '000000000000010') {
      console.log('✅ Using official myPOS TEST credentials (SID: 000000000000010)');
    } else if (this.mypos.sid?.startsWith('000')) {
      console.log('🧪 Using custom TEST credentials (SID starts with 000)');
    } else if (this.mypos.sid) {
      console.log('🚀 Using PRODUCTION credentials');
    }
    
    console.log('\n════════════════════════════════════════════════════════════════\n');
  }

}
