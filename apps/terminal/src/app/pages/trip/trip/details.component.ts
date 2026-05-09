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
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { Observable, Subject, of } from 'rxjs';
import { concatMap, take, takeUntil } from 'rxjs/operators';
import { keys } from 'lodash';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import {
  NgLabelTemplateDirective,
  NgOptionTemplateDirective,
  NgSelectComponent,
  NgSelectModule,
} from '@ng-select/ng-select';
import {
  FlatpickrDirective,
  provideFlatpickrDefaults,
} from 'angularx-flatpickr';

import { TripService } from '../trip.service';
import { BusService } from '../../buses/bus.service';
import { PlacesService } from '../../places/places.service';
import { CurrencyType } from 'src/app/core/models/account.model';
import { BusType } from 'src/app/core/models/bus.model';
import { PlaceType } from 'src/app/core/models/place-type';
import {
  ExpressSegmentPayload,
  ExpressSegmentUpdatePayload,
  TripCreatePayload,
  TripUpdatePayload,
} from '../../../core/models/trip-payload.model';
import { TripType, TripStatusEnum } from '../../../core/models/trip.model';
import {
  buildPhysicalOccupancyBySegmentId,
  computeTripMaxPhysicalOccupancy,
} from '../../../core/helpers/trip-inventory.helper';
import { FormHelper } from '../../../core/helpers/form-helper';
import { AlertService } from 'src/app/core/services/alert.service';
import { CurrencyService } from 'src/app/core/services/currency.service';
import { PageInfoService } from 'src/app/_metronic/layout/core/page-info.service';
import { ToolbarComponent } from 'src/app/_metronic/layout/components/toolbar/toolbar.component';
import { TripPointLocationPickerComponent } from './location/trip-point-location-picker.component';

interface SegmentDisplay {
  index: number;
  originPlaceId: string;
  originPlaceName: string;
  destinationPlaceId: string;
  destinationPlaceName: string;
}

