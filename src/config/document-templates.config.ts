import { DocumentType } from './../models/document.model';
import CustomError from './../utils/custom-error.utils';
import { calculateLoan } from './../utils/loan-calculation.util';
import { amountToWordsEUR } from './../utils/number-to-bulgarian-words.util';

export type DocumentRequestType = 'speciment' | 'mps_power_of_attorney' | 'leave_request' | 'loan_agreement' | 'source_of_funds_declaration' | 'employment_contract';

/**
* Convert a date string (ISO or similar) to Bulgarian format: dd.mm.yyyy г.
* Handles: "2026-02-20", "2026-02-20T00:00:00Z", "20.02.2026", etc.
*/
export function toBulgarianDate(value: string): string {
 if (!value) return value;

 // Already in dd.mm.yyyy format
 if (/^\d{2}\.\d{2}\.\d{4}/.test(value)) {
  return value.replace(/ г\.?$/, '') + ' г.';
 }

 // ISO format: YYYY-MM-DD or YYYY-MM-DDTHH:mm:ss
 const isoMatch = value.match(/^(\d{4})-(\d{2})-(\d{2})/);
 if (isoMatch) {
  return `${isoMatch[3]}.${isoMatch[2]}.${isoMatch[1]} г.`;
 }

 return value;
}

export interface DocumentGeneratorConfig {
 type: DocumentType;
 templateName: string;
 requiredFields: string[];
 dateFields?: string[];
 documentName: string;
 fileName: string;
 orderItem: {
  id: string;
  name: string;
  description: string;
 };
 getEmailPayload: (data: Record<string, any>) => {
  fullName: string;
  companyName: string;
  documentName: string;
 };
 validate?: (data: Record<string, any>) => void;
 prepareRenderData?: (data: Record<string, any>) => void;
}

