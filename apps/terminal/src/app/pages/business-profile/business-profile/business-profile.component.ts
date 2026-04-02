import { CommonModule } from '@angular/common';
import {
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
import { Subject, takeUntil, of } from 'rxjs';
import {
  debounceTime,
  distinctUntilChanged,
  switchMap,
  take,
} from 'rxjs/operators';
import { isEqual, omit } from 'lodash';
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
import { NgSelectModule } from '@ng-select/ng-select';
import { PlacesService } from '../../places/places.service';

@Component({
  selector: 'app-business-profile',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, TranslateModule, NgSelectModule],
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
  // Typeahead subjects and loading flags for ng-select
  countriesSearchInput$: Subject<string> = new Subject<string>();
  statesSearchInput$: Subject<string> = new Subject<string>();
  countriesLoading = false;
  statesLoading = false;

  // Leaflet map
  private map: L.Map;
  private marker: L.Marker;

  // Forms
  overviewForm: FormGroup;
  locationForm: FormGroup;

  // initial form values and button states (follow settings pattern)
  overviewInitValues: any;
  locationInitValues: any;
  overviewButtonDisabled = true;
  locationButtonDisabled = true;
  overviewSubmitting = false;
  locationSubmitting = false;
  selectedCountryId: string;

  constructor(
    private fb: FormBuilder,
    private alert: AlertService,
    private cdr: ChangeDetectorRef,
    private authService: AuthService,
    private translate: TranslateService,
    private placesService: PlacesService,
    private profileService: BusinessProfileService,
  ) {
    this.profileService.currencies$
      .pipe(takeUntil(this.destroy$))
      .subscribe((data) => {
        this.currencies = data;
        this.cdr.markForCheck();
      });

    // Countries typeahead
    this.countriesSearchInput$
      .pipe(
        takeUntil(this.destroy$),
        debounceTime(500),
        distinctUntilChanged(),
        switchMap((searchString) => {
          this.countries = [];
          this.placesService.countriesSearchString = searchString;
          this.countriesLoading = true;
          return this.placesService.getCountries();
        }),
      )
      .subscribe(() => {
        this.countriesLoading = false;
        this.cdr.markForCheck();
      });

    // States typeahead
    this.statesSearchInput$
      .pipe(
        takeUntil(this.destroy$),
        debounceTime(500),
        distinctUntilChanged(),
        switchMap((searchString) => {
          this.placesService.resetStates();
          this.states = [];
          this.placesService.statesSearchString = searchString;
          const country = this.locationForm?.get('country')?.value;
          if (!country) return of([]);
          this.statesLoading = true;
          return this.placesService.getStatesByCountry(country.id);
        }),
      )
      .subscribe(() => {
        this.statesLoading = false;
        this.cdr.markForCheck();
      });
  }

  ngOnInit(): void {
    // Subscribe to pos changes
    this.authService.company$
      .pipe(takeUntil(this.destroy$))
      .subscribe((pos) => {
        this.pos = pos;
        if (pos) {
          // Overview form
          this.overviewForm = this.fb.group({
            title: [pos.title || '', Validators.required],
            subtitle: [pos.subtitle || ''],
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
            .subscribe((values) => {
              this.overviewButtonDisabled = isEqual(
                values,
                this.overviewInitValues,
              );
              this.cdr.markForCheck();
            });
          // Location form
          this.locationForm = this.fb.group({
            addressLine: [pos.location?.addressLine || ''],
            city: [pos.location?.city || ''],
            country: [pos.location?.country || ''],
            state: [pos.location?.state || ''],
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
            .subscribe((values) => {
              this.locationButtonDisabled = isEqual(
                values,
                this.locationInitValues,
              );
              this.cdr.markForCheck();
            });
          this.locationForm
            .get('country')
            ?.valueChanges.pipe(takeUntil(this.destroy$))
            .subscribe((country) => {
              if (country) {
                this.selectedCountryId = country.id;
                this.locationForm.patchValue(
                  { state: undefined },
                  { emitEvent: false },
                );
              } else {
                this.placesService.resetStates();
                this.states = [];
              }
            });
        }
      });

    this.placesService.states$
      .pipe(takeUntil(this.destroy$))
      .subscribe((states) => {
        this.states = [...this.states, ...(states || [])];
        this.cdr.markForCheck();
      });

    this.placesService.countries$
      .pipe(takeUntil(this.destroy$))
      .subscribe((countries) => {
        this.countries = countries;
        this.cdr.markForCheck();
      });
  }

  ngAfterViewInit(): void {
    this.loadCurrencies();
    this.loadCountries();
    if (this.pos.location?.country) {
      this.selectedCountryId = this.pos.location.country.id;
      this.loadStatesByCountry(this.selectedCountryId);
    }
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
    this.placesService.getCountries().subscribe();
  }

  private loadStatesByCountry(countryId: string): void {
    this.placesService
      .getStatesByCountry(countryId)
      .pipe(takeUntil(this.destroy$))
      .subscribe();
  }

  onCountryChange(): void {
    const countryId = this.locationForm.get('country')?.value?.id;
    this.locationForm.get('state')?.setValue(undefined);
    this.resetStatesPagination();
    if (countryId) {
      this.loadStatesByCountry(countryId);
    }
  }

  private resetStatesPagination(): void {
    this.states = [];
    this.statesLoading = false;
    this.placesService.resetStates();
  }

  loadMoreStates(): void {
    this.placesService.isLastStates$.pipe(take(1)).subscribe((isLast) => {
      if (!isLast) {
        this.statesLoading = true;
        this.placesService.statesPageIndex += 1;
        this.loadStatesByCountry(this.selectedCountryId);
      }
    });
  }
  // ========== Form Submissions ==========
  submitOverview(): void {
    this.overviewButtonDisabled = true;
    if (this.overviewForm.invalid || !this.pos?.id) return;

    this.overviewSubmitting = true;
    this.overviewButtonDisabled = true;

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
          this.overviewButtonDisabled = false;
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
    this.locationButtonDisabled = true;

    const changes = {
      ...FormHelper.getChangedValues(
        omit(this.locationForm.value, 'state', 'country'),
        omit(this.locationInitValues, 'state', 'country'),
      ),
      ...(this.locationForm.value.state?.id !==
      this.locationInitValues.state?.id
        ? { stateId: this.locationForm.value.state?.id }
        : {}),
      ...(this.locationForm.value.country?.id !==
      this.locationInitValues.country?.id
        ? { countryId: this.locationForm.value.country?.id }
        : {}),
    };

    this.profileService
      .updatePos(this.pos.id, { location: changes })
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
          this.locationButtonDisabled = false;
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
