import { DocumentType } from './../models/document.model';
import CustomError from './../utils/custom-error.utils';

export type DocumentRequestType = 'speciment' | 'mps_power_of_attorney' | 'leave_request';

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
};
