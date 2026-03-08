import { MediaType, TargetType } from './shared.model';

export enum AmenityEnum {
  WIFI = 'WIFI',
  POWER_OUTLET = 'POWER_OUTLET',
  TV = 'TV',
  SNACKS = 'SNACKS',
  AC = 'AC',
  TOILET = 'TOILET',
  LUGGAGE = 'LUGGAGE',
  USB = 'USB',
}

export interface BusType {
  id: string;
  name: string;
  target: TargetType;
  totalSeats: number;
  amenities: AmenityEnum[];
  media: MediaType;
  createdAt?: string;
  updatedAt?: string;
}