@Component({
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    FormsModule,
    ReactiveFormsModule,
    TranslateModule,
    FlatpickrDirective,
    ToolbarComponent,
    NgSelectComponent,
    NgSelectModule,
    NgLabelTemplateDirective,
    NgOptionTemplateDirective,
    TripPointLocationPickerComponent,
  ],
  providers: [
    provideFlatpickrDefaults({
      altInput: true,
      dateFormat: 'Y-m-d',
    }),
  ],
  selector: 'app-trip-details',
  templateUrl: './details.component.html',
  styleUrls: ['./details.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TripDetailsComponent implements OnInit, OnDestroy {
  private initialValues: any;
  private destroy$ = new Subject<void>();
  private currencyService = inject(CurrencyService);
  private tripPlacesMap = new Map<string, string>();

  today = new Date();
  tripForm: FormGroup;
  currentStep = 0;
  isSubmitting = false;
  isButtonDisabled = true;
  isEditMode = false;
  trip: TripType;

  buses: BusType[] = [];
  places: PlaceType[] = [];
  currencies: CurrencyType[] = [];

  /** Derived segment display info (for labels in step 3 & 5) */
  segmentDisplays: SegmentDisplay[] = [];

  /** Cached options for segment-index multi-select (stable reference for ng-select) */
  segmentIndexOptions: { value: number; label: string }[] = [];

  /** Timeline validation errors (populated when leaving step 1) */
  timelineErrors: string[] = [];

  /** Pickup/dropoff coverage errors (populated when leaving step 3) */
  pickupDropoffErrors: string[] = [];

  /** Total seats of the currently selected bus (for maxBooking validation) */
  selectedBusTotalSeats: number | null = null;

  /** Highest physical occupancy across existing segments (edit mode guard) */
  maxPhysicalOccupancy = 0;

  readonly STEPS = [
    'TRIPS.CREATE.STEPS.BASIC_INFO',
    'TRIPS.CREATE.STEPS.STOP_SCHEDULE',
    'TRIPS.CREATE.STEPS.SEGMENTS',
    'TRIPS.CREATE.STEPS.PICKUP_DROPOFF',
    'TRIPS.CREATE.STEPS.EXPRESS_SEGMENTS',
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

  get expressSegments(): FormArray {
    return this.tripForm.get('expressSegments') as FormArray;
  }

  /** Places used in stops (for pickup/dropoff city filtering) */
  get boardingPlaces(): PlaceType[] {
    return this.stopSchedule.controls
      .filter((c) => c.get('boardingAllowed')?.value)
      .map((c) => c.get('place')?.value)
      .filter((p): p is PlaceType => !!p?.id);
  }

  get droppingPlaces(): PlaceType[] {
    return this.stopSchedule.controls
      .filter((c) => c.get('droppingAllowed')?.value)
      .map((c) => c.get('place')?.value)
      .filter((p): p is PlaceType => !!p?.id);
  }

  comparePlaces = (left: PlaceType | null, right: PlaceType | null): boolean =>
    left?.id === right?.id;

  private resolvePlaceById(placeId?: string | null): PlaceType | null {
    if (!placeId) {
      return null;
    }

    return (
      this.places.find((place) => place.id === placeId) ??
      ({
        id: placeId,
        city: this.tripPlacesMap.get(placeId) || placeId,
      } as PlaceType)
    );
  }

  get selectedCurrency(): CurrencyType | null {
    const currencyId = this.tripForm?.get('currencyId')?.value;
    if (!currencyId) {
      return null;
    }

    return (
      this.currencies.find((currency) => currency.id === currencyId) ?? null
    );
  }

  get canAddExpressSegment(): boolean {
    return !this.isEditMode || this.trip?.status === TripStatusEnum.SCHEDULED;
  }

  get canEditExpressSegmentValues(): boolean {
    return (
      !this.isEditMode ||
      this.trip?.status === TripStatusEnum.SCHEDULED ||
      this.trip?.status === TripStatusEnum.ACTIVE
    );
  }

  get canEditExpressSegmentCoverage(): boolean {
    return !this.isEditMode || this.trip?.status === TripStatusEnum.SCHEDULED;
  }

  get showReadonlyExpressSegmentTable(): boolean {
    return this.isEditMode && !this.canEditExpressSegmentValues;
  }

  get expressSegmentHintKey(): string {
    if (!this.isEditMode) {
      return 'TRIPS.CREATE.EXPRESS_SEGMENTS.HINT';
    }

    if (this.trip?.status === TripStatusEnum.SCHEDULED) {
      return 'TRIPS.EDIT_MODE.EXPRESS_SEGMENTS_SCHEDULED';
    }

    if (this.trip?.status === TripStatusEnum.ACTIVE) {
      return 'TRIPS.EDIT_MODE.EXPRESS_SEGMENTS_ACTIVE';
    }

    return 'TRIPS.EDIT_MODE.EXPRESS_SEGMENTS_READONLY';
  }

  constructor(
    private fb: FormBuilder,
    private route: ActivatedRoute,
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
    this.loadBuses();
    this.loadPlaces();
    this.loadCurrencies();

    const id = this.route.snapshot.paramMap.get('id');
    if (id) {
      // ── EDIT MODE ──
      this.isEditMode = true;
      this.tripService.trip$
        .pipe(take(1), takeUntil(this.destroy$))
        .subscribe((trip) => {
          this.trip = trip;
          this.buildForm();
          this.populateFormFromTrip(trip);
          this.applyEditModeRestrictions();
          this.initialValues = this.tripForm.getRawValue();
          this.onFormChanges();
          this.pageInfo.setTitle(this.translate.instant('TRIPS.EDIT_TITLE'));
          this.cdr.markForCheck();
        });
    } else {
      // ── CREATE MODE ──
      this.buildForm();
      this.initialValues = this.tripForm.getRawValue();
      this.onFormChanges();
      this.pageInfo.setTitle(this.translate.instant('TRIPS.CREATE.TITLE'));
    }
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
      // Step 2 — Stops
      stopSchedule: this.fb.array([]),
      // Step 3 — Segments (auto-generated)
      segments: this.fb.array([]),
      // Step 4 — Pickup & Dropoff
      pickupPoints: this.fb.array([]),
      dropoffPoints: this.fb.array([]),
      // Step 5 — Express segments
      expressSegments: this.fb.array([]),
    });
  }

  private loadBuses(): void {
    this.busService
      .list()
      .pipe(takeUntil(this.destroy$))
      .subscribe((buses) => {
        this.buses = buses;
        if (this.tripForm) {
          this.syncSelectedBusCapacity();
        }
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
        this.currencies = currencies;
        this.cdr.markForCheck();
      });
  }

  private onFormChanges(): void {
    this.syncSelectedBusCapacity();

    this.tripForm
      .get('busId')
      ?.valueChanges.pipe(takeUntil(this.destroy$))
      .subscribe(() => {
        this.syncSelectedBusCapacity();
        this.cdr.markForCheck();
      });

    this.tripForm.valueChanges.pipe(takeUntil(this.destroy$)).subscribe(() => {
      const changed = FormHelper.getChangedValues(
        this.tripForm.getRawValue(),
        this.initialValues,
      );
      this.isButtonDisabled = keys(changed).length === 0;
    });
  }

  // ══════════════════════════════════════════════════
  //  Edit mode — populate form from existing trip
  // ══════════════════════════════════════════════════
  private populateFormFromTrip(trip: TripType): void {
    if (!trip) return;

    // Build place lookup from embedded trip data
    this.buildTripPlacesMap(trip);

    // Step 0 — Basic info
    this.tripForm.patchValue({
      busId: trip.bus?.busId || '',
      departureDate: trip.departureDate || null,
      timezone: trip.timezone || '',
      currencyId: trip.currency?.id || '',
    });

    // Track bus seats
    const bus = this.buses.find((b) => b.id === trip.bus?.busId);
    this.selectedBusTotalSeats =
      bus?.totalSeats ?? trip.bus?.totalSeats ?? null;
    this.maxPhysicalOccupancy = computeTripMaxPhysicalOccupancy(trip);

    // Step 1 — Stop schedule
    this.stopSchedule.clear();
    (trip.stopSchedule || [])
      .sort((a, b) => a.sequence - b.sequence)
      .forEach((stop) => {
        this.stopSchedule.push(
          this.fb.group({
            place: [stop.place ?? null, Validators.required],
            arrivalTime: [stop.arrivalTime],
            departureTime: [stop.departureTime],
            boardingAllowed: [stop.boardingAllowed],
            droppingAllowed: [stop.droppingAllowed],
          }),
        );
      });

    // Step 2 — Segments (read-only in edit mode)
    this.segments.clear();
    this.segmentDisplays = [];
    (trip.segments || [])
      .sort((a, b) => a.sequence - b.sequence)
      .forEach((seg, i) => {
        const originPlaceId = seg.fromPlace?.id || '';
        const destinationPlaceId = seg.toPlace?.id || '';
        this.segmentDisplays.push({
          index: i,
          originPlaceId,
          originPlaceName:
            seg.fromPlace?.city ||
            this.resolvePlaceById(originPlaceId)?.city ||
            originPlaceId,
          destinationPlaceId,
          destinationPlaceName:
            seg.toPlace?.city ||
            this.resolvePlaceById(destinationPlaceId)?.city ||
            destinationPlaceId,
        });
        this.segments.push(
          this.fb.group({
            segmentId: [seg.segmentId],
            basePrice: [
              seg.basePrice,
              [Validators.required, Validators.min(0)],
            ],
            maxBooking: [
              seg.maxBooking,
              [Validators.required, Validators.min(1)],
            ],
            distanceKm: [
              seg.distanceKm,
              [Validators.required, Validators.min(0.1)],
            ],
            durationMinutesOverride: [seg.durationMinutes ?? null],
            bookedCount: [seg.bookedCount],
          }),
        );
      });
    this.rebuildSegmentIndexOptions();

    // Step 3 — Pickup points
    this.pickupPoints.clear();
    (trip.pickupPoints || []).forEach((pp) => {
      this.pickupPoints.push(
        this.fb.group({
          pointId: [pp.pointId],
          place: [pp.place ?? null, Validators.required],
          address: [pp.address, Validators.required],
          scheduledDepartureTime: [
            pp.scheduledDepartureTime,
            Validators.required,
          ],
          active: [pp.active],
          latitude: [
            pp.location?.latitude ?? null,
            [Validators.min(-90), Validators.max(90)],
          ],
          longitude: [
            pp.location?.longitude ?? null,
            [Validators.min(-180), Validators.max(180)],
          ],
        }),
      );
    });

    // Step 3 — Dropoff points
    this.dropoffPoints.clear();
    (trip.dropoffPoints || []).forEach((dp) => {
      this.dropoffPoints.push(
        this.fb.group({
          pointId: [dp.pointId],
          place: [dp.place ?? null, Validators.required],
          address: [dp.address, Validators.required],
          scheduledArrivalTime: [dp.scheduledArrivalTime, Validators.required],
          active: [dp.active],
          latitude: [
            dp.location?.latitude ?? null,
            [Validators.min(-90), Validators.max(90)],
          ],
          longitude: [
            dp.location?.longitude ?? null,
            [Validators.min(-180), Validators.max(180)],
          ],
        }),
      );
    });

    // Step 4 — Express segments
    this.expressSegments.clear();
    (trip.expressSegments || []).forEach((expressSegment) => {
      // Map segmentsCovered (segmentIds) back to indices
      const segmentIds = trip.segments
        .sort((a, b) => a.sequence - b.sequence)
        .map((s) => s.segmentId);
      const indices = (expressSegment.segmentsCovered || [])
        .map((id) => segmentIds.indexOf(id))
        .filter((idx) => idx >= 0);

      this.expressSegments.push(
        this.fb.group({
          expressSegmentId: [expressSegment.expressSegmentId],
          bookedCount: [expressSegment.bookedCount ?? 0],
          segmentIndices: [
            indices,
            (c: AbstractControl) =>
              c.value?.length > 0 ? null : { required: true },
          ],
          price: [
            expressSegment.price,
            [Validators.required, Validators.min(0)],
          ],
          validFrom: [expressSegment.validFrom],
          validUntil: [expressSegment.validUntil],
          active: [expressSegment.active],
        }),
      );
    });
  }

  // ══════════════════════════════════════════════════
  //  Edit mode — disable fields based on trip status
  // ══════════════════════════════════════════════════
  private applyEditModeRestrictions(): void {
    if (!this.trip) return;

    // Segments are ALWAYS frozen — disable all segment controls
    this.segments.controls.forEach((seg) => seg.disable());

    if (!this.canEditExpressSegmentValues) {
      this.expressSegments.controls.forEach((expressSegment) =>
        expressSegment.disable(),
      );
    } else if (!this.canEditExpressSegmentCoverage) {
      this.expressSegments.controls.forEach((expressSegment) => {
        expressSegment.get('segmentIndices')?.disable({ emitEvent: false });
      });
    }

    if (this.trip.status === TripStatusEnum.ACTIVE) {
      const physicalOccupancyBySegmentId = buildPhysicalOccupancyBySegmentId(
        this.trip,
      );

      this.tripForm.get('departureDate')?.disable();
      this.tripForm.get('currencyId')?.disable();

      // Disable stop times when adjacent segments have bookings
      this.stopSchedule.controls.forEach((stop, i) => {
        const previousSegmentId = this.segments
          .at(i - 1)
          ?.get('segmentId')?.value;
        const nextSegmentId = this.segments.at(i)?.get('segmentId')?.value;
        const hasBookedBefore =
          i > 0 &&
          (physicalOccupancyBySegmentId.get(previousSegmentId) || 0) > 0;
        const hasBookedAfter =
          i < this.segments.length &&
          (physicalOccupancyBySegmentId.get(nextSegmentId) || 0) > 0;
        if (hasBookedBefore || hasBookedAfter) {
          stop.get('arrivalTime')?.disable();
          stop.get('departureTime')?.disable();
        }
      });
    }

    if (
      this.trip.status === TripStatusEnum.COMPLETED ||
      this.trip.status === TripStatusEnum.CANCELLED
    ) {
      this.tripForm.disable();
    }
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
      .map((c, i) => (i !== stopIndex ? c.get('place')?.value?.id : null))
      .filter((id): id is string => Boolean(id));
    return this.places.filter((p) => !selectedIds.includes(p.id));
  }

  /** Clear handler for stop city ng-select */
  clearStopPlace(stopIndex: number): void {
    this.stopSchedule.at(stopIndex).get('place')?.setValue(null);
    this.cdr.markForCheck();
  }

  get hasInsufficientBusCapacity(): boolean {
    return (
      this.isEditMode &&
      this.maxPhysicalOccupancy > 0 &&
      this.selectedBusTotalSeats != null &&
      this.selectedBusTotalSeats < this.maxPhysicalOccupancy
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
          f.get('currencyId')!.valid &&
          !this.hasInsufficientBusCapacity
        );
      }
      case 1:
        return (
          this.stopSchedule.length >= 2 &&
          this.stopSchedule.valid &&
          this.timelineErrors.length === 0
        );
      case 2: {
        // In edit mode, segments are frozen — always valid
        if (this.isEditMode) return true;
        if (this.segments.length === 0 || !this.segments.valid) return false;
        if (this.selectedBusTotalSeats != null) {
          const segs = this.segments.getRawValue();
          if (segs.some((s: any) => s.maxBooking > this.selectedBusTotalSeats!))
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
        return (
          this.showReadonlyExpressSegmentTable || this.expressSegments.valid
        );
      default:
        return true;
    }
  }

  nextStep(): void {
    // When leaving step 0 (basic info), sync departureDate to first stop & track bus
    if (this.currentStep === 0) {
      this.syncSelectedBusCapacity();
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
      if (this.currentStep === 0 && this.hasInsufficientBusCapacity) {
        this.showBusCapacityError();
      }
      if (this.currentStep === 1 && this.timelineErrors.length > 0) {
        this.alert.error(this.timelineErrors.join('<br>'));
      }
      return;
    }

    // When leaving step 1 (stops), regenerate segments (create mode only)
    if (this.currentStep === 1 && !this.isEditMode) {
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
    // In edit mode, all steps are unlocked — allow free navigation
    if (this.isEditMode || step <= this.currentStep) {
      this.currentStep = step;
      this.cdr.markForCheck();
    }
  }

  private markCurrentStepTouched(): void {
    switch (this.currentStep) {
      case 0:
        ['busId', 'departureDate', 'timezone', 'currencyId'].forEach((name) =>
          this.tripForm.get(name)?.markAsTouched(),
        );
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
        this.expressSegments.markAllAsTouched();
        break;
    }
  }

  // ══════════════════════════════════════════════════
  //  Step 2 — Stop Schedule
  // ══════════════════════════════════════════════════
  addStop(): void {
    this.stopSchedule.push(
      this.fb.group({
        place: [null, Validators.required],
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

  private buildTripPlacesMap(trip: TripType): void {
    trip.stopSchedule?.forEach((stop) => {
      if (stop.place?.city)
        this.tripPlacesMap.set(stop.placeId, stop.place.city);
    });
    trip.segments?.forEach((seg) => {
      const originPlaceId = seg.fromPlace?.id;
      const destinationPlaceId = seg.toPlace?.id;
      if (seg.fromPlace?.city && originPlaceId)
        this.tripPlacesMap.set(originPlaceId, seg.fromPlace.city);
      if (seg.toPlace?.city && destinationPlaceId)
        this.tripPlacesMap.set(destinationPlaceId, seg.toPlace.city);
    });
    trip.pickupPoints?.forEach((pp) => {
      if (pp.place?.city) this.tripPlacesMap.set(pp.placeId, pp.place.city);
    });
    trip.dropoffPoints?.forEach((dp) => {
      if (dp.place?.city) this.tripPlacesMap.set(dp.placeId, dp.place.city);
    });
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
      const placeName = stop.place?.city || '-';

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
                prevPlace: prev.place?.city || '-',
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
      const stopPlaceId = stop.place?.id;

      if (stop.boardingAllowed) {
        const hasPickup = pickups.some((p: any) => p.place?.id === stopPlaceId);
        if (!hasPickup) {
          this.pickupDropoffErrors.push(
            this.translate.instant(
              'TRIPS.CREATE.ERRORS.MISSING_PICKUP_FOR_STOP',
              { stop: i + 1, place: stop.place?.city || '-' },
            ),
          );
        }
      }
      if (stop.droppingAllowed) {
        const hasDropoff = dropoffs.some(
          (d: any) => d.place?.id === stopPlaceId,
        );
        if (!hasDropoff) {
          this.pickupDropoffErrors.push(
            this.translate.instant(
              'TRIPS.CREATE.ERRORS.MISSING_DROPOFF_FOR_STOP',
              { stop: i + 1, place: stop.place?.city || '-' },
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
      const originPlaceId = from.place?.id || '';
      const destinationPlaceId = to.place?.id || '';

      // Try to preserve user-entered data by matching from→to
      const existingIdx = oldDisplays.findIndex(
        (d) =>
          d.originPlaceId === originPlaceId &&
          d.destinationPlaceId === destinationPlaceId,
      );
      const existing = existingIdx >= 0 ? oldSegments[existingIdx] : null;

      this.segmentDisplays.push({
        index: i,
        originPlaceId,
        originPlaceName: from.place?.city || originPlaceId,
        destinationPlaceId,
        destinationPlaceName: to.place?.city || destinationPlaceId,
      });

      this.segments.push(
        this.fb.group({
          basePrice: [
            existing?.basePrice ?? 0,
            [Validators.required, Validators.min(0)],
          ],
          maxBooking: [
            existing?.maxBooking ?? null,
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
    this.rebuildSegmentIndexOptions();
    this.cdr.markForCheck();
  }

  private rebuildSegmentIndexOptions(): void {
    this.segmentIndexOptions = this.segmentDisplays.map((d) => ({
      value: d.index,
      label: `${d.originPlaceName} → ${d.destinationPlaceName}`,
    }));
  }

  // ══════════════════════════════════════════════════
  //  Step 4 — Pickup & Dropoff points
  // ══════════════════════════════════════════════════
  addPickupPoint(): void {
    this.pickupPoints.push(
      this.fb.group({
        place: [null, Validators.required],
        address: ['', Validators.required],
        scheduledDepartureTime: [null, Validators.required],
        active: [true],
        latitude: [null, [Validators.min(-90), Validators.max(90)]],
        longitude: [null, [Validators.min(-180), Validators.max(180)]],
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
        place: [null, Validators.required],
        address: ['', Validators.required],
        scheduledArrivalTime: [null, Validators.required],
        active: [true],
        latitude: [null, [Validators.min(-90), Validators.max(90)]],
        longitude: [null, [Validators.min(-180), Validators.max(180)]],
      }),
    );
    this.cdr.markForCheck();
  }

  removeDropoffPoint(index: number): void {
    this.dropoffPoints.removeAt(index);
    this.cdr.markForCheck();
  }

  // ══════════════════════════════════════════════════
  //  Step 5 — Express Segments
  // ══════════════════════════════════════════════════
  addExpressSegment(): void {
    this.expressSegments.push(
      this.fb.group({
        expressSegmentId: [null],
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

  removeExpressSegment(index: number): void {
    this.expressSegments.removeAt(index);
    this.cdr.markForCheck();
  }

  getSegmentOptionLabel(
    item: { value?: number; label?: string } | number | null | undefined,
  ): string {
    if (typeof item === 'object' && item?.label) {
      return item.label;
    }

    const segmentIndex = this.resolveSegmentOptionValue(item);
    if (segmentIndex == null) {
      return '';
    }

    const segment = this.segmentDisplays[segmentIndex];
    return segment
      ? `${segment.originPlaceName} → ${segment.destinationPlaceName}`
      : '';
  }

  private resolveSegmentOptionValue(
    item: { value?: number } | number | null | undefined,
  ): number | null {
    if (typeof item === 'number') {
      return item;
    }

    if (typeof item?.value === 'number') {
      return item.value;
    }

    return null;
  }

  // ══════════════════════════════════════════════════
  //  Submit
  // ══════════════════════════════════════════════════
  submit(): void {
    if (this.tripForm.invalid) {
      this.tripForm.markAllAsTouched();
      this.alert.error(this.translate.instant('COMMON.FORM_INVALID'));
      return;
    }

    if (this.hasInsufficientBusCapacity) {
      this.tripForm.get('busId')?.markAsTouched();
      this.showBusCapacityError();
      return;
    }

    this.isSubmitting = true;

    const submitAction = this.isEditMode
      ? this.submitUpdate()
      : this.submitCreate();

    submitAction.pipe(takeUntil(this.destroy$)).subscribe({
      next: () => {
        this.alert.success(
          this.translate.instant(
            this.isEditMode
              ? 'TRIPS.MESSAGES.UPDATE_SUCCESS'
              : 'TRIPS.MESSAGES.SAVE_SUCCESS',
          ),
        );
        this.router.navigate(['/trips']);
      },
      error: (err) => {
        this.handleSubmitError(err);
        this.isSubmitting = false;
        this.cdr.markForCheck();
      },
    });
  }

  private submitCreate(): Observable<TripType> {
    const raw = this.tripForm.getRawValue();

    const payload: TripCreatePayload = {
      bus: { busId: raw.busId },
      departureDate: this.toISOString(raw.departureDate),
      timezone: raw.timezone,
      currencyId: raw.currencyId,
      stopSchedule: raw.stopSchedule.map((s: any, i: number) => ({
        placeId: s.place?.id || '',
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
        maxBooking: s.maxBooking,
        distanceKm: s.distanceKm,
        ...(s.durationMinutesOverride
          ? { durationMinutesOverride: s.durationMinutesOverride }
          : {}),
      })),
      pickupPoints: raw.pickupPoints.map((p: any) => ({
        placeId: p.place?.id || '',
        address: p.address,
        scheduledDepartureTime: this.toISOString(p.scheduledDepartureTime),
        active: p.active ?? true,
        ...this.buildLocationPayload(p),
      })),
      dropoffPoints: raw.dropoffPoints.map((d: any) => ({
        placeId: d.place?.id || '',
        address: d.address,
        scheduledArrivalTime: this.toISOString(d.scheduledArrivalTime),
        active: d.active ?? true,
        ...this.buildLocationPayload(d),
      })),
      expressSegments:
        raw.expressSegments.length > 0
          ? raw.expressSegments.map((expressSegment: any) => ({
              segmentIndices: expressSegment.segmentIndices,
              price: expressSegment.price,
              validFrom: expressSegment.validFrom
                ? this.toISOString(expressSegment.validFrom)
                : null,
              validUntil: expressSegment.validUntil
                ? this.toISOString(expressSegment.validUntil)
                : null,
              active: expressSegment.active ?? true,
            }))
          : undefined,
    };

    return this.tripService.create(payload);
  }

  private submitUpdate(): Observable<TripType> {
    const raw = this.tripForm.getRawValue();
    const changed = FormHelper.getChangedValues(raw, this.initialValues);

    const { beforeTripUpdate, afterTripUpdate } =
      this.buildExpressSegmentSyncOperations(raw.expressSegments || []);

    const payload: Partial<TripUpdatePayload> = {
      ...(changed.busId !== undefined && {
        bus: { busId: changed.busId },
      }),
      ...(changed.departureDate !== undefined && {
        departureDate: this.toISOString(changed.departureDate),
      }),
      ...(changed.timezone !== undefined && {
        timezone: changed.timezone,
      }),
      ...(changed.currencyId !== undefined && {
        currencyId: changed.currencyId,
      }),
      ...(changed.stopSchedule !== undefined && {
        stopSchedule: changed.stopSchedule.map((s: any, i: number) => ({
          placeId: s.place?.id || '',
          sequence: i,
          arrivalTime: s.arrivalTime ? this.toISOString(s.arrivalTime) : null,
          departureTime: s.departureTime
            ? this.toISOString(s.departureTime)
            : null,
          boardingAllowed: s.boardingAllowed,
          droppingAllowed: s.droppingAllowed,
        })),
      }),
      ...(changed.pickupPoints !== undefined && {
        pickupPoints: changed.pickupPoints.map((p: any) => ({
          placeId: p.place?.id || '',
          address: p.address,
          scheduledDepartureTime: this.toISOString(p.scheduledDepartureTime),
          active: p.active ?? true,
          ...this.buildLocationPayload(p),
        })),
      }),
      ...(changed.dropoffPoints !== undefined && {
        dropoffPoints: changed.dropoffPoints.map((d: any) => ({
          placeId: d.place?.id || '',
          address: d.address,
          scheduledArrivalTime: this.toISOString(d.scheduledArrivalTime),
          active: d.active ?? true,
          ...this.buildLocationPayload(d),
        })),
      }),
    };

    let request$ = of(this.trip);

    beforeTripUpdate.forEach((operation) => {
      request$ = request$.pipe(concatMap(() => operation));
    });

    if (Object.keys(payload).length > 0) {
      request$ = request$.pipe(
        concatMap(() => this.tripService.update(this.trip.id, payload)),
      );
    }

    afterTripUpdate.forEach((operation) => {
      request$ = request$.pipe(concatMap(() => operation));
    });

    return request$;
  }

  private buildExpressSegmentSyncOperations(currentExpressSegments: any[]): {
    beforeTripUpdate: Observable<TripType>[];
    afterTripUpdate: Observable<TripType>[];
  } {
    if (!this.isEditMode || !this.canEditExpressSegmentValues) {
      return { beforeTripUpdate: [], afterTripUpdate: [] };
    }

    const initialExpressSegments = this.initialValues?.expressSegments ?? [];
    const beforeTripUpdate: Observable<TripType>[] = [];
    const afterTripUpdate: Observable<TripType>[] = [];
    const currentById = new Map<string, any>();

    currentExpressSegments
      .filter((expressSegment) => !!expressSegment?.expressSegmentId)
      .forEach((expressSegment) =>
        currentById.set(expressSegment.expressSegmentId, expressSegment),
      );

    initialExpressSegments.forEach((initialExpressSegment: any) => {
      const expressSegmentId = initialExpressSegment?.expressSegmentId;
      if (!expressSegmentId) {
        return;
      }

      const currentExpressSegment = currentById.get(expressSegmentId);
      if (!currentExpressSegment) {
        if (this.canAddExpressSegment) {
          beforeTripUpdate.push(
            this.tripService.deleteExpressSegment(
              this.trip.id,
              expressSegmentId,
            ),
          );
        }
        return;
      }

      if (
        this.canEditExpressSegmentCoverage &&
        this.hasSegmentSelectionChanged(
          currentExpressSegment.segmentIndices,
          initialExpressSegment.segmentIndices,
        )
      ) {
        beforeTripUpdate.push(
          this.tripService.deleteExpressSegment(this.trip.id, expressSegmentId),
        );
        afterTripUpdate.push(
          this.tripService.addExpressSegment(
            this.trip.id,
            this.buildExpressSegmentCreatePayload(currentExpressSegment),
          ),
        );
        return;
      }

      const updatePayload = this.buildExpressSegmentUpdatePayload(
        currentExpressSegment,
        initialExpressSegment,
      );
      if (updatePayload) {
        afterTripUpdate.push(
          this.tripService.updateExpressSegment(
            this.trip.id,
            expressSegmentId,
            updatePayload,
          ),
        );
      }
    });

    if (this.canAddExpressSegment) {
      currentExpressSegments
        .filter((expressSegment) => !expressSegment?.expressSegmentId)
        .forEach((expressSegment) => {
          afterTripUpdate.push(
            this.tripService.addExpressSegment(
              this.trip.id,
              this.buildExpressSegmentCreatePayload(expressSegment),
            ),
          );
        });
    }

    return { beforeTripUpdate, afterTripUpdate };
  }

  private buildExpressSegmentCreatePayload(
    expressSegment: any,
  ): ExpressSegmentPayload {
    const segmentIndices = this.normalizeSegmentIndices(
      expressSegment.segmentIndices,
    );

    return {
      segmentIds: segmentIndices
        .map((index) => this.segments.at(index)?.get('segmentId')?.value)
        .filter((segmentId): segmentId is string => !!segmentId),
      price: expressSegment.price,
      validFrom: expressSegment.validFrom
        ? this.toISOString(expressSegment.validFrom)
        : null,
      validUntil: expressSegment.validUntil
        ? this.toISOString(expressSegment.validUntil)
        : null,
      active: expressSegment.active ?? true,
    };
  }

  private buildExpressSegmentUpdatePayload(
    currentExpressSegment: any,
    initialExpressSegment: any,
  ): ExpressSegmentUpdatePayload | null {
    const payload: ExpressSegmentUpdatePayload = {};

    if (currentExpressSegment.price !== initialExpressSegment.price) {
      payload.price = currentExpressSegment.price;
    }
    if (
      !this.areDateValuesEqual(
        currentExpressSegment.validFrom,
        initialExpressSegment.validFrom,
      )
    ) {
      payload.validFrom = currentExpressSegment.validFrom
        ? this.toISOString(currentExpressSegment.validFrom)
        : null;
    }
    if (
      !this.areDateValuesEqual(
        currentExpressSegment.validUntil,
        initialExpressSegment.validUntil,
      )
    ) {
      payload.validUntil = currentExpressSegment.validUntil
        ? this.toISOString(currentExpressSegment.validUntil)
        : null;
    }
    if (
      (currentExpressSegment.active ?? true) !==
      (initialExpressSegment.active ?? true)
    ) {
      payload.active = currentExpressSegment.active ?? true;
    }

    return Object.keys(payload).length > 0 ? payload : null;
  }

  private normalizeSegmentIndices(
    indices: Array<number | string> | null | undefined,
  ): number[] {
    return [
      ...new Set(
        (indices ?? [])
          .map((value) => Number(value))
          .filter((value) => Number.isInteger(value) && value >= 0),
      ),
    ].sort((left, right) => left - right);
  }

  private hasSegmentSelectionChanged(
    current: Array<number | string> | null | undefined,
    initial: Array<number | string> | null | undefined,
  ): boolean {
    const normalizedCurrent = this.normalizeSegmentIndices(current);
    const normalizedInitial = this.normalizeSegmentIndices(initial);

    return (
      normalizedCurrent.length !== normalizedInitial.length ||
      normalizedCurrent.some(
        (value, index) => value !== normalizedInitial[index],
      )
    );
  }

  private areDateValuesEqual(left: any, right: any): boolean {
    return this.toISOString(left) === this.toISOString(right);
  }

  private handleSubmitError(err: any): void {
    const backendMsg: string = err?.error?.message || '';
    let message: string;
    if (backendMsg.includes('UNRECOGNIZED_FIELD')) {
      const field = backendMsg.split(':')[1]?.trim() || '';
      message = this.translate.instant('TRIPS.MESSAGES.UNRECOGNIZED_FIELD', {
        field,
      });
    } else if (backendMsg.includes('MISSING_PICKUP_POINT')) {
      message = this.translate.instant('TRIPS.MESSAGES.MISSING_PICKUP');
    } else if (backendMsg.includes('MISSING_DROPOFF_POINT')) {
      message = this.translate.instant('TRIPS.MESSAGES.MISSING_DROPOFF');
    } else if (backendMsg.includes('BUS_ALREADY_ASSIGNED')) {
      message = this.translate.instant('TRIPS.MESSAGES.BUS_ALREADY_ASSIGNED');
    } else if (
      backendMsg.includes('MAX_BOOKING_EXCEEDS_BUS') ||
      backendMsg.includes('MAX_BOOKING_BELOW_BOOKED_COUNT')
    ) {
      message = this.translate.instant('TRIPS.MESSAGES.MAX_BOOKING_ERROR');
    } else if (backendMsg.includes('BLOCKED')) {
      message = backendMsg;
    } else if (
      backendMsg.includes('INVALID_TIMELINE') ||
      backendMsg.includes('INVALID_STOP_SEQUENCE')
    ) {
      message = this.translate.instant('TRIPS.MESSAGES.INVALID_TIMELINE');
    } else if (backendMsg.includes('INVALID_EXPRESS_SEGMENT_CHAIN')) {
      message = this.translate.instant(
        'TRIPS.MESSAGES.INVALID_EXPRESS_SEGMENT_CHAIN',
      );
    } else {
      message = this.translate.instant(
        this.isEditMode
          ? 'TRIPS.MESSAGES.UPDATE_ERROR'
          : 'TRIPS.MESSAGES.SAVE_ERROR',
      );
    }
    this.alert.error(message);
  }

  private syncSelectedBusCapacity(): void {
    const busId = this.tripForm?.get('busId')?.value;

    if (!busId) {
      this.selectedBusTotalSeats = null;
      return;
    }

    const bus = this.buses.find((item) => item.id === busId);
    this.selectedBusTotalSeats =
      bus?.totalSeats ??
      (this.isEditMode && busId === this.trip?.bus?.busId
        ? (this.trip.bus?.totalSeats ?? null)
        : null);
  }

  private showBusCapacityError(): void {
    this.alert.error(
      this.translate.instant(
        'TRIPS.CREATE.ERRORS.BUS_CAPACITY_BELOW_OCCUPANCY',
        {
          booked: this.maxPhysicalOccupancy,
          total: this.selectedBusTotalSeats ?? 0,
        },
      ),
    );
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

  private buildLocationPayload(point: {
    latitude?: number | string | null;
    longitude?: number | string | null;
  }): { location?: { latitude: number; longitude: number } } {
    const latitude = this.parseCoordinate(point.latitude);
    const longitude = this.parseCoordinate(point.longitude);

    if (latitude === null || longitude === null) {
      return {};
    }

    return {
      location: {
        latitude,
        longitude,
      },
    };
  }

  private parseCoordinate(
    value: number | string | null | undefined,
  ): number | null {
    if (value === null || value === undefined || value === '') {
      return null;
    }

    const numericValue = Number(value);
    return Number.isFinite(numericValue) ? numericValue : null;
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }
}
