import { Request, Response, NextFunction } from 'express';
import logger from '@ipi-soft/logger';
import Config from './../config';

/**
 * Middleware to validate myPOS webhook requests
 * 
 * Security measures:
 * 1. IP address validation - Verify webhook is from myPOS servers
 * 2. Body validation - Ensure webhook has data
 * 3. SID validation - Verify webhook is from our myPOS store
 * 4. Required fields validation - Ensure all required fields are present
 * 5. IPCmethod validation - Ensure valid webhook method
 */
export const validateMyPosWebhook = (req: Request, res: Response, next: NextFunction): void => {
  const logContext = 'MyPosWebhookMiddleware';
  const config = Config.getInstance();

  try {
    // Check 1: Validate IP address (if whitelist is configured)
    const clientIP = req.ip || req.headers['x-forwarded-for'] || req.headers['x-real-ip'] || req.connection.remoteAddress;
    const myposAllowedIPs = config.mypos.allowedWebhookIPs;
    
    if (myposAllowedIPs && myposAllowedIPs.length > 0) {
      const isAllowedIP = myposAllowedIPs.some(allowedIP => {
        if (typeof clientIP === 'string') {
          return clientIP.includes(allowedIP);
        }
        return false;
      });

      if (!isAllowedIP) {
        logger.error(`Webhook from unauthorized IP: ${clientIP}`, logContext);
        res.status(200).send('OK');
        return;
      }
    } else {
      // Log IP for monitoring (so you can whitelist it later)
      logger.info(`Webhook received from IP: ${clientIP}`);
    }

    // Check 2: Validate body is not empty
    if (!req.body || Object.keys(req.body).length === 0) {
      logger.error('Webhook body is empty', logContext);
      res.status(200).send('OK');
      return;
    }

    // Check 3: Validate SID matches our configured SID
    const webhookSID = req.body.SID;
    if (webhookSID && webhookSID !== config.mypos.sid) {
      logger.error(`Webhook SID mismatch! Expected: ${config.mypos.sid}, Got: ${webhookSID}`, logContext);
      res.status(200).send('OK');
      return;
    }

    // Check 4: Validate required webhook fields are present
    const requiredFields = ['IPCmethod', 'SID', 'Amount', 'Currency', 'OrderID'];
    const missingFields = requiredFields.filter(field => !req.body[field]);
    if (missingFields.length > 0) {
      logger.error(`Webhook missing required fields: ${missingFields.join(', ')}`, logContext);
      res.status(200).send('OK');
      return;
    }

    // Check 5: Validate IPCmethod is a valid webhook method
    const validMethods = ['IPCPurchaseNotify', 'IPCPurchaseRollback', 'IPCPurchaseOK', 'IPCPurchaseCancel'];
    if (!validMethods.includes(req.body.IPCmethod)) {
      logger.error(`Invalid IPCmethod: ${req.body.IPCmethod}`, logContext);
      res.status(200).send('OK');
      return;
    }

    // Check 6: Validate Amount is a valid number
    const amount = parseFloat(req.body.Amount);
    if (isNaN(amount) || amount < 0) {
      logger.error(`Invalid amount in webhook: ${req.body.Amount}`, logContext);
      res.status(200).send('OK');
      return;
    }

    // All checks passed, proceed to controller
    next();
  } catch (error: any) {
    logger.error(`Webhook validation error: ${error.message}`, logContext);
    res.status(200).send('OK');
  }
};

