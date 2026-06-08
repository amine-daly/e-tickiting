import { PhoneType } from 'src/app/modules/auth/models/user-type';

export interface AgencyType {
  id: string;
  name: string;
  address: string;
  email: string;
  phone: PhoneType;
}
