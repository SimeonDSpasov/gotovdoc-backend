/**
 * Document and Package Prices Configuration
 * 
 * SECURITY: This is the single source of truth for all document and package prices.
 * Frontend prices are validated against these values to prevent price manipulation.
 * 
 * NEVER trust prices from the frontend - always validate against this config!
 */

export enum DocumentType {
  SPECIMENT_TEST = 'speciment_test',
  SPECIMENT = 'speciment',
  NDA = 'nda',
  EMPLOYMENT_CONTRACT = 'employment_contract',
  PERSONAL_DATA_FORM = 'personal_data_form',
}

export enum PackageType {
  EMPLOYMENT_PACKAGE = 'employment_package',
  COMPANY_STARTER_PACKAGE = 'company_starter_package',
  TEST_PRODUCTION_PACKAGE = 'test_production_package',
}

// Individual document prices (in EUR)
export const DOCUMENT_PRICES: Record<DocumentType, number> = {
  [DocumentType.SPECIMENT_TEST]: 10, // Example price - adjust as needed
  [DocumentType.SPECIMENT]: 20,
  [DocumentType.NDA]: 15,
  [DocumentType.EMPLOYMENT_CONTRACT]: 25,
  [DocumentType.PERSONAL_DATA_FORM]: 10,
};

// Package prices (in EUR)
export const PACKAGE_PRICES: Record<PackageType, number> = {
  [PackageType.EMPLOYMENT_PACKAGE]: 100,
  [PackageType.COMPANY_STARTER_PACKAGE]: 100,
  [PackageType.TEST_PRODUCTION_PACKAGE]: 1,
};

// Package document composition
export const PACKAGE_DOCUMENTS: Record<PackageType, DocumentType[]> = {
  [PackageType.EMPLOYMENT_PACKAGE]: [
    DocumentType.EMPLOYMENT_CONTRACT,
    DocumentType.NDA,
    DocumentType.PERSONAL_DATA_FORM,
  ],
  [PackageType.COMPANY_STARTER_PACKAGE]: [
    DocumentType.SPECIMENT,
    DocumentType.NDA,
  ],
  [PackageType.TEST_PRODUCTION_PACKAGE]: [
    DocumentType.SPECIMENT_TEST,
  ],
};

// VAT rate (20%)
export const VAT_RATE = 0.20;

/**
 * Get document price by ID
 */
export function getDocumentPrice(documentId: string): number | null {
  const price = DOCUMENT_PRICES[documentId as DocumentType];

  return price !== undefined ? price : null;
}

/**
 * Get package price by ID
 */
export function getPackagePrice(packageId: string): number | null {
  const price = PACKAGE_PRICES[packageId as PackageType];

  return price !== undefined ? price : null;
}

/**
 * Get all documents in a package
 */
export function getPackageDocuments(packageId: string): DocumentType[] | null {
  const documents = PACKAGE_DOCUMENTS[packageId as PackageType];

  return documents || null;
}

/**
 * Validate if a price matches the expected price for a document or package
 */
export function validatePrice(itemId: string, providedPrice: number): boolean {
  // Check if it's a package
  const packagePrice = getPackagePrice(itemId);
  if (packagePrice !== null) {
    return Math.abs(providedPrice - packagePrice) < 0.01; // Allow 0.01 EUR tolerance for rounding
  }

  // Check if it's a document
  const documentPrice = getDocumentPrice(itemId);
  if (documentPrice !== null) {
    return Math.abs(providedPrice - documentPrice) < 0.01;
  }

  // Unknown item ID
  return false;
}

/**
 * Calculate total price with VAT
 */
export function calculateTotalWithVAT(baseAmount: number): { vat: number; total: number } {
  const vat = Math.round(baseAmount * VAT_RATE * 100) / 100;
  const total = Math.round((baseAmount + vat) * 100) / 100;
  
  return { vat, total };
}

