import {
  Component,
  OnInit,
  OnDestroy,
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  inject,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  AbstractControl,
  FormArray,
  FormGroup,
  FormBuilder,
  FormsModule,
  Validators,
  ReactiveFormsModule,
} from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import {
  NgLabelTemplateDirective,
  NgOptionTemplateDirective,
  NgSelectModule,
} from '@ng-select/ng-select';
import {
  FlatpickrDirective,
  FlatpickrModule,
  provideFlatpickrDefaults,
} from 'angularx-flatpickr';

import { TripService, TripCreatePayload } from '../trip.service';
import { BusService } from '../../buses/bus.service';
import { PlacesService } from '../../places/places.service';
import { CurrencyType } from 'src/app/core/models/account.model';
import { BusType } from 'src/app/core/models/bus.model';
import { PlaceType } from 'src/app/core/models/place-type';
import { AlertService } from 'src/app/core/services/alert.service';
import { CurrencyService } from 'src/app/core/services/currency.service';
import { PageInfoService } from 'src/app/_metronic/layout/core/page-info.service';
import { ToolbarComponent } from 'src/app/_metronic/layout/components/toolbar/toolbar.component';

interface SegmentDisplay {
  index: number;
  fromPlaceId: string;
  fromPlaceName: string;
  toPlaceId: string;
  toPlaceName: string;
}

interface CurrencyOption {
  id: string;
  code: string;
  label: string;
}

