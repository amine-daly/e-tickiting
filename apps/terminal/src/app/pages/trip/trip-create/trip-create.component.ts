import {
  Component,
  OnInit,
  OnDestroy,
  ChangeDetectionStrategy,
  ChangeDetectorRef,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  FormArray,
  FormGroup,
  FormBuilder,
  Validators,
  ReactiveFormsModule,
} from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { NgSelectModule } from '@ng-select/ng-select';
import {
  FlatpickrDirective,
  FlatpickrModule,
  provideFlatpickrDefaults,
} from 'angularx-flatpickr';

import { TripService, TripCreatePayload } from '../trip.service';
import { BusService } from '../../buses/bus.service';
import { PlacesService } from '../../places/places.service';
import { BusType } from 'src/app/core/models/bus.model';
import { PlaceType } from 'src/app/core/models/place-type';
import { AlertService } from 'src/app/core/services/alert.service';
import { PageInfoService } from 'src/app/_metronic/layout/core/page-info.service';
import { ToolbarComponent } from 'src/app/_metronic/layout/components/toolbar/toolbar.component';

interface SegmentDisplay {
  index: number;
  fromPlaceId: string;
  fromPlaceName: string;
  toPlaceId: string;
  toPlaceName: string;
}

@Component({
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    ReactiveFormsModule,
    TranslateModule,
    NgSelectModule,
    FlatpickrDirective,
    ToolbarComponent,
  ],
  providers: [
    provideFlatpickrDefaults({
      altInput: true,
      dateFormat: 'Y-m-d',
    }),
  ],
  selector: 'app-trip-create',
  templateUrl: './trip-create.component.html',
  styleUrls: ['./trip-create.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TripCreateComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();

  tripForm: FormGroup;
  currentStep = 0;
  isSubmitting = false;

  buses: BusType[] = [];
  places: PlaceType[] = [];

  /** Derived segment display info (for labels in step 3 & 5) */
  segmentDisplays: SegmentDisplay[] = [];

  readonly STEPS = [
    'TRIPS.CREATE.STEPS.BASIC_INFO',
    'TRIPS.CREATE.STEPS.STOP_SCHEDULE',
    'TRIPS.CREATE.STEPS.SEGMENTS',
    'TRIPS.CREATE.STEPS.PICKUP_DROPOFF',
    'TRIPS.CREATE.STEPS.EXPRESS_FARES',
    'TRIPS.CREATE.STEPS.REVIEW',
  ];

  readonly timezones = [
    { value: 'Africa/Casablanca', label: 'Africa/Casablanca (GMT+1)' },
    { value: 'Africa/Algiers', label: 'Africa/Algiers (CET)' },
    { value: 'Africa/Tunis', label: 'Africa/Tunis (CET)' },
    { value: 'Africa/Cairo', label: 'Africa/Cairo (EET)' },
    { value: 'Africa/Lagos', label: 'Africa/Lagos (WAT)' },
    { value: 'Africa/Nairobi', label: 'Africa/Nairobi (EAT)' },
    { value: 'Europe/Paris', label: 'Europe/Paris (CET)' },
    { value: 'Europe/London', label: 'Europe/London (GMT)' },
    { value: 'America/New_York', label: 'America/New_York (EST)' },
    { value: 'Asia/Dubai', label: 'Asia/Dubai (GST)' },
    { value: 'UTC', label: 'UTC' },
  ];

  readonly currencies = [
    { value: 'MAD', label: 'MAD – Moroccan Dirham' },
    { value: 'EUR', label: 'EUR – Euro' },
    { value: 'USD', label: 'USD – US Dollar' },
    { value: 'GBP', label: 'GBP – British Pound' },
    { value: 'DZD', label: 'DZD – Algerian Dinar' },
    { value: 'TND', label: 'TND – Tunisian Dinar' },
    { value: 'EGP', label: 'EGP – Egyptian Pound' },
    { value: 'XOF', label: 'XOF – CFA Franc' },
    { value: 'NGN', label: 'NGN – Nigerian Naira' },
  ];

  readonly flatpickrDatetime = {
    enableTime: true,
    dateFormat: 'Y-m-d H:i',
    time_24hr: true,
    allowInput: true,
  };

  readonly flatpickrDate = {
    enableTime: false,
    dateFormat: 'Y-m-d',
    allowInput: true,
  };

  // ── Form accessors ──────────────────────────────
  get stopSchedule(): FormArray {
    return this.tripForm.get('stopSchedule') as FormArray;
  }

  get segments(): FormArray {
    return this.tripForm.get('segments') as FormArray;
  }

  get pickupPoints(): FormArray {
    return this.tripForm.get('pickupPoints') as FormArray;
  }

  get dropoffPoints(): FormArray {
    return this.tripForm.get('dropoffPoints') as FormArray;
  }

  get expressFares(): FormArray {
    return this.tripForm.get('expressFares') as FormArray;
  }

  /** Places used in stops (for pickup/dropoff city filtering) */
  get boardingPlaces(): PlaceType[] {
    const placeIds = this.stopSchedule.controls
      .filter((c) => c.get('boardingAllowed')?.value)
      .map((c) => c.get('placeId')?.value)
      .filter(Boolean);
    return this.places.filter((p) => placeIds.includes(p.id));
  }

  get droppingPlaces(): PlaceType[] {
    const placeIds = this.stopSchedule.controls
      .filter((c) => c.get('droppingAllowed')?.value)
      .map((c) => c.get('placeId')?.value)
      .filter(Boolean);
    return this.places.filter((p) => placeIds.includes(p.id));
  }

  constructor(
    private fb: FormBuilder,
    private router: Router,
    private cdr: ChangeDetectorRef,
    private tripService: TripService,
    private busService: BusService,
    private placesService: PlacesService,
    private alert: AlertService,
    private pageInfo: PageInfoService,
    private translate: TranslateService,
  ) {}

  ngOnInit(): void {
    this.pageInfo.setTitle(this.translate.instant('TRIPS.CREATE.TITLE'));

    this.buildForm();
    this.loadBuses();
    this.loadPlaces();
  }

  // ══════════════════════════════════════════════════
  //  Form initialisation
  // ══════════════════════════════════════════════════
  private buildForm(): void {
    this.tripForm = this.fb.group({
      // Step 1 — Basic info
      busId: ['', Validators.required],
      departureDate: [null, Validators.required],
      timezone: ['', Validators.required],
      currency: ['', Validators.required],
      seatHoldMinutes: [15, [Validators.required, Validators.min(1)]],
      // Step 2 — Stops
      stopSchedule: this.fb.array([]),
      // Step 3 — Segments (auto-generated)
      segments: this.fb.array([]),
      // Step 4 — Pickup & Dropoff
      pickupPoints: this.fb.array([]),
      dropoffPoints: this.fb.array([]),
      // Step 5 — Express fares
      expressFares: this.fb.array([]),
    });
  }

  private loadBuses(): void {
    this.busService
      .list()
      .pipe(takeUntil(this.destroy$))
      .subscribe((buses) => {
        this.buses = buses;
        this.cdr.markForCheck();
      });
  }

  private loadPlaces(): void {
    this.placesService.placesPageLimit = 200;
    this.placesService
      .getPlaces()
      .pipe(takeUntil(this.destroy$))
      .subscribe((places) => {
        this.places = places;
        this.cdr.markForCheck();
      });
  }

  // ══════════════════════════════════════════════════
  //  Stepper navigation
  // ══════════════════════════════════════════════════
  get canGoNext(): boolean {
    return (
      this.isStepValid(this.currentStep) &&
      this.currentStep < this.STEPS.length - 1
    );
  }

  isStepValid(step: number): boolean {
    switch (step) {
      case 0: {
        const f = this.tripForm;
        return (
          f.get('busId')!.valid &&
          f.get('departureDate')!.valid &&
          f.get('timezone')!.valid &&
          f.get('currency')!.valid &&
          f.get('seatHoldMinutes')!.valid
        );
      }
      case 1:
        return this.stopSchedule.length >= 2 && this.stopSchedule.valid;
      case 2:
        return this.segments.length > 0 && this.segments.valid;
      case 3:
        return this.pickupPoints.valid && this.dropoffPoints.valid;
      case 4:
        return this.expressFares.valid;
      default:
        return true;
    }
  }

  nextStep(): void {
    if (!this.isStepValid(this.currentStep)) {
      this.markCurrentStepTouched();
      return;
    }

    // When leaving step 1 (stops), regenerate segments
    if (this.currentStep === 1) {
      this.regenerateSegments();
    }

    this.currentStep = Math.min(this.currentStep + 1, this.STEPS.length - 1);
    this.cdr.markForCheck();
  }

  prevStep(): void {
    this.currentStep = Math.max(this.currentStep - 1, 0);
    this.cdr.markForCheck();
  }

  goToStep(step: number): void {
    // Only allow navigating to already-visited or current+1 steps
    if (step <= this.currentStep) {
      this.currentStep = step;
      this.cdr.markForCheck();
    }
  }

  private markCurrentStepTouched(): void {
    switch (this.currentStep) {
      case 0:
        [
          'busId',
          'departureDate',
          'timezone',
          'currency',
          'seatHoldMinutes',
        ].forEach((name) => this.tripForm.get(name)?.markAsTouched());
        break;
      case 1:
        this.stopSchedule.markAllAsTouched();
        break;
      case 2:
        this.segments.markAllAsTouched();
        break;
      case 3:
        this.pickupPoints.markAllAsTouched();
        this.dropoffPoints.markAllAsTouched();
        break;
      case 4:
        this.expressFares.markAllAsTouched();
        break;
    }
  }

  // ══════════════════════════════════════════════════
  //  Step 2 — Stop Schedule
  // ══════════════════════════════════════════════════
  addStop(): void {
    const isFirst = this.stopSchedule.length === 0;
    this.stopSchedule.push(
      this.fb.group({
        placeId: ['', Validators.required],
        arrivalTime: [null],
        departureTime: [null],
        boardingAllowed: [isFirst],
        droppingAllowed: [!isFirst],
      }),
    );
    this.cdr.markForCheck();
  }

  removeStop(index: number): void {
    this.stopSchedule.removeAt(index);
    this.cdr.markForCheck();
  }

  moveStop(index: number, direction: -1 | 1): void {
    const target = index + direction;
    if (target < 0 || target >= this.stopSchedule.length) return;

    const controls = this.stopSchedule.controls;
    const tmp = controls[index];
    controls[index] = controls[target];
    controls[target] = tmp;
    this.stopSchedule.updateValueAndValidity();
    this.cdr.markForCheck();
  }

  getPlaceName(placeId: string): string {
    return this.places.find((p) => p.id === placeId)?.city ?? placeId;
  }

  getBusName(busId: string): string {
    return this.buses.find((b) => b.id === busId)?.name ?? busId;
  }

  // ══════════════════════════════════════════════════
  //  Step 3 — Segment auto-generation
  // ══════════════════════════════════════════════════
  private regenerateSegments(): void {
    const stops = this.stopSchedule.getRawValue();
    const commercial = stops.filter(
      (s: any) => s.boardingAllowed || s.droppingAllowed,
    );

    const oldSegments = this.segments.getRawValue();
    const oldDisplays = [...this.segmentDisplays];

    this.segments.clear();
    this.segmentDisplays = [];

    for (let i = 0; i < commercial.length - 1; i++) {
      const from = commercial[i];
      const to = commercial[i + 1];

      // Try to preserve user-entered data by matching from→to
      const existingIdx = oldDisplays.findIndex(
        (d) => d.fromPlaceId === from.placeId && d.toPlaceId === to.placeId,
      );
      const existing = existingIdx >= 0 ? oldSegments[existingIdx] : null;

      this.segmentDisplays.push({
        index: i,
        fromPlaceId: from.placeId,
        fromPlaceName: this.getPlaceName(from.placeId),
        toPlaceId: to.placeId,
        toPlaceName: this.getPlaceName(to.placeId),
      });

      this.segments.push(
        this.fb.group({
          basePrice: [
            existing?.basePrice ?? 0,
            [Validators.required, Validators.min(0)],
          ],
          maxSeats: [
            existing?.maxSeats ?? null,
            [Validators.required, Validators.min(1)],
          ],
          distanceKm: [
            existing?.distanceKm ?? null,
            [Validators.required, Validators.min(0.1)],
          ],
          durationMinutesOverride: [existing?.durationMinutesOverride ?? null],
        }),
      );
    }
    this.cdr.markForCheck();
  }

  /** Options for segment-index multi-select in express fares step */
  get segmentIndexOptions(): { value: number; label: string }[] {
    return this.segmentDisplays.map((d) => ({
      value: d.index,
      label: `${d.fromPlaceName} → ${d.toPlaceName}`,
    }));
  }

  // ══════════════════════════════════════════════════
  //  Step 4 — Pickup & Dropoff points
  // ══════════════════════════════════════════════════
  addPickupPoint(): void {
    this.pickupPoints.push(
      this.fb.group({
        placeId: ['', Validators.required],
        address: ['', Validators.required],
        scheduledDepartureTime: [null, Validators.required],
        active: [true],
        latitude: [null],
        longitude: [null],
      }),
    );
    this.cdr.markForCheck();
  }

  removePickupPoint(index: number): void {
    this.pickupPoints.removeAt(index);
    this.cdr.markForCheck();
  }

  addDropoffPoint(): void {
    this.dropoffPoints.push(
      this.fb.group({
        placeId: ['', Validators.required],
        address: ['', Validators.required],
        scheduledArrivalTime: [null, Validators.required],
        active: [true],
        latitude: [null],
        longitude: [null],
      }),
    );
    this.cdr.markForCheck();
  }

  removeDropoffPoint(index: number): void {
    this.dropoffPoints.removeAt(index);
    this.cdr.markForCheck();
  }

  // ══════════════════════════════════════════════════
  //  Step 5 — Express Fares
  // ══════════════════════════════════════════════════
  addExpressFare(): void {
    this.expressFares.push(
      this.fb.group({
        segmentIndices: [[], Validators.required],
        price: [null, [Validators.required, Validators.min(0)]],
        validFrom: [null],
        validUntil: [null],
        active: [true],
      }),
    );
    this.cdr.markForCheck();
  }

  removeExpressFare(index: number): void {
    this.expressFares.removeAt(index);
    this.cdr.markForCheck();
  }

  // ══════════════════════════════════════════════════
  //  Submit
  // ══════════════════════════════════════════════════
  submit(): void {
    if (this.tripForm.invalid) {
      this.tripForm.markAllAsTouched();
      return;
    }

    this.isSubmitting = true;
    const raw = this.tripForm.getRawValue();

    const payload: TripCreatePayload = {
      bus: { busId: raw.busId },
      departureDate: this.toISOString(raw.departureDate),
      timezone: raw.timezone,
      currency: raw.currency,
      seatHoldMinutes: raw.seatHoldMinutes,
      stopSchedule: raw.stopSchedule.map((s: any, i: number) => ({
        placeId: s.placeId,
        sequence: i,
        arrivalTime: s.arrivalTime ? this.toISOString(s.arrivalTime) : null,
        departureTime: s.departureTime
          ? this.toISOString(s.departureTime)
          : null,
        boardingAllowed: s.boardingAllowed,
        droppingAllowed: s.droppingAllowed,
      })),
      segmentInputs: raw.segments.map((s: any) => ({
        basePrice: s.basePrice,
        maxSeats: s.maxSeats,
        distanceKm: s.distanceKm,
        ...(s.durationMinutesOverride
          ? { durationMinutesOverride: s.durationMinutesOverride }
          : {}),
      })),
      pickupPoints:
        raw.pickupPoints.length > 0
          ? raw.pickupPoints.map((p: any) => ({
              placeId: p.placeId,
              address: p.address,
              scheduledDepartureTime: this.toISOString(
                p.scheduledDepartureTime,
              ),
              active: p.active ?? true,
              ...(p.latitude && p.longitude
                ? { location: { latitude: p.latitude, longitude: p.longitude } }
                : {}),
            }))
          : undefined,
      dropoffPoints:
        raw.dropoffPoints.length > 0
          ? raw.dropoffPoints.map((d: any) => ({
              placeId: d.placeId,
              address: d.address,
              scheduledArrivalTime: this.toISOString(d.scheduledArrivalTime),
              active: d.active ?? true,
              ...(d.latitude && d.longitude
                ? { location: { latitude: d.latitude, longitude: d.longitude } }
                : {}),
            }))
          : undefined,
      expressFares:
        raw.expressFares.length > 0
          ? raw.expressFares.map((f: any) => ({
              segmentIndices: f.segmentIndices,
              price: f.price,
              validFrom: f.validFrom ? this.toISOString(f.validFrom) : null,
              validUntil: f.validUntil ? this.toISOString(f.validUntil) : null,
              active: f.active ?? true,
            }))
          : undefined,
    };

    this.tripService
      .create(payload)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          this.alert.success(
            this.translate.instant('TRIPS.MESSAGES.SAVE_SUCCESS'),
          );
          this.router.navigate(['/trips']);
        },
        error: (err) => {
          const backendMsg: string = err?.error?.message || '';
          let message: string;
          if (backendMsg.includes('UNRECOGNIZED_FIELD')) {
            const field = backendMsg.split(':')[1]?.trim() || '';
            message = this.translate.instant(
              'TRIPS.MESSAGES.UNRECOGNIZED_FIELD',
              { field },
            );
          } else {
            message = this.translate.instant('TRIPS.MESSAGES.SAVE_ERROR');
          }
          this.alert.error(message);
          this.isSubmitting = false;
          this.cdr.markForCheck();
        },
      });
  }

  // ── Helpers ──────────────────────────────────────
  isInvalid(path: string): boolean {
    const control = this.tripForm.get(path);
    return !!control && control.invalid && (control.dirty || control.touched);
  }

  isArrayControlInvalid(
    array: FormArray,
    index: number,
    field: string,
  ): boolean {
    const control = array.at(index)?.get(field);
    return !!control && control.invalid && (control.dirty || control.touched);
  }

  private toISOString(value: any): string {
    if (!value) return '';
    if (value instanceof Date) return value.toISOString();
    if (typeof value === 'string') {
      const d = new Date(value);
      return isNaN(d.getTime()) ? value : d.toISOString();
    }
    return String(value);
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }
}
