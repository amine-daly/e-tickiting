import { CommonModule } from '@angular/common';
import {
  AfterViewInit,
  ChangeDetectorRef,
  Component,
  ElementRef,
  OnDestroy,
  OnInit,
  ViewChild,
} from '@angular/core';
import {
  FormBuilder,
  FormGroup,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { Subject, takeUntil } from 'rxjs';
import { isEqual } from 'lodash';
import {
  CurrencyType,
  PointOfSaleType,
} from 'src/app/core/models/account.model';
import { CountryType } from 'src/app/core/models/country-type';
import { StateType } from 'src/app/core/models/state-type';
import { AuthService } from 'src/app/modules/auth';
import { BusinessProfileService } from './business-profile.service';
import * as L from 'leaflet';
import { FormHelper } from 'src/app/core/helpers/form-helper';
import { AlertService } from 'src/app/core/services/alert.service';
import { TranslateModule, TranslateService } from '@ngx-translate/core';

@Component({
  selector: 'app-business-profile',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './business-profile.component.html',
  styleUrls: ['./business-profile.component.scss'],
})
export class BusinessProfileComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();

  @ViewChild('mapContainer') mapContainer: ElementRef<HTMLDivElement>;

  activeTab: 'information' | 'address' = 'information';

  pos: PointOfSaleType;
  currencies: CurrencyType[] = [];
  countries: CountryType[] = [];
  states: StateType[] = [];

  // Leaflet map
  private map: L.Map;
  private marker: L.Marker;

  // Forms
  overviewForm: FormGroup;
  locationForm: FormGroup;

  // initial form values and button states (follow settings pattern)
  private overviewInitValues: any;
  private locationInitValues: any;
  overviewButtonDisabled = true;
  locationButtonDisabled = true;

  // Loading states
  overviewSubmitting = false;
  locationSubmitting = false;
  isOverviewDisabled = false;
  isLocationDisabled = false;

  constructor(
    private fb: FormBuilder,
    private alert: AlertService,
    private cdr: ChangeDetectorRef,
    private authService: AuthService,
    private profileService: BusinessProfileService,
    private translate: TranslateService,
  ) {
    this.profileService.currencies$
      .pipe(takeUntil(this.destroy$))
      .subscribe((data) => {
        this.currencies = data;
        this.cdr.markForCheck();
      });
  }

  ngOnInit(): void {
    // Subscribe to pos changes
    this.authService.pos$.pipe(takeUntil(this.destroy$)).subscribe((pos) => {
      this.pos = pos;
      if (pos) {
        // Overview form
        this.overviewForm = this.fb.group({
          title: [pos.title || '', Validators.required],
          email: [pos.email || '', [Validators.email]],
          phone: this.fb.group({
            countryCode: [pos.phone?.countryCode || ''],
            number: [pos.phone?.number || ''],
          }),
          currencyId: [pos?.currency?.id || ''],
          picture: this.fb.group({
            path: [pos.picture?.path || ''],
            baseUrl: [pos.picture?.baseUrl || ''],
          }),
          emailTemplate: [pos.emailTemplate || ''],
        });
        this.overviewInitValues = this.overviewForm.value;
        this.overviewForm.valueChanges
          .pipe(takeUntil(this.destroy$))
          .subscribe(() => {
            this.overviewButtonDisabled = isEqual(
              this.overviewForm.value,
              this.overviewInitValues,
            );
            this.cdr.markForCheck();
          });
        // Location form
        this.locationForm = this.fb.group({
          addressLine: [pos.location?.addressLine || ''],
          city: [pos.location?.city || ''],
          countryId: [pos.location?.countryId || ''],
          stateId: [pos.location?.stateId || ''],
          zipCode: [pos.location?.zipCode || ''],
          location: this.fb.group({
            lng: [pos.location?.location?.lng || null],
            lat: [pos.location?.location?.lat || null],
          }),
        });
        // follow settings pattern: capture initial values and track changes to enable save button
        this.locationInitValues = this.locationForm.value;
        this.locationForm.valueChanges
          .pipe(takeUntil(this.destroy$))
          .subscribe(() => {
            this.locationButtonDisabled = isEqual(
              this.locationForm.value,
              this.locationInitValues,
            );
            this.cdr.markForCheck();
          });
        this.locationForm
          .get('countryId')
          ?.valueChanges.pipe(takeUntil(this.destroy$))
          .subscribe((countryId) => {
            if (countryId) {
              this.loadStatesByCountry(countryId);
              this.locationForm.patchValue(
                { stateId: '' },
                { emitEvent: false },
              );
            } else {
              this.profileService.resetStates();
              this.states = [];
            }
          });
      }
    });

    // Load reference data
    this.loadCurrencies();
    this.loadCountries();
  }

  private initMap(): void {
    if (this.map) return;

    // Default center (can be adjusted)
    const defaultLat = 33.5731;
    const defaultLng = -7.5898; // Casablanca, Morocco

    this.map = L.map(this.mapContainer.nativeElement).setView(
      [defaultLat, defaultLng],
      13,
    );

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap contributors',
    }).addTo(this.map);

    // Add click handler to set marker
    this.map.on('click', (e: L.LeafletMouseEvent) => {
      this.setMarkerPosition(e.latlng.lat, e.latlng.lng);
      this.updateLocationCoordinates(e.latlng.lat, e.latlng.lng);
    });

    // Fix Leaflet icon paths
    delete (L.Icon.Default.prototype as any)._getIconUrl;
    L.Icon.Default.mergeOptions({
      iconRetinaUrl: 'assets/media/leaflet/marker-icon-2x.png',
      iconUrl: 'assets/media/leaflet/marker-icon.png',
      shadowUrl: 'assets/media/leaflet/marker-shadow.png',
    });

    // Set initial marker if location exists
    const lat = this.locationForm.get('location.lat')?.value;
    const lng = this.locationForm.get('location.lng')?.value;
    if (lat && lng) {
      this.setMarkerPosition(lat, lng);
      this.map.setView([lat, lng], 13);
    }
  }

  private setMarkerPosition(lat: number, lng: number): void {
    if (this.marker) {
      this.marker.setLatLng([lat, lng]);
    } else {
      this.marker = L.marker([lat, lng], { draggable: true }).addTo(this.map);
      this.marker.on('dragend', () => {
        const pos = this.marker.getLatLng();
        this.updateLocationCoordinates(pos.lat, pos.lng);
      });
    }
  }

  private updateLocationCoordinates(lat: number, lng: number): void {
    this.locationForm.patchValue({
      location: {
        lat: lat,
        lng: lng,
      },
    });
  }

  onTabChange(): void {
    if (this.activeTab === 'address') {
      setTimeout(() => {
        if (this.mapContainer) {
          this.initMap();
          this.map?.invalidateSize();
        }
      }, 100);
    }
  }
  // ========== Data Loading ==========
  private loadCurrencies(): void {
    this.profileService
      .getCurrencies()
      .pipe(takeUntil(this.destroy$))
      .subscribe();
  }

  private loadCountries(): void {
    this.profileService
      .getCountries()
      .pipe(takeUntil(this.destroy$))
      .subscribe((countries) => {
        this.countries = countries;
        this.cdr.markForCheck();
      });
  }

  private loadStatesByCountry(countryId: string): void {
    this.profileService
      .getStatesByCountry(countryId)
      .pipe(takeUntil(this.destroy$))
      .subscribe((states) => {
        this.states = states;
        this.cdr.markForCheck();
      });
  }

  // ========== Form Submissions ==========
  submitOverview(): void {
    this.overviewButtonDisabled = true;
    if (this.overviewForm.invalid || !this.pos?.id) return;

    this.overviewSubmitting = true;
    this.isOverviewDisabled = true;

    // send only changed values following settings component pattern
    const changed = FormHelper.getChangedValues(
      this.overviewForm.value,
      this.overviewInitValues,
    );

    this.profileService
      .updatePos(this.pos.id, changed)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (updatedPos) => {
          this.overviewSubmitting = false;
          this.overviewInitValues = this.overviewForm.value;
          this.overviewButtonDisabled = true;
          this.alert.success(this.t('BUSINESS_PROFILE.MESSAGES.SAVE_SUCCESS'));
          this.cdr.markForCheck();
        },
        error: (err) => {
          this.overviewSubmitting = false;
          this.isOverviewDisabled = false;
          const msg = err?.error?.message || err?.message || null;
          if (msg)
            this.alert.error(
              this.t('BUSINESS_PROFILE.MESSAGES.SAVE_ERROR'),
              String(msg),
            );
          else this.alert.error(this.t('BUSINESS_PROFILE.MESSAGES.SAVE_ERROR'));
        },
      });
  }

  submitLocation(): void {
    if (this.locationForm.invalid || !this.pos?.id) return;

    this.locationSubmitting = true;
    this.isLocationDisabled = true;

    const changed = FormHelper.getChangedValues(
      this.locationForm.value,
      this.locationInitValues,
    );

    this.profileService
      .updatePos(this.pos.id, { location: changed })
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          this.locationSubmitting = false;
          this.alert.success(
            this.t('BUSINESS_PROFILE.MESSAGES.LOCATION_SAVE_SUCCESS'),
          );
          this.cdr.markForCheck();
        },
        error: () => {
          this.locationSubmitting = false;
          this.isLocationDisabled = false;
          this.alert.error(
            this.t('BUSINESS_PROFILE.MESSAGES.LOCATION_SAVE_ERROR'),
          );
          this.cdr.markForCheck();
        },
      });
  }

  setActiveTab(tab: 'information' | 'address'): void {
    this.activeTab = tab;
    this.onTabChange();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
    if (this.map) {
      this.map.remove();
    }
  }
  private t(key: string, params?: Record<string, unknown>): string {
    return this.translate.instant(key, params);
  }
}
