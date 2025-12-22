import { PhoneType } from 'src/app/core/models/user-type';

export interface AgencyType {
  id: string;
  name: string;
  address: string;
  email: string;
  phone: PhoneType;
}
