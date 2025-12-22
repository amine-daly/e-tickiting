export interface PlaceType {
  id?: string;
  city: string;
  location: {
    coordinates: [number, number];
  };
}
