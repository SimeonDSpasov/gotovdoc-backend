/**
* Trademark Order Validation Utility
*
* Centralized validation for all trademark order input fields.
* Throws CustomError(400, ...) on validation failure.
*/

import CustomError from './custom-error.utils';
import { VALID_MARK_TYPES, MarkType } from '../config/trademark-pricing.config';

// ── JSON Parsing ──

/**
* Safely parse a JSON string field from FormData.
* Also accepts an already-parsed object (for testing / non-FormData clients).
*/
export function parseJsonField<T>(raw: unknown, fieldName: string): T {
 if (typeof raw === 'string') {
  try {
   return JSON.parse(raw);
  } catch {
   throw new CustomError(400, `Invalid JSON in field: ${fieldName}`);
  }
 }
 if (typeof raw === 'object' && raw !== null) {
  return raw as T;
 }
 throw new CustomError(400, `Missing or invalid field: ${fieldName}`);
}

// ── Format Validators ──

export function isValidEmail(email: string): boolean {
 return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export function isValidPhone(phone: string): boolean {
 return /^[\d\+\-\s]{7,20}$/.test(phone);
}

export function isValidEgn(egn: string): boolean {
 return /^\d{10}$/.test(egn);
}

export function isValidEik(eik: string): boolean {
 return /^\d{9,13}$/.test(eik);
}

export function isValidMarkType(markType: string): markType is MarkType {
 return (VALID_MARK_TYPES as readonly string[]).includes(markType);
}

export function isValidNiceClasses(classes: number[]): boolean {
 return classes.length > 0 &&
  classes.every(c => Number.isInteger(c) && c >= 1 && c <= 45);
}

// ── Data Validators ──

export function validateTrademarkCustomerData(data: any): void {
 if (!data || typeof data !== 'object') {
  throw new CustomError(400, 'customerData is required');
 }
 if (!data.email || !isValidEmail(data.email)) {
  throw new CustomError(400, 'Invalid or missing email address');
 }
 if (!data.firstName || typeof data.firstName !== 'string' || data.firstName.trim().length < 2) {
  throw new CustomError(400, 'firstName is required (min 2 characters)');
 }
 if (!data.lastName || typeof data.lastName !== 'string' || data.lastName.trim().length < 2) {
  throw new CustomError(400, 'lastName is required (min 2 characters)');
 }
 if (!data.phone || !isValidPhone(data.phone)) {
  throw new CustomError(400, 'Invalid or missing phone number');
 }

 // Company fields required when isCompany is true
 const isCompany = data.isCompany === true || data.isCompany === 'true';
 if (isCompany) {
  if (!data.companyName || data.companyName.trim().length < 2) {
   throw new CustomError(400, 'companyName is required for company applicants (min 2 characters)');
  }
  if (!data.companyEik || !isValidEik(data.companyEik)) {
   throw new CustomError(400, 'Valid EIK (9-13 digits) is required for company applicants');
  }
  if (!data.companyAddress || data.companyAddress.trim().length < 5) {
   throw new CustomError(400, 'companyAddress is required for company applicants (min 5 characters)');
  }
 }
}

export function validateTrademarkData(data: any): void {
 if (!data || typeof data !== 'object') {
  throw new CustomError(400, 'trademarkData is required');
 }
 if (!data.markType || !isValidMarkType(data.markType)) {
  throw new CustomError(400, `Invalid markType. Must be one of: ${VALID_MARK_TYPES.join(', ')}`);
 }
 if (!data.niceClasses || !Array.isArray(data.niceClasses)) {
  throw new CustomError(400, 'niceClasses must be a non-empty array');
 }

 const niceClasses = data.niceClasses.map(Number);
 if (!isValidNiceClasses(niceClasses)) {
  throw new CustomError(400, 'niceClasses must contain integers between 1 and 45');
 }

 // Priority claims validation
 if (data.priorityClaims && Array.isArray(data.priorityClaims)) {
  for (const claim of data.priorityClaims) {
   if (!claim.country || !claim.applicationDate || !claim.applicationNumber) {
    throw new CustomError(400, 'Each priority claim requires country, applicationDate, and applicationNumber');
   }
  }
 }

 // Exhibition priorities validation
 if (data.exhibitionPriorities && Array.isArray(data.exhibitionPriorities)) {
  for (const ex of data.exhibitionPriorities) {
   if (!ex.exhibitionName || !ex.firstShowingDate) {
    throw new CustomError(400, 'Each exhibition priority requires exhibitionName and firstShowingDate');
   }
  }
 }

 // EU conversion validation
 if (data.hasEuConversion && data.euConversion) {
  if (!data.euConversion.euTrademarkNumber) {
   throw new CustomError(400, 'euTrademarkNumber is required when EU conversion is enabled');
  }
  if (data.euConversion.applicationDate && !/^\d{4}-\d{2}-\d{2}$/.test(data.euConversion.applicationDate)) {
   throw new CustomError(400, 'EU conversion applicationDate must be in YYYY-MM-DD format');
  }
  if (data.euConversion.priorityDate && !/^\d{4}-\d{2}-\d{2}$/.test(data.euConversion.priorityDate)) {
   throw new CustomError(400, 'EU conversion priorityDate must be in YYYY-MM-DD format');
  }
 }

 // International transformation validation
 if (data.hasInternationalTransformation && !data.internationalRegistrationNumber) {
  throw new CustomError(400, 'internationalRegistrationNumber is required when international transformation is enabled');
 }
}

export function validateCorrespondenceAddress(data: any): void {
 if (!data || typeof data !== 'object') {
  throw new CustomError(400, 'correspondenceAddress is required');
 }
 if (!data.fullName || data.fullName.trim().length < 3) {
  throw new CustomError(400, 'Correspondence: fullName is required (min 3 characters)');
 }
 if (!data.streetAddress || data.streetAddress.trim().length < 5) {
  throw new CustomError(400, 'Correspondence: streetAddress is required (min 5 characters)');
 }
 if (!data.city) {
  throw new CustomError(400, 'Correspondence: city is required');
 }
 if (!data.postalCode) {
  throw new CustomError(400, 'Correspondence: postalCode is required');
 }
 if (!data.country) {
  throw new CustomError(400, 'Correspondence: country is required');
 }
}

export function validatePowerOfAttorneyData(data: any): void {
 if (!data || typeof data !== 'object') {
  throw new CustomError(400, 'powerOfAttorneyData is required');
 }
 if (!data.managerFullName || data.managerFullName.trim().length < 5) {
  throw new CustomError(400, 'POA: managerFullName is required (min 5 characters)');
 }
 if (!data.managerEgn || !isValidEgn(data.managerEgn)) {
  throw new CustomError(400, 'POA: managerEgn must be exactly 10 digits');
 }
 if (!data.managerAddress || data.managerAddress.trim().length < 10) {
  throw new CustomError(400, 'POA: managerAddress is required (min 10 characters)');
 }
 if (!data.companyName || data.companyName.trim().length < 3) {
  throw new CustomError(400, 'POA: companyName is required (min 3 characters)');
 }
 if (!data.companyType) {
  throw new CustomError(400, 'POA: companyType is required');
 }
 if (!data.city) {
  throw new CustomError(400, 'POA: city is required');
 }
}

// ── Draft Validation ──

/**
* Relaxed validation for drafts — only validates fields that are present.
* No required fields except that the request is authenticated.
* Sanitizes mark type and nice classes if they're provided.
*/
export function validateTrademarkDraft(data: {
 customerData?: any;
 trademarkData?: any;
 correspondenceAddress?: any;
 powerOfAttorneyData?: any;
}): void {
 // Validate mark type if present
 if (data.trademarkData?.markType && !isValidMarkType(data.trademarkData.markType)) {
  throw new CustomError(400, `Invalid markType. Must be one of: ${VALID_MARK_TYPES.join(', ')}`);
 }

 // Validate nice classes if present
 if (data.trademarkData?.niceClasses && Array.isArray(data.trademarkData.niceClasses)) {
  const classes = data.trademarkData.niceClasses.map(Number).filter((n: number) => !isNaN(n));
  if (classes.length > 0 && !classes.every((c: number) => Number.isInteger(c) && c >= 1 && c <= 45)) {
   throw new CustomError(400, 'niceClasses must contain integers between 1 and 45');
  }
 }

 // Validate email if present
 if (data.customerData?.email && !isValidEmail(data.customerData.email)) {
  throw new CustomError(400, 'Invalid email address');
 }

 // Validate phone if present
 if (data.customerData?.phone && !isValidPhone(data.customerData.phone)) {
  throw new CustomError(400, 'Invalid phone number');
 }
}
