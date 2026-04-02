import { PictureType } from './account.model';
import { PhoneType } from './phone-type.model';

export type CompanyStatus = 'ACTIVE' | 'SUSPENDED';

export interface BankAccountType {
  iban?: string;
  bankName?: string;
  accountHolder?: string;
}

export interface ContactType {
  email?: string;
  phone?: PhoneType;
}

export interface CompanyType {
  id?: string;
  name?: string;
  legalName?: string;
  taxId?: string;
  status?: CompanyStatus;
  platformFeePercentage?: number;
  currencyId?: string;
  emailTemplate?: string;
  picture?: PictureType;
  bankAccount?: BankAccountType;
  contact?: ContactType;
  createdAt?: string;
  updatedAt?: string;
}
