import logger from '@ipi-soft/logger';
import {
  getDocumentPrice,
  getPackagePrice,
  validatePrice,
  calculateTotalWithVAT,
  VAT_RATE,
  PackageType,
  DocumentType,
} from '../config/document-prices.config';

/**
 * Price Validation Service
 * 
 * Validates order prices against backend configuration to prevent price manipulation
 */
class PriceValidationService {
  private static instance: PriceValidationService;
  private readonly logContext = 'PriceValidationService';

  private constructor() {}

  public static getInstance(): PriceValidationService {
    if (!PriceValidationService.instance) {
      PriceValidationService.instance = new PriceValidationService();
    }
    return PriceValidationService.instance;
  }

  /**
   * Validate order items and calculate expected totals
   * 
   * @param items - Array of order items from frontend
   * @returns Validation result with expected prices
   */
  public validateOrder(items: Array<{ id: string; type: 'document' | 'package'; price: number }>): {
    isValid: boolean;
    expectedAmount: number;
    expectedVat: number;
    expectedTotal: number;
    errors: string[];
  } {
    const errors: string[] = [];
    let totalBaseAmount = 0;

    // Validate each item
    for (const item of items) {
      const expectedPrice = this.getExpectedPrice(item.id, item.type);

      if (expectedPrice === null) {
        errors.push(`Unknown ${item.type} ID: ${item.id}`);
        continue;
      }

      // Validate price matches backend configuration
      if (!validatePrice(item.id, item.price)) {
        errors.push(
          `Price mismatch for ${item.type} "${item.id}". Expected: €${expectedPrice}, Received: €${item.price}`
        );
      }

      // Use backend price (not frontend price) for calculation
      totalBaseAmount += expectedPrice;
    }

    // Calculate VAT and total based on backend prices
    const { vat: expectedVat, total: expectedTotal } = calculateTotalWithVAT(totalBaseAmount);

    return {
      isValid: errors.length === 0,
      expectedAmount: totalBaseAmount,
      expectedVat,
      expectedTotal,
      errors,
    };
  }

  /**
   * Get expected price for a document or package
   */
  private getExpectedPrice(itemId: string, type: 'document' | 'package'): number | null {
    if (type === 'package') {
      return getPackagePrice(itemId);
    } else if (type === 'document') {
      return getDocumentPrice(itemId);
    }
    return null;
  }

  /**
   * Validate payment amount matches expected total
   * 
   * @param orderId - Order ID for logging
   * @param receivedAmount - Amount received from payment provider
   * @param expectedTotal - Expected total from order
   * @returns true if amounts match (within tolerance)
   */
  public validatePaymentAmount(orderId: string, receivedAmount: number, expectedTotal: number): boolean {
    const tolerance = 0.01; // 1 cent tolerance for rounding differences

    if (Math.abs(receivedAmount - expectedTotal) > tolerance) {
      logger.error(
        `FRAUD ATTEMPT! Payment amount mismatch for order ${orderId}. Expected: €${expectedTotal}, Received: €${receivedAmount}`,
        this.logContext
      );
      return false;
    }

    return true;
  }

  /**
   * Get price information for a specific item (for debugging/logging)
   */
  public getItemPriceInfo(itemId: string, type: 'document' | 'package'): {
    id: string;
    type: string;
    price: number | null;
  } {
    return {
      id: itemId,
      type,
      price: this.getExpectedPrice(itemId, type),
    };
  }

  /**
   * List all available documents and their prices
   */
  public getAllDocumentPrices(): Record<string, number> {
    const prices: Record<string, number> = {};
    
    for (const docType of Object.values(DocumentType)) {
      const price = getDocumentPrice(docType);
      if (price !== null) {
        prices[docType] = price;
      }
    }
    
    return prices;
  }

  /**
   * List all available packages and their prices
   */
  public getAllPackagePrices(): Record<string, number> {
    const prices: Record<string, number> = {};
    
    for (const pkgType of Object.values(PackageType)) {
      const price = getPackagePrice(pkgType);
      if (price !== null) {
        prices[pkgType] = price;
      }
    }
    
    return prices;
  }
}

export default PriceValidationService.getInstance();

