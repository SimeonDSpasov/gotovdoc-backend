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
    port: 3000,
    hostname: '127.0.0.1',
  };

  public get frontendUrl(): string {
    return {
      dev: 'http://localhost:4200',
      test: 'https://test.dripnat.com',
      prod: 'https://dripnat.com',
    }[this.env];
  };

  public databases = {
    main: `drip-node-${this.env}`,
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


  private static instance: Config;

  public static getInstance(): Config {
    if (!Config.instance) {
      Config.instance = new Config();
    }

    return Config.instance;
  }

}
