import AmenityEnum from '../models/amenity.enum';

export const AMENITY_MAP: Record<AmenityEnum, { icon: string; label: string }> =
  {
    [AmenityEnum.WIFI]: { icon: 'bi-wifi', label: 'WiFi' },
    [AmenityEnum.POWER_OUTLET]: { icon: 'bi-plug', label: 'Power Outlet' },
    [AmenityEnum.TV]: { icon: 'bi-tv', label: 'TV' },
    [AmenityEnum.SNACKS]: { icon: 'bi-cup-hot', label: 'Snacks' },
    [AmenityEnum.AC]: { icon: 'bi-snow2', label: 'AC' },
    [AmenityEnum.TOILET]: { icon: 'bi-water', label: 'Toilet' },
    [AmenityEnum.LUGGAGE]: { icon: 'bi-bag-check', label: 'Luggage' },
    [AmenityEnum.USB]: { icon: 'bi-usb', label: 'USB' },
  };

export function formatAmenityName(amenity?: string | null): string {
  if (!amenity) return '';
  return amenity
    .toLowerCase()
    .split('_')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}