@Component({
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    FormsModule,
    ReactiveFormsModule,
    TranslateModule,
    NgSelectModule,
    FlatpickrDirective,
    ToolbarComponent,
    NgLabelTemplateDirective,
    NgOptionTemplateDirective,
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
  private currencyService = inject(CurrencyService);

  tripForm: FormGroup;
  currentStep = 0;
  isSubmitting = false;

  buses: BusType[] = [];
  places: PlaceType[] = [];
  currencies: CurrencyType[] = [];

  /** Derived segment display info (for labels in step 3 & 5) */
  segmentDisplays: SegmentDisplay[] = [];

  /** Timeline validation errors (populated when leaving step 1) */
  timelineErrors: string[] = [];

  /** Pickup/dropoff coverage errors (populated when leaving step 3) */
  pickupDropoffErrors: string[] = [];

  /** Total seats of the currently selected bus (for maxSeats validation) */
  selectedBusTotalSeats: number | null = null;

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

  readonly flatpickrDatetime = {
    altInput: true,
    altFormat: 'F j, Y H:i',
    enableTime: true,
    dateFormat: 'Y-m-d H:i',
    time_24hr: true,
    allowInput: true,
  };

  readonly flatpickrDate = {
    altInput: true,
    altFormat: 'F j, Y',
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
    this.loadCurrencies();
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
      currencyId: ['', Validators.required],
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

  private loadCurrencies(): void {
    this.currencyService
      .listAll()
      .pipe(takeUntil(this.destroy$))
      .subscribe((currencies) => {
        console.log(
          '🚀 ~ TripCreateComponent ~ loadCurrencies ~ currencies:',
          currencies,
        );
        this.currencies = currencies;
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

  /** Get available places for a stop, excluding places already selected by other stops */
  availablePlacesForStop(stopIndex: number): PlaceType[] {
    const selectedIds = this.stopSchedule.controls
      .map((c, i) => (i !== stopIndex ? c.get('placeId')?.value : null))
      .filter(Boolean);
    return this.places.filter((p) => !selectedIds.includes(p.id));
  }

  /** Clear handler for stop city ng-select */
  clearStopPlace(stopIndex: number): void {
    this.stopSchedule.at(stopIndex).get('placeId')?.setValue('');
    this.cdr.markForCheck();
  }

  isStepValid(step: number): boolean {
    switch (step) {
      case 0: {
        const f = this.tripForm;
        return (
          f.get('busId')!.valid &&
          f.get('departureDate')!.valid &&
          f.get('timezone')!.valid &&
          f.get('currencyId')!.valid &&
          f.get('seatHoldMinutes')!.valid
        );
      }
      case 1:
        return (
          this.stopSchedule.length >= 2 &&
          this.stopSchedule.valid &&
          this.timelineErrors.length === 0
        );
      case 2: {
        if (this.segments.length === 0 || !this.segments.valid) return false;
        if (this.selectedBusTotalSeats != null) {
          const segs = this.segments.getRawValue();
          if (segs.some((s: any) => s.maxSeats > this.selectedBusTotalSeats!))
            return false;
        }
        return true;
      }
      case 3:
        return (
          this.pickupPoints.length > 0 &&
          this.dropoffPoints.length > 0 &&
          this.pickupPoints.valid &&
          this.dropoffPoints.valid &&
          this.pickupDropoffErrors.length === 0
        );
      case 4:
        return this.expressFares.valid;
      default:
        return true;
    }
  }

  nextStep(): void {
    // When leaving step 0 (basic info), sync departureDate to first stop & track bus
    if (this.currentStep === 0) {
      const busId = this.tripForm.get('busId')?.value;
      const bus = this.buses.find((b) => b.id === busId);
      this.selectedBusTotalSeats = bus?.totalSeats ?? null;
      if (this.stopSchedule.length > 0) {
        this.enforceStopConstraints();
      }
    }

    // When leaving step 1 (stops), enforce constraints & validate timeline
    if (this.currentStep === 1) {
      this.enforceStopConstraints();
      this.validateTimeline();
    }

    // When leaving step 3 (pickup/dropoff), validate coverage + cross-timeline
    if (this.currentStep === 3) {
      this.validatePickupDropoffCoverage();
      if (this.pickupDropoffErrors.length > 0) {
        this.alert.error(this.pickupDropoffErrors.join('<br>'));
        return;
      }
      const pdErrors = this.validatePickupDropoff();
      if (pdErrors.length > 0) {
        this.alert.error(pdErrors.join('<br>'));
        return;
      }
    }

    if (!this.isStepValid(this.currentStep)) {
      this.markCurrentStepTouched();
      if (this.currentStep === 1 && this.timelineErrors.length > 0) {
        this.alert.error(this.timelineErrors.join('<br>'));
      }
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
          'currencyId',
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
    this.stopSchedule.push(
      this.fb.group({
        placeId: ['', Validators.required],
        arrivalTime: [null],
        departureTime: [null],
        boardingAllowed: [false],
        droppingAllowed: [false],
      }),
    );
    this.enforceStopConstraints();
    this.timelineErrors = [];
    this.cdr.markForCheck();
  }

  removeStop(index: number): void {
    this.stopSchedule.removeAt(index);
    this.enforceStopConstraints();
    this.timelineErrors = [];
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
    this.enforceStopConstraints();
    this.timelineErrors = [];
    this.cdr.markForCheck();
  }

  /**
   * Enforce origin/destination constraints on first and last stops:
   * - First stop: arrivalTime = null, boardingAllowed = true, droppingAllowed = false
   * - Last stop:  departureTime = null, droppingAllowed = true, boardingAllowed = false
   * Also syncs global departureDate to first stop's departureTime.
   */
  private enforceStopConstraints(): void {
    const len = this.stopSchedule.length;
    if (len === 0) return;

    // First stop (origin)
    const first = this.stopSchedule.at(0);
    first.get('arrivalTime')?.setValue(null, { emitEvent: false });
    first.get('boardingAllowed')?.setValue(true, { emitEvent: false });
    first.get('droppingAllowed')?.setValue(false, { emitEvent: false });

    // Sync global departureDate → first stop departureTime
    const globalDeparture = this.tripForm.get('departureDate')?.value;
    if (globalDeparture && !first.get('departureTime')?.value) {
      first
        .get('departureTime')
        ?.setValue(globalDeparture, { emitEvent: false });
    }

    if (len > 1) {
      // Last stop (destination)
      const last = this.stopSchedule.at(len - 1);
      last.get('departureTime')?.setValue(null, { emitEvent: false });
      last.get('droppingAllowed')?.setValue(true, { emitEvent: false });
      last.get('boardingAllowed')?.setValue(false, { emitEvent: false });
    }
  }

  getPlaceName(placeId: string): string {
    return this.places.find((p) => p.id === placeId)?.city ?? placeId;
  }

  // ══════════════════════════════════════════════════
  //  Timeline validation
  // ══════════════════════════════════════════════════
  private validateTimeline(): void {
    this.timelineErrors = [];
    const stops = this.stopSchedule.getRawValue();
    const lastIdx = stops.length - 1;

    for (let i = 0; i < stops.length; i++) {
      const stop = stops[i];
      const arrival = stop.arrivalTime
        ? new Date(stop.arrivalTime).getTime()
        : null;
      const departure = stop.departureTime
        ? new Date(stop.departureTime).getTime()
        : null;
      const placeName = this.getPlaceName(stop.placeId);

      // Rule 0a: first stop must NOT have an arrival time
      if (i === 0 && arrival) {
        this.timelineErrors.push(
          this.translate.instant('TRIPS.CREATE.ERRORS.ORIGIN_NO_ARRIVAL', {
            place: placeName,
          }),
        );
      }

      // Rule 0b: last stop must NOT have a departure time
      if (i === lastIdx && i > 0 && departure) {
        this.timelineErrors.push(
          this.translate.instant('TRIPS.CREATE.ERRORS.DEST_NO_DEPARTURE', {
            place: placeName,
          }),
        );
      }

      // Rule 0c: first stop departureTime must not be before global departureDate
      if (i === 0 && departure) {
        const globalDeparture = this.tripForm.get('departureDate')?.value;
        if (globalDeparture) {
          const globalTime = new Date(globalDeparture).getTime();
          if (departure < globalTime) {
            this.timelineErrors.push(
              this.translate.instant(
                'TRIPS.CREATE.ERRORS.DEPARTURE_DATE_MISMATCH',
                { place: placeName },
              ),
            );
          }
        }
      }

      // Rule 1: departure must be after arrival (within same stop)
      if (arrival && departure && departure <= arrival) {
        this.timelineErrors.push(
          this.translate.instant(
            'TRIPS.CREATE.ERRORS.DEPARTURE_BEFORE_ARRIVAL',
            {
              stop: i + 1,
              place: placeName,
            },
          ),
        );
      }

      // Rule 2: arrival must be after previous stop's departure (or arrival)
      if (i > 0 && arrival) {
        const prev = stops[i - 1];
        const prevTime = prev.departureTime
          ? new Date(prev.departureTime).getTime()
          : prev.arrivalTime
            ? new Date(prev.arrivalTime).getTime()
            : null;
        if (prevTime && arrival <= prevTime) {
          this.timelineErrors.push(
            this.translate.instant(
              'TRIPS.CREATE.ERRORS.ARRIVAL_BEFORE_PREVIOUS',
              {
                stop: i + 1,
                place: placeName,
                prevStop: i,
                prevPlace: this.getPlaceName(prev.placeId),
              },
            ),
          );
        }
      }
    }
  }

  /**
   * Validate pickup/dropoff: each dropoff scheduledArrivalTime must be after
   * the earliest pickup scheduledDepartureTime.
   */
  private validatePickupDropoff(): string[] {
    const errors: string[] = [];
    const pickups = this.pickupPoints.getRawValue();
    const dropoffs = this.dropoffPoints.getRawValue();

    if (pickups.length === 0 || dropoffs.length === 0) return errors;

    // Find earliest pickup departure
    const pickupTimes = pickups
      .map((p: any) =>
        p.scheduledDepartureTime
          ? new Date(p.scheduledDepartureTime).getTime()
          : null,
      )
      .filter((t: number | null): t is number => t !== null);
    if (pickupTimes.length === 0) return errors;

    const earliestPickup = Math.min(...pickupTimes);

    for (let i = 0; i < dropoffs.length; i++) {
      const d = dropoffs[i];
      if (!d.scheduledArrivalTime) continue;
      const dropoffTime = new Date(d.scheduledArrivalTime).getTime();
      if (dropoffTime <= earliestPickup) {
        errors.push(
          this.translate.instant('TRIPS.CREATE.ERRORS.DROPOFF_BEFORE_PICKUP', {
            dropoff: i + 1,
          }),
        );
      }
    }
    return errors;
  }

  /**
   * Validate pickup/dropoff coverage: every boarding stop must have at least
   * one pickup point with matching placeId, every dropping stop must have at
   * least one dropoff point with matching placeId.
   */
  private validatePickupDropoffCoverage(): void {
    this.pickupDropoffErrors = [];
    const stops = this.stopSchedule.getRawValue();
    const pickups = this.pickupPoints.getRawValue();
    const dropoffs = this.dropoffPoints.getRawValue();

    stops.forEach((stop: any, i: number) => {
      if (stop.boardingAllowed) {
        const hasPickup = pickups.some((p: any) => p.placeId === stop.placeId);
        if (!hasPickup) {
          this.pickupDropoffErrors.push(
            this.translate.instant(
              'TRIPS.CREATE.ERRORS.MISSING_PICKUP_FOR_STOP',
              { stop: i + 1, place: this.getPlaceName(stop.placeId) },
            ),
          );
        }
      }
      if (stop.droppingAllowed) {
        const hasDropoff = dropoffs.some(
          (d: any) => d.placeId === stop.placeId,
        );
        if (!hasDropoff) {
          this.pickupDropoffErrors.push(
            this.translate.instant(
              'TRIPS.CREATE.ERRORS.MISSING_DROPOFF_FOR_STOP',
              { stop: i + 1, place: this.getPlaceName(stop.placeId) },
            ),
          );
        }
      }
    });
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
        segmentIndices: [
          [],
          (c: AbstractControl) =>
            c.value?.length > 0 ? null : { required: true },
        ],
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
      currency: { currencyId: raw.currencyId },
      seatHoldMinutes: raw.seatHoldMinutes,
      stopSchedule: raw.stopSchedule.map((s: any, i: number) => ({
        placeId: s.placeId,
        sequence: i,
        arrivalTime:
          i === 0
            ? null
            : s.arrivalTime
              ? this.toISOString(s.arrivalTime)
              : null,
        departureTime:
          i === raw.stopSchedule.length - 1
            ? null
            : s.departureTime
              ? this.toISOString(s.departureTime)
              : null,
        boardingAllowed: i === 0 ? true : s.boardingAllowed,
        droppingAllowed:
          i === raw.stopSchedule.length - 1 ? true : s.droppingAllowed,
      })),
      segmentInputs: raw.segments.map((s: any) => ({
        basePrice: s.basePrice,
        maxSeats: s.maxSeats,
        distanceKm: s.distanceKm,
        ...(s.durationMinutesOverride
          ? { durationMinutesOverride: s.durationMinutesOverride }
          : {}),
      })),
      pickupPoints: raw.pickupPoints.map((p: any) => ({
        placeId: p.placeId,
        address: p.address,
        scheduledDepartureTime: this.toISOString(p.scheduledDepartureTime),
        active: p.active ?? true,
        ...(p.latitude && p.longitude
          ? { location: { latitude: p.latitude, longitude: p.longitude } }
          : {}),
      })),
      dropoffPoints: raw.dropoffPoints.map((d: any) => ({
        placeId: d.placeId,
        address: d.address,
        scheduledArrivalTime: this.toISOString(d.scheduledArrivalTime),
        active: d.active ?? true,
        ...(d.latitude && d.longitude
          ? { location: { latitude: d.latitude, longitude: d.longitude } }
          : {}),
      })),
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
          } else if (backendMsg.includes('MISSING_PICKUP_POINT')) {
            message = this.translate.instant('TRIPS.MESSAGES.MISSING_PICKUP');
          } else if (backendMsg.includes('MISSING_DROPOFF_POINT')) {
            message = this.translate.instant('TRIPS.MESSAGES.MISSING_DROPOFF');
          } else if (backendMsg.includes('BUS_ALREADY_ASSIGNED')) {
            message = this.translate.instant(
              'TRIPS.MESSAGES.BUS_ALREADY_ASSIGNED',
            );
          } else if (backendMsg.includes('MAX_SEATS_EXCEEDS')) {
            message = this.translate.instant('TRIPS.MESSAGES.MAX_SEATS_ERROR');
          } else if (
            backendMsg.includes('INVALID_TIMELINE') ||
            backendMsg.includes('INVALID_STOP_SEQUENCE')
          ) {
            message = this.translate.instant('TRIPS.MESSAGES.INVALID_TIMELINE');
          } else if (backendMsg.includes('INVALID_EXPRESS_FARE_CHAIN')) {
            message = this.translate.instant(
              'TRIPS.MESSAGES.INVALID_EXPRESS_CHAIN',
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
