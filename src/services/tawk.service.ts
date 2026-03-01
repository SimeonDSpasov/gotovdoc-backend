import crypto from 'crypto';

import Config from './../config';

export default class TawkService {

 private logContext = 'Tawk Service';
 private config = Config.getInstance();

 /**
 * Generate HMAC SHA256 hash for tawk.to secure mode visitor identification.
 * The hash is computed from the user's email using the tawk.to API key.
 */
 public generateVisitorHash(email: string): string {
  return crypto
   .createHmac('sha256', this.config.tawkApiKey)
   .update(email)
   .digest('hex');
 }

 /**
 * Verify the webhook signature from tawk.to.
 * tawk.to signs webhooks using HMAC SHA1 with the webhook secret.
 * The signature is sent in the X-Tawk-Signature header as a base64 digest.
 */
 public verifyWebhookSignature(rawBody: string, signature: string): boolean {
  const expectedSignature = crypto
   .createHmac('sha1', this.config.tawkWebhookSecret)
   .update(rawBody)
   .digest('base64');

  return crypto.timingSafeEqual(
   Buffer.from(signature),
   Buffer.from(expectedSignature)
  );
 }

 private static instance: TawkService;

 public static getInstance(): TawkService {
  if (!TawkService.instance) {
   TawkService.instance = new TawkService();
  }

  return TawkService.instance;
 }

}
