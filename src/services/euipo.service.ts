import axios, { AxiosInstance, AxiosRequestConfig, Method } from 'axios';

import logger from '@ipi-soft/logger';

import CustomError from './../utils/custom-error.utils';
import EuipoCacheDataLayer from './../data-layers/euipo-cache.data-layer';
import EuipoTokenDataLayer from './../data-layers/euipo-token.data-layer';
import Config from './../config';

interface CachedToken {
  accessToken: string;
  expiresAt: number;
}

interface ClassHeadingsResponse {
  headings?: { classNumber: number; heading?: string }[];
}

interface TermsPageResponse {
  terms?: { text: string; conceptId: string; taxonomyParentId: string }[];
  totalPages?: number;
  totalElements?: number;
}

export default class EuipoService {

  private readonly logContext = 'EUIPO Service';
  private readonly config = Config.getInstance();
  private readonly cacheDataLayer = EuipoCacheDataLayer.getInstance();
  private readonly tokenDataLayer = EuipoTokenDataLayer.getInstance();

  private client: AxiosInstance;
  private cachedToken: CachedToken | null = null;
  private tokenPromise: Promise<string> | null = null;

  private readonly REQUEST_DELAY = 1000;
  private readonly MAX_RETRIES = 3;
  private readonly PAGE_SIZE = 100;
  private readonly SYNC_LANGUAGE = 'bg';
  /** Refresh token this many ms before expiry so we never send an expired token (EUIPO 401). */
  private readonly TOKEN_REFRESH_BUFFER_MS = 2 * 60 * 1000;

  constructor() {
    this.client = axios.create({
      baseURL: this.config.euipoBaseUrl,
      timeout: 30_000,
      headers: { 'Accept': 'application/json' },
    });
  }

  // ---------- Public (read from DB) ----------

  public async getClassHeadings(): Promise<unknown> {
    return this.cacheDataLayer.getAllClasses(`${this.logContext} -> getClassHeadings()`);
  }

  public async getClassTerms(
    classNumber: number,
    page: number,
    size: number,
  ): Promise<unknown> {
    return this.cacheDataLayer.getClassTerms(
      classNumber,
      page,
      size,
      `${this.logContext} -> getClassTerms()`,
    );
  }

  public async searchTerms(
    termText: string,
    classNumbers: number[] | undefined,
    page: number,
    size: number,
  ): Promise<unknown> {
    return this.cacheDataLayer.searchTerms(
      termText,
      classNumbers,
      page,
      size,
      `${this.logContext} -> searchTerms()`,
    );
  }

  public async getClassDescriptions(): Promise<unknown> {
    return this.cacheDataLayer.getClassDescriptions(`${this.logContext} -> getClassDescriptions()`);
  }

  // ---------- Sync (called by cronjob) ----------

  public async seedClassDescriptions(): Promise<void> {
    const logContext = `${this.logContext} -> seedClassDescriptions()`;

    const response = await this.fetchClassHeadingsFromApi(this.SYNC_LANGUAGE);
    const headings = response?.headings ?? [];

    logger.info(`Fetched ${headings.length} class headings, upserting descriptions`, logContext);

    for (const h of headings) {
      await this.cacheDataLayer.upsertDescription(h.classNumber, h.heading ?? '', logContext);
    }

    logger.info(`Seeded descriptions for ${headings.length} classes`, logContext);
  }

  public async syncAllClasses(): Promise<void> {
    const logContext = `${this.logContext} -> syncAllClasses()`;
    const startTime = Date.now();
    const allClassNumbers = Array.from({ length: 45 }, (_, i) => i + 1);

    logger.info(`Syncing all ${allClassNumbers.length} classes`, logContext);

    const headingsMap = await this.fetchClassHeadingsMap(logContext);

    for (const classNum of allClassNumbers) {
      await this.syncSingleClass(classNum, headingsMap, logContext)
        .catch((err: any) => logger.error(`Sync failed for class ${classNum}: ${err.message}`, logContext));
    }

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    logger.info(`Sync complete: ${allClassNumbers.length} classes in ${elapsed}s`, logContext);
  }

  private async fetchClassHeadingsMap(logContext: string): Promise<Map<number, string>> {
    const response = await this.fetchClassHeadingsFromApi(this.SYNC_LANGUAGE);
    const map = new Map<number, string>();

    if (response?.headings) {
      for (const h of response.headings) {
        map.set(h.classNumber, h.heading ?? '');
      }
    }

    return map;
  }

  private async syncSingleClass(
    classNum: number,
    headingsMap: Map<number, string>,
    logContext: string,
  ): Promise<void> {
    const description = headingsMap.get(classNum) ?? '';
    const allTerms = await this.fetchAllTermsForClass(classNum);

    const totalTerms = allTerms.length;
    await this.cacheDataLayer.upsertClass(classNum, description, description, allTerms, totalTerms, logContext);

    logger.info(`Class ${classNum}: ${allTerms.length} terms synced`, logContext);
  }

