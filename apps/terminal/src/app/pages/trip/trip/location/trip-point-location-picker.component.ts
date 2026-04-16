import { CommonModule } from '@angular/common';
import {
  AfterViewInit,
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  ElementRef,
  Input,
  OnDestroy,
  ViewChild,
  inject,
} from '@angular/core';
import {
  AbstractControl,
  FormGroup,
  ReactiveFormsModule,
} from '@angular/forms';
import { TranslateModule } from '@ngx-translate/core';
import * as L from 'leaflet';

let leafletIconsConfigured = false;

function configureLeafletIcons(): void {
  if (leafletIconsConfigured) {
    return;
  }

  delete (L.Icon.Default.prototype as { _getIconUrl?: unknown })._getIconUrl;
  L.Icon.Default.mergeOptions({
    iconRetinaUrl: 'assets/media/leaflet/marker-icon-2x.png',
    iconUrl: 'assets/media/leaflet/marker-icon.png',
    shadowUrl: 'assets/media/leaflet/marker-shadow.png',
  });

  leafletIconsConfigured = true;
}

@Component({
  selector: 'app-trip-point-location-picker',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, TranslateModule],
  templateUrl: './trip-point-location-picker.component.html',
  styleUrls: ['./trip-point-location-picker.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TripPointLocationPickerComponent
  implements AfterViewInit, OnDestroy
{
  private readonly cdr = inject(ChangeDetectorRef);

  @Input({ required: true }) pointControl!: AbstractControl;
  @ViewChild('mapContainer')
  private mapContainer?: ElementRef<HTMLDivElement>;

  private map?: L.Map;
  private marker?: L.Marker;

  locating = false;
  geolocationErrorKey: string | null = null;

  readonly defaultCenter: L.LatLngTuple = [33.8869, 9.5375];
  readonly defaultZoom = 6;
  readonly selectedZoom = 15;

  get group(): FormGroup {
    return this.pointControl as FormGroup;
  }

  get hasCoordinates(): boolean {
    return this.coordinates !== null;
  }

  get coordinates(): { lat: number; lng: number } | null {
    const lat = this.getNumberValue('latitude');
    const lng = this.getNumberValue('longitude');

    if (lat === null || lng === null) {
      return null;
    }

    return { lat, lng };
  }

  ngAfterViewInit(): void {
    setTimeout(() => this.ensureMapReady(), 0);
  }

  ensureMapReady(): void {
    if (!this.mapContainer || this.map) {
      this.invalidateMap();
      return;
    }

    configureLeafletIcons();

    const initial = this.coordinates;
    this.map = L.map(this.mapContainer.nativeElement, {
      scrollWheelZoom: false,
    }).setView(
      initial ? [initial.lat, initial.lng] : this.defaultCenter,
      initial ? this.selectedZoom : this.defaultZoom,
    );

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap contributors',
    }).addTo(this.map);

    this.map.on('click', (event: L.LeafletMouseEvent) => {
      this.applyCoordinates(event.latlng.lat, event.latlng.lng, true);
    });

    if (initial) {
      this.setMarkerPosition(initial.lat, initial.lng);
    }

    this.invalidateMap();
  }

  useCurrentLocation(): void {
    if (!('geolocation' in navigator)) {
      this.geolocationErrorKey = 'TRIPS.CREATE.LOCATION.ERROR_UNAVAILABLE';
      this.cdr.markForCheck();
      return;
    }

    this.locating = true;
    this.geolocationErrorKey = null;
    this.cdr.markForCheck();

    navigator.geolocation.getCurrentPosition(
      (position) => {
        this.locating = false;
        this.applyCoordinates(
          position.coords.latitude,
          position.coords.longitude,
          true,
        );
      },
      (error) => {
        this.locating = false;
        this.geolocationErrorKey =
          error.code === error.PERMISSION_DENIED
            ? 'TRIPS.CREATE.LOCATION.ERROR_PERMISSION'
            : 'TRIPS.CREATE.LOCATION.ERROR_UNAVAILABLE';
        this.cdr.markForCheck();
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 60000,
      },
    );
  }

  clearCoordinates(): void {
    this.group.patchValue(
      {
        latitude: null,
        longitude: null,
      },
      { emitEvent: false },
    );

    if (this.marker) {
      this.marker.remove();
      this.marker = undefined;
    }

    if (this.map) {
      this.map.flyTo(this.defaultCenter, this.defaultZoom, { duration: 0.6 });
    }

    this.geolocationErrorKey = null;
    this.cdr.markForCheck();
  }

  onCoordinateBlur(): void {
    const latControl = this.group.get('latitude');
    const lngControl = this.group.get('longitude');
    const lat = this.getNumberValue('latitude');
    const lng = this.getNumberValue('longitude');

    if (lat === null && lng === null) {
      if (this.marker) {
        this.marker.remove();
        this.marker = undefined;
      }
      this.cdr.markForCheck();
      return;
    }

    if (
      lat === null ||
      lng === null ||
      latControl?.invalid ||
      lngControl?.invalid
    ) {
      this.cdr.markForCheck();
      return;
    }

    this.applyCoordinates(lat, lng, false);
  }

  ngOnDestroy(): void {
    this.map?.remove();
  }

  private applyCoordinates(lat: number, lng: number, focusMap: boolean): void {
    const roundedLat = this.roundCoordinate(lat);
    const roundedLng = this.roundCoordinate(lng);

    this.group.patchValue(
      {
        latitude: roundedLat,
        longitude: roundedLng,
      },
      { emitEvent: false },
    );

    this.ensureMapReady();
    this.setMarkerPosition(roundedLat, roundedLng);

    if (this.map) {
      const action = focusMap ? 'flyTo' : 'setView';
      this.map[action]([roundedLat, roundedLng], this.selectedZoom, {
        duration: focusMap ? 0.8 : undefined,
      } as L.ZoomPanOptions);
    }

    this.geolocationErrorKey = null;
    this.cdr.markForCheck();
  }

  private setMarkerPosition(lat: number, lng: number): void {
    if (!this.map) {
      return;
    }

    if (this.marker) {
      this.marker.setLatLng([lat, lng]);
      return;
    }

    this.marker = L.marker([lat, lng], {
      draggable: true,
      autoPan: true,
    }).addTo(this.map);

    this.marker.on('dragend', () => {
      const nextPosition = this.marker?.getLatLng();
      if (!nextPosition) {
        return;
      }

      this.applyCoordinates(nextPosition.lat, nextPosition.lng, false);
    });
  }

  private invalidateMap(): void {
    if (!this.map) {
      return;
    }

    setTimeout(() => this.map?.invalidateSize(), 0);
  }

  private getNumberValue(controlName: 'latitude' | 'longitude'): number | null {
    const rawValue = this.group.get(controlName)?.value;

    if (rawValue === null || rawValue === undefined || rawValue === '') {
      return null;
    }

    const numericValue = Number(rawValue);
    return Number.isFinite(numericValue) ? numericValue : null;
  }

  private roundCoordinate(value: number): number {
    return Math.round(value * 1_000_000) / 1_000_000;
  }
}