export const DOCUMENT_GENERATORS: Record<DocumentRequestType, DocumentGeneratorConfig> = {
 speciment: {
  type: DocumentType.Speciment,
  templateName: 'speciment.docx',
  requiredFields: [
   'three_names',
   'egn',
   'id_number',
   'id_year',
   'id_issuer',
   'company_name',
   'company_adress',
   'email',
  ],
  dateFields: ['id_year'],
  documentName: 'Спесимент',
  fileName: 'specimen-document.pdf',
  orderItem: {
   id: 'speciment',
   name: 'Спесимент',
   description: 'Спесимент документ',
  },
  getEmailPayload: (data) => ({
   fullName: data.three_names,
   companyName: data.company_name,
   documentName: 'Спесимент',
  }),
 },
 mps_power_of_attorney: {
  type: DocumentType.MpsPowerOfAttorney,
  templateName: 'Palnomoshtno_MPS_Template.docx',
  requiredFields: [
   'principal_full_name',
   'principal_egn',
   'principal_id_number',
   'principal_id_issue_date',
   'principal_id_issuer',
   'principal_address',
   'authorized_full_name',
   'authorized_egn',
   'authorized_id_number',
   'authorized_id_issue_date',
   'authorized_id_issuer',
   'authorized_address',
   'car_type',
   'car_make_model',
   'car_registration_number',
   'car_vin',
   'car_engine_number',
   'car_color',
   'date',
   'place',
   'email',
  ],
  dateFields: ['date', 'principal_id_issue_date', 'authorized_id_issue_date'],
  documentName: 'Пълномощно за управление на МПС',
  fileName: 'palnomoshtno-mps.pdf',
  orderItem: {
   id: 'mps-power-of-attorney',
   name: 'Пълномощно за управление на МПС',
   description: 'Пълномощно за управление на МПС',
  },
  getEmailPayload: (data) => ({
   fullName: data.principal_full_name,
   companyName: '',
   documentName: 'Пълномощно за управление на МПС',
  }),
 },
 leave_request: {
  type: DocumentType.LeaveRequest,
  templateName: 'Molba_Za_Otpusk_Template.docx',
  requiredFields: [
   'company_name',
   'employee_full_name',
   'employee_position',
   'leave_type',
   'leave_days',
   'start_date',
   'request_date',
   'email',
  ],
  dateFields: ['start_date', 'request_date'],
  documentName: 'Молба за отпуск',
  fileName: 'molba-za-otpusk.pdf',
  orderItem: {
   id: 'leave-request',
   name: 'Молба за отпуск',
   description: 'Молба за отпуск',
  },
  getEmailPayload: (data) => ({
   fullName: data.employee_full_name,
   companyName: data.company_name,
   documentName: 'Молба за отпуск',
  }),
  validate: (data) => {
   if (data.leave_type !== 'платен' && data.leave_type !== 'неплатен') {
    throw new CustomError(400, 'Invalid leave_type (expected: платен или неплатен)');
   }

   data.legal_basis = data.leave_type === 'платен'
    ? 'чл. 155, ал. 1'
    : 'чл. 160, ал. 1';
  },
 },
 loan_agreement: {
  type: DocumentType.LoanAgreement,
  templateName: 'Dogovor_Za_Zaem_Template.docx',
  requiredFields: [
   'lender_type', 'borrower_type',
   'contract_date', 'contract_city',
   'loan_amount', 'interest_rate', 'return_date',
   'payment_method', 'return_method', 'email',
  ],
  dateFields: ['contract_date', 'lender_id_issue_date', 'borrower_id_issue_date', 'return_date'],
  documentName: 'Договор за заем',
  fileName: 'dogovor-za-zaem.pdf',
  orderItem: {
   id: 'loan-agreement',
   name: 'Договор за заем',
   description: 'Договор за заем между физически и юридически лица',
  },
  getEmailPayload: (data) => ({
   fullName: data.lender_is_legal
    ? data.lender_representative_name
    : data.lender_full_name,
   companyName: data.lender_company_name || '',
   documentName: 'Договор за заем',
  }),
  validate: (data) => {
   // Default type for backwards compatibility with old documents
   data.lender_type = data.lender_type || 'ФИЗИЧЕСКО ЛИЦЕ';
   data.borrower_type = data.borrower_type || 'ФИЗИЧЕСКО ЛИЦЕ';

   const lenderIsPhysical = data.lender_type === 'ФИЗИЧЕСКО ЛИЦЕ';
   const lenderIsLegal = data.lender_type === 'ЮРИДИЧЕСКО ЛИЦЕ';
   const borrowerIsPhysical = data.borrower_type === 'ФИЗИЧЕСКО ЛИЦЕ';
   const borrowerIsLegal = data.borrower_type === 'ЮРИДИЧЕСКО ЛИЦЕ';

   if (!lenderIsPhysical && !lenderIsLegal) {
    throw new CustomError(400, 'Невалиден тип лице за заемодателя');
   }
   if (!borrowerIsPhysical && !borrowerIsLegal) {
    throw new CustomError(400, 'Невалиден тип лице за заемополучателя');
   }

   // Lender validation
   if (lenderIsPhysical) {
    const required = ['lender_full_name', 'lender_egn', 'lender_id_number', 'lender_id_issue_date', 'lender_id_issuer', 'lender_address'];
    const missing = required.filter(f => !data[f]);
    if (missing.length) throw new CustomError(400, `Липсващи полета за заемодателя: ${missing.join(', ')}`);
    if (!/^\d{10}$/.test(data.lender_egn)) {
     throw new CustomError(400, 'Невалидно ЕГН на заемодателя (очаква се 10 цифри)');
    }
   }
   if (lenderIsLegal) {
    const required = ['lender_company_name', 'lender_eik', 'lender_company_address', 'lender_representative_name', 'lender_representative_egn'];
    const missing = required.filter(f => !data[f]);
    if (missing.length) throw new CustomError(400, `Липсващи полета за заемодателя: ${missing.join(', ')}`);
    if (!/^\d{9,13}$/.test(data.lender_eik)) {
     throw new CustomError(400, 'Невалиден ЕИК на заемодателя (очаква се 9 до 13 цифри)');
    }
    if (!/^\d{10}$/.test(data.lender_representative_egn)) {
     throw new CustomError(400, 'Невалидно ЕГН на представителя на заемодателя (очаква се 10 цифри)');
    }
   }

   // Borrower validation
   if (borrowerIsPhysical) {
    const required = ['borrower_full_name', 'borrower_egn', 'borrower_id_number', 'borrower_id_issue_date', 'borrower_id_issuer', 'borrower_address'];
    const missing = required.filter(f => !data[f]);
    if (missing.length) throw new CustomError(400, `Липсващи полета за заемополучателя: ${missing.join(', ')}`);
    if (!/^\d{10}$/.test(data.borrower_egn)) {
     throw new CustomError(400, 'Невалидно ЕГН на заемополучателя (очаква се 10 цифри)');
    }
   }
   if (borrowerIsLegal) {
    const required = ['borrower_company_name', 'borrower_eik', 'borrower_company_address', 'borrower_representative_name', 'borrower_representative_egn'];
    const missing = required.filter(f => !data[f]);
    if (missing.length) throw new CustomError(400, `Липсващи полета за заемополучателя: ${missing.join(', ')}`);
    if (!/^\d{9,13}$/.test(data.borrower_eik)) {
     throw new CustomError(400, 'Невалиден ЕИК на заемополучателя (очаква се 9 до 13 цифри)');
    }
    if (!/^\d{10}$/.test(data.borrower_representative_egn)) {
     throw new CustomError(400, 'Невалидно ЕГН на представителя на заемополучателя (очаква се 10 цифри)');
    }
   }

   // Validate loan amount
   const amount = parseFloat(data.loan_amount);
   if (isNaN(amount) || amount <= 0) {
    throw new CustomError(400, 'Сумата на заема трябва да е положително число');
   }

   // Validate interest rate
   const rate = parseFloat(data.interest_rate);
   if (isNaN(rate) || rate < 0) {
    throw new CustomError(400, 'Лихвата трябва да е неотрицателно число');
   }

   // Validate return date is after contract date
   const contractDate = new Date(data.contract_date);
   const returnDate = new Date(data.return_date);
   if (returnDate <= contractDate) {
    throw new CustomError(400, 'Датата на връщане трябва да е след датата на договора');
   }

   // Validate IBAN when bank payment is selected
   const ibanPattern = /^BG\d{2}[A-Z]{4}\d{6}[A-Za-z0-9]{8}$/;
   if (data.payment_method === 'по банков път') {
    if (!data.payment_iban || !ibanPattern.test(data.payment_iban)) {
     throw new CustomError(400, 'Моля, въведете валиден IBAN за превод на заема');
    }
   }
   if (data.return_method === 'по банков път') {
    if (!data.return_iban || !ibanPattern.test(data.return_iban)) {
     throw new CustomError(400, 'Моля, въведете валиден IBAN за връщане на заема');
    }
   }

   // Ensure IBAN fields have defaults for template
   data.payment_iban = data.payment_iban || '';
   data.return_iban = data.return_iban || '';

   // Perform calculations and inject computed fields into data
   const calc = calculateLoan(amount, rate, data.contract_date, data.return_date);
   data.loan_amount = amount.toFixed(2);
   data.loan_amount_words = calc.principalWords;
   data.interest_rate = rate.toFixed(1);
   data.interest_rate_words = calc.interestRateWords;
   data.interest_amount = calc.interestAmount.toFixed(2);
   data.interest_amount_words = calc.interestAmountWords;
   data.total_return = calc.totalReturn.toFixed(2);
   data.total_return_words = calc.totalReturnWords;
   data.days_between = calc.daysBetween;

   // Set boolean flags for template conditionals
   data.lender_is_physical = lenderIsPhysical;
   data.lender_is_legal = lenderIsLegal;
   data.borrower_is_physical = borrowerIsPhysical;
   data.borrower_is_legal = borrowerIsLegal;

   // Default empty strings for optional template fields
   data.lender_company_name = data.lender_company_name || '';
   data.lender_eik = data.lender_eik || '';
   data.lender_company_address = data.lender_company_address || '';
   data.lender_representative_name = data.lender_representative_name || '';
   data.lender_representative_egn = data.lender_representative_egn || '';
   data.borrower_company_name = data.borrower_company_name || '';
   data.borrower_eik = data.borrower_eik || '';
   data.borrower_company_address = data.borrower_company_address || '';
   data.borrower_representative_name = data.borrower_representative_name || '';
   data.borrower_representative_egn = data.borrower_representative_egn || '';
  },
  prepareRenderData: (data) => {
   const lenderType = data.lender_type || 'ФИЗИЧЕСКО ЛИЦЕ';
   data.lender_is_physical = lenderType === 'ФИЗИЧЕСКО ЛИЦЕ';
   data.lender_is_legal = lenderType === 'ЮРИДИЧЕСКО ЛИЦЕ';
   const borrowerType = data.borrower_type || 'ФИЗИЧЕСКО ЛИЦЕ';
   data.borrower_is_physical = borrowerType === 'ФИЗИЧЕСКО ЛИЦЕ';
   data.borrower_is_legal = borrowerType === 'ЮРИДИЧЕСКО ЛИЦЕ';
   // Default empty strings for optional template fields
   data.lender_company_name = data.lender_company_name || '';
   data.lender_eik = data.lender_eik || '';
   data.lender_company_address = data.lender_company_address || '';
   data.lender_representative_name = data.lender_representative_name || '';
   data.lender_representative_egn = data.lender_representative_egn || '';
   data.borrower_company_name = data.borrower_company_name || '';
   data.borrower_eik = data.borrower_eik || '';
   data.borrower_company_address = data.borrower_company_address || '';
   data.borrower_representative_name = data.borrower_representative_name || '';
   data.borrower_representative_egn = data.borrower_representative_egn || '';
  },
 },
 source_of_funds_declaration: {
  type: DocumentType.SourceOfFundsDeclaration,
  templateName: 'Deklaratsiya_Proizhod_Sredstva_Template.docx',
  requiredFields: [
   'declarant_type',
   'declaration_date',
   'amount',
   'transaction_subject',
   'funds_source',
   'email',
  ],
  dateFields: ['declaration_date', 'id_issue_date'],
  documentName: 'Декларация за произход на средства',
  fileName: 'deklaratsiya-proizhod-sredstva.pdf',
  orderItem: {
   id: 'source-of-funds-declaration',
   name: 'Декларация за произход на средства',
   description: 'Декларация по чл.4, ал.7 и чл.6, ал.5, т.3 ЗМИП',
  },
  getEmailPayload: (data) => ({
   fullName: data.is_legal
    ? data.representative_full_name
    : data.full_name,
   companyName: data.company_name || '',
   documentName: 'Декларация за произход на средства',
  }),
  validate: (data) => {
   const isPhysical = data.declarant_type === 'ФИЗИЧЕСКО ЛИЦЕ';
   const isLegal = data.declarant_type === 'ЮРИДИЧЕСКО ЛИЦЕ';

   if (!isPhysical && !isLegal) {
    throw new CustomError(400, 'Невалиден тип лице (очаква се ФИЗИЧЕСКО ЛИЦЕ или ЮРИДИЧЕСКО ЛИЦЕ)');
   }

   if (isPhysical) {
    const physicalRequired = ['firstName', 'middleName', 'lastName', 'egn', 'citizenship', 'id_number', 'id_issue_date', 'id_issuer', 'declarant_city', 'address'];
    const missing = physicalRequired.filter(f => !data[f]);
    if (missing.length) {
     throw new CustomError(400, `Липсващи полета за физическо лице: ${missing.join(', ')}`);
    }
    if (!/^\d{10}$/.test(data.egn)) {
     throw new CustomError(400, 'Невалидно ЕГН (очаква се 10 цифри)');
    }
    data.full_name = `${data.firstName} ${data.middleName} ${data.lastName}`;
    data.city = data.declarant_city;
   }

   if (isLegal) {
    const legalRequired = ['company_name', 'eik', 'company_address', 'representative_full_name', 'representative_egn'];
    const missing = legalRequired.filter(f => !data[f]);
    if (missing.length) {
     throw new CustomError(400, `Липсващи полета за юридическо лице: ${missing.join(', ')}`);
    }
    if (!/^\d{9,13}$/.test(data.eik)) {
     throw new CustomError(400, 'Невалиден ЕИК (очаква се 9 до 13 цифри)');
    }
    if (!/^\d{10}$/.test(data.representative_egn)) {
     throw new CustomError(400, 'Невалидно ЕГН на представителя (очаква се 10 цифри)');
    }
   }

   // Validate amount
   const amount = parseFloat(data.amount);
   if (isNaN(amount) || amount <= 0) {
    throw new CustomError(400, 'Сумата трябва да е положително число');
   }

   // Compute amount in words
   data.amount_formatted = amount.toFixed(2);
   data.amount_words = amountToWordsEUR(amount);

   // Set boolean flags for template conditionals
   data.is_physical = isPhysical;
   data.is_legal = isLegal;
  },
  prepareRenderData: (data) => {
   const type = data.declarant_type || 'ФИЗИЧЕСКО ЛИЦЕ';
   data.is_physical = type === 'ФИЗИЧЕСКО ЛИЦЕ';
   data.is_legal = type === 'ЮРИДИЧЕСКО ЛИЦЕ';
   data.full_name = data.full_name || '';
   data.city = data.city || data.declarant_city || '';
   data.company_name = data.company_name || '';
   data.eik = data.eik || '';
   data.company_address = data.company_address || '';
   data.representative_full_name = data.representative_full_name || '';
   data.representative_egn = data.representative_egn || '';
  },
 },
 employment_contract: {
  type: DocumentType.EmploymentContract,
  templateName: 'Trudov_Dogovor_Template.docx',
  requiredFields: [
   'company_name',
   'company_eik',
   'company_city',
   'company_address',
   'employer_representative_name',
   'employer_representative_egn',
   'employee_firstName',
   'employee_middleName',
   'employee_lastName',
   'employee_egn',
   'employee_id_number',
   'employee_id_issue_date',
   'employee_id_issuer',
   'employee_city',
   'employee_address',
   'contract_date',
   'contract_city',
   'nkpd_code',
   'workplace',
   'start_date',
   'contract_term',
   'probation_period',
   'salary',
   'working_hours_per_day',
   'working_days_per_week',
   'paid_leave_days',
   'email',
  ],
  dateFields: ['contract_date', 'start_date', 'employee_id_issue_date', 'contract_end_date'],
  documentName: 'Трудов договор',
  fileName: 'trudov-dogovor.pdf',
  orderItem: {
   id: 'employment-contract',
   name: 'Трудов договор',
   description: 'Трудов договор по Кодекса на труда',
  },
  getEmailPayload: (data) => ({
   fullName: data.employee_full_name,
   companyName: data.company_name,
   documentName: 'Трудов договор',
  }),
  validate: (data) => {
   // Build employee full name
   data.employee_full_name = `${data.employee_firstName} ${data.employee_middleName} ${data.employee_lastName}`;

   // Validate EGN
   if (!/^\d{10}$/.test(data.employee_egn)) {
    throw new CustomError(400, 'Невалидно ЕГН на служителя (очаква се 10 цифри)');
   }
   if (!/^\d{10}$/.test(data.employer_representative_egn)) {
    throw new CustomError(400, 'Невалидно ЕГН на представителя на работодателя (очаква се 10 цифри)');
   }

   // Validate EIK
   if (!/^\d{9,13}$/.test(data.company_eik)) {
    throw new CustomError(400, 'Невалиден ЕИК (очаква се 9 до 13 цифри)');
   }

   // Validate salary
   const salary = parseFloat(data.salary);
   if (isNaN(salary) || salary <= 0) {
    throw new CustomError(400, 'Заплатата трябва да е положително число');
   }
   data.salary = salary.toFixed(2);
   data.salary_words = amountToWordsEUR(salary);

   // Contract term flags
   const isFixedTerm = data.contract_term === 'определен срок';
   const isIndefinite = data.contract_term === 'без срок';
   data.is_fixed_term = isFixedTerm;
   data.is_indefinite = isIndefinite;

   if (isFixedTerm && !data.contract_end_date) {
    throw new CustomError(400, 'При срочен договор е необходима крайна дата');
   }

   // Probation flags
   const hasProbation = data.probation_period === 'със срок на изпитване';
   const noProbation = data.probation_period === 'без изпитване';
   data.has_probation = hasProbation;
   data.no_probation = noProbation;

   if (hasProbation && !data.probation_months) {
    throw new CustomError(400, 'При договор със срок на изпитване е необходим брой месеци');
   }

   // Default optional fields
   data.contract_end_date = data.contract_end_date || '';
   data.probation_months = data.probation_months || '';
   data.work_experience_years = data.work_experience_years || '0';
   data.work_experience_months = data.work_experience_months || '0';
   data.work_experience_days = data.work_experience_days || '0';
   data.company_oblast = data.company_oblast || '';
   data.employee_oblast = data.employee_oblast || '';
   data.contract_oblast = data.contract_oblast || '';
  },
  prepareRenderData: (data) => {
   data.employee_full_name = data.employee_full_name || `${data.employee_firstName || ''} ${data.employee_middleName || ''} ${data.employee_lastName || ''}`.trim();
   const term = data.contract_term || 'без срок';
   data.is_fixed_term = term === 'определен срок';
   data.is_indefinite = term === 'без срок';
   const probation = data.probation_period || 'без изпитване';
   data.has_probation = probation === 'със срок на изпитване';
   data.no_probation = probation === 'без изпитване';
   data.contract_end_date = data.contract_end_date || '';
   data.probation_months = data.probation_months || '';
   data.work_experience_years = data.work_experience_years || '0';
   data.work_experience_months = data.work_experience_months || '0';
   data.work_experience_days = data.work_experience_days || '0';
  },
 },
};