  private async fetchAllTermsForClass(classNum: number): Promise<{ text: string; conceptId: string; taxonomyParentId: string }[]> {
    const allTerms: { text: string; conceptId: string; taxonomyParentId: string }[] = [];

    const firstPage = await this.fetchTermsPageFromApi(this.SYNC_LANGUAGE, classNum, 0, this.PAGE_SIZE);

    if (firstPage?.terms) {
      allTerms.push(...firstPage.terms);
    }

    const totalPages = firstPage?.totalPages ?? 1;

    for (let page = 1; page < totalPages; page++) {
      await this.delay(this.REQUEST_DELAY);

      const pageData = await this.fetchTermsPageFromApi(this.SYNC_LANGUAGE, classNum, page, this.PAGE_SIZE);

      if (pageData?.terms) {
        allTerms.push(...pageData.terms);
      }
    }

    return allTerms;
  }

  // ---------- EUIPO API calls (each as its own method) ----------

  private async fetchClassHeadingsFromApi(language: string): Promise<ClassHeadingsResponse> {
    return this.request<ClassHeadingsResponse>('GET', '/classHeadings', {
      params: { language: 'bg' },
    });
  }

  private async fetchTermsPageFromApi(
    language: string,
    classNumber: number,
    page: number,
    size: number,
  ): Promise<TermsPageResponse> {
    return this.request<TermsPageResponse>('GET', '/terms', {
      params: {
        language,
        classNumber: String(classNumber),
        page: String(page),
        size: String(size),
      },
    });
  }

  // ---------- HTTP + token ----------

  /**
   * EUIPO 401 = "Authorization header missing or access token expired" (dev portal).
   * We always attach Authorization and refresh before expiry; on 401 we clear token and retry once.
   */
  private async request<T>(
    method: Method,
    path: string,
    options: { params?: Record<string, any>; data?: unknown } = {},
    attempt = 0,
  ): Promise<T> {
    const logContext = `${this.logContext} -> request(${method} ${path})`;

    const token = await this.getAccessToken();

    if (!token || typeof token !== 'string' || token.length === 0) {
      this.cachedToken = null;
      throw new CustomError(502, 'EUIPO access token missing — cannot send Authorization header', logContext);
    }

    const config = this.buildRequestConfig(method, path, token, options);

    return this.client
      .request<T>(config)
      .then(response => response.data)
      .catch((err: any) => this.handleRequestError<T>(err, logContext, method, path, options, attempt));
  }

  private buildRequestConfig(
    method: Method,
    path: string,
    token: string,
    options: { params?: Record<string, any>; data?: unknown },
  ): AxiosRequestConfig {
    const headers: Record<string, string> = {
      'Authorization': `Bearer ${token}`,
      'X-IBM-Client-Id': this.config.euipoClientId,
      ...(options.data ? { 'Content-Type': 'application/json' } : {}),
    };

    if (this.config.euipoDebugHeaders) {
      headers['X-Debug'] = 'true';
      headers['Accept-Debug'] = 'true';
    }

    return {
      method,
      url: path,
      params: options.params,
      data: options.data,
      headers,
    };
  }

  private handleRequestError<T>(
    err: any,
    logContext: string,
    method: Method,
    path: string,
    options: { params?: Record<string, any>; data?: unknown },
    attempt: number,
  ): Promise<T> {
    const status = err.response?.status;

    if (status === 401) {
      this.log401Details(err, path, options, logContext);
      if (attempt === 0) {
        logger.info('Received 401 from EUIPO, refreshing token and retrying', logContext);
        this.cachedToken = null;
        return this.delay(2000).then(() => this.request<T>(method, path, options, 1));
      }
    }

    const isTransient = !status || status >= 500 || status === 429;

    if (isTransient && attempt < this.MAX_RETRIES) {
      const backoffMs = Math.pow(2, attempt + 1) * 1000;
      const detail = err.response?.data?.detail || err.response?.data?.title || err.message;
      logger.info(`Transient error (${status || 'network'}): ${detail} — retrying in ${backoffMs / 1000}s (attempt ${attempt + 1}/${this.MAX_RETRIES})`, logContext);
      return this.delay(backoffMs).then(() => this.request<T>(method, path, options, attempt + 1));
    }

    const detail = err.response?.data?.detail || err.response?.data?.title || err.message;
    throw new CustomError(status || 502, `EUIPO API error: ${detail}`, logContext);
  }

  private log401Details(
    err: any,
    path: string,
    options: { params?: Record<string, any> },
    logContext: string,
  ): void {
    const baseURL = this.config.euipoBaseUrl.replace(/\/$/, '');
    const pathWithQuery =
      path +
      (options.params && Object.keys(options.params).length
        ? '?' + new URLSearchParams(options.params as Record<string, string>).toString()
        : '');
    const fullUrl = baseURL + (path.startsWith('/') ? pathWithQuery : '/' + pathWithQuery);
    logger.info(`EUIPO 401 request URL: ${fullUrl}`, logContext);

    const respHeaders = err.response?.headers;
    if (respHeaders && typeof respHeaders === 'object') {
      const headerObj: Record<string, string> = {};
      Object.keys(respHeaders).forEach(key => {
        const v = (respHeaders as Record<string, unknown>)[key];
        headerObj[key] = Array.isArray(v) ? v.join(', ') : String(v ?? '');
      });
      logger.info(`EUIPO 401 response headers: ${JSON.stringify(headerObj)}`, logContext);
    }

    if (err.response?.data) {
      logger.info(`EUIPO 401 response body: ${JSON.stringify(err.response.data)}`, logContext);
    }
  }

