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

/* ═══════ Layout types ═══════ */

export enum LayoutElementType {
  SEAT = 'SEAT',
  DRIVER = 'DRIVER',
  DOOR = 'DOOR',
  STAIRS = 'STAIRS',
  TOILET = 'TOILET',
}

export interface LayoutElement {
  type: LayoutElementType;
  seatNo?: string | null;
  gridX: number;
  gridY: number;
}

export interface LayoutTemplate {
  gridColumns: number;
  gridRows: number;
  hasDecks: boolean;
  lowerDeck: LayoutElement[];
  upperDeck: LayoutElement[];
}

/* ═══════ Bus ═══════ */

export interface BusType {
  id: string;
  name: string;
  target: TargetType;
  totalSeats: number;
  amenities: AmenityEnum[];
  media: MediaType;
  layoutTemplate?: LayoutTemplate | null;
  createdAt?: string;
  updatedAt?: string;
}
