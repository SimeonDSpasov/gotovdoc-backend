import { DocumentType } from './../models/document.model';
import CustomError from './../utils/custom-error.utils';

export type DocumentRequestType = 'speciment' | 'mps_power_of_attorney' | 'leave_request';

export interface DocumentGeneratorConfig {
  type: DocumentType;
  templateName: string;
  requiredFields: string[];
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
    },
  },
};