  private async getAccessToken(): Promise<string> {
    const now = Date.now();
    if (
      !this.config.euipoTokenPerRequest &&
      this.cachedToken &&
      now < this.cachedToken.expiresAt - this.TOKEN_REFRESH_BUFFER_MS
    ) {
      return this.cachedToken.accessToken;
    }

    if (this.tokenPromise) {
      return this.tokenPromise.finally(() => {
        this.tokenPromise = null;
      });
    }

    this.tokenPromise = this.fetchToken();
    return this.tokenPromise.finally(() => {
      this.tokenPromise = null;
    });
  }

  private async fetchToken(): Promise<string> {
    const logContext = `${this.logContext} -> fetchToken()`;

    const stored = await this.tokenDataLayer.get(logContext);
    const now = Date.now();
    const storedExpiresAt = stored?.expiresAt ? new Date(stored.expiresAt).getTime() : 0;
    const needNewToken = !stored || storedExpiresAt < now + this.TOKEN_REFRESH_BUFFER_MS;

    if (!needNewToken && stored?.accessToken) {
      this.cachedToken = { accessToken: stored.accessToken, expiresAt: storedExpiresAt };
      return stored.accessToken;
    }

    if (needNewToken && stored?.refreshToken) {
      try {
        const result = await this.tryRefresh(stored.refreshToken, logContext);
        if (result) {
          this.cachedToken = { accessToken: result.accessToken, expiresAt: result.expiresAt };
          await this.tokenDataLayer.upsert(
            result.accessToken,
            result.refreshToken ?? stored.refreshToken,
            new Date(result.expiresAt),
            logContext,
          );
          logger.info('Token refreshed, expires in ' + (result.expiresIn ?? 0) + 's', logContext);
          return result.accessToken;
        }
      } catch (err: any) {
        logger.info(`Refresh failed, falling back to client_credentials: ${err.message}`, logContext);
      }
    }

    const result = await this.fetchNewToken(logContext);
    this.cachedToken = { accessToken: result.accessToken, expiresAt: result.expiresAt };
    await this.tokenDataLayer.upsert(
      result.accessToken,
      result.refreshToken ?? null,
      new Date(result.expiresAt),
      logContext,
    );
    logger.info(`Token acquired, expires in ${result.expiresIn}s`, logContext);
    return result.accessToken;
  }

  private async tryRefresh(
    refreshToken: string,
    logContext: string,
  ): Promise<{ accessToken: string; refreshToken: string | null; expiresAt: number; expiresIn: number } | null> {
    const params = new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
      client_id: this.config.euipoClientId,
      client_secret: this.config.euipoClientSecret,
    });
    const { data } = await axios.post(this.config.euipoTokenUrl, params.toString(), {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      timeout: 10_000,
    });
    const accessToken = typeof data?.access_token === 'string' ? data.access_token.trim() : data?.access_token;
    if (!accessToken || typeof accessToken !== 'string') {
      return null;
    }
    const expiresIn = Number(data?.expires_in) || 3600;
    const expiresAt = Date.now() + expiresIn * 1000;
    const newRefreshToken =
      typeof data?.refresh_token === 'string' && data.refresh_token ? data.refresh_token : null;
    return { accessToken, refreshToken: newRefreshToken, expiresAt, expiresIn };
  }

  private async fetchNewToken(
    logContext: string,
  ): Promise<{
    accessToken: string;
    refreshToken: string | null;
    expiresAt: number;
    expiresIn: number;
  }> {
    const params = new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: this.config.euipoClientId,
      client_secret: this.config.euipoClientSecret,
      scope: 'uid',
    });
    const { data } = await axios
      .post(this.config.euipoTokenUrl, params.toString(), {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        timeout: 10_000,
      })
      .catch((err: any) => {
        this.cachedToken = null;
        const message = err.response?.data?.error_description || err.message;
        throw new CustomError(502, `EUIPO token request failed: ${message}`, logContext);
      });

    logger.info(`Token response keys: ${Object.keys(data || {}).join(', ')}`, logContext);

    const accessToken = typeof data?.access_token === 'string' ? data.access_token.trim() : data?.access_token;
    if (!accessToken || typeof accessToken !== 'string') {
      this.cachedToken = null;
      throw new CustomError(502, 'EUIPO token response missing access_token', logContext);
    }
    const expiresIn = Number(data?.expires_in) || 3600;
    const expiresAt = Date.now() + expiresIn * 1000;
    const refreshToken =
      typeof data?.refresh_token === 'string' && data.refresh_token ? data.refresh_token : null;
    return { accessToken, refreshToken, expiresAt, expiresIn };
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // ---------- Singleton ----------

  private static instance: EuipoService;

  public static getInstance(): EuipoService {
    if (!EuipoService.instance) {
      EuipoService.instance = new EuipoService();
    }
    return EuipoService.instance;
  }
}
