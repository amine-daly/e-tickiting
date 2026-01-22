import { isEqual } from 'lodash';
import { Component, OnDestroy, OnInit } from '@angular/core';
import {
  NgbDropdownModule,
  NgbModal,
  NgbModule,
} from '@ng-bootstrap/ng-bootstrap';
import { CommonModule } from '@angular/common';
import {
  FormBuilder,
  FormsModule,
  FormGroup,
  ReactiveFormsModule,
  Validators,
  FormArray,
} from '@angular/forms';
import {
  combineLatest,
  finalize,
  Subject,
  Subscription,
  takeUntil,
} from 'rxjs';

import { TripType as TripType, TripStatus } from '../../core/models/trip.model';
import { TripService, TripUpdatePayload, StopInput } from './trip.service';
import { KeeniconComponent } from 'src/app/_metronic/shared/keenicon/keenicon.component';
import { AlertService } from '../../core/services/alert.service';
import { AgenciesService } from '../agencies/agencies.service';
import { PlacesService } from '../places/places.service';
import { NgSelectComponent } from '@ng-select/ng-select';
import {
  FlatpickrDirective,
  provideFlatpickrDefaults,
} from 'angularx-flatpickr';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { CdkDragDrop, DragDropModule } from '@angular/cdk/drag-drop';
import { PlaceType } from '../../core/models/place-type';

@Component({
  standalone: true,
  imports: [
    DragDropModule,
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    KeeniconComponent,
    NgSelectComponent,
    FlatpickrDirective,
    NgbDropdownModule,
    NgbModule,
    TranslateModule,
  ],
  providers: [provideFlatpickrDefaults()],
  selector: 'app-trip-list',
  templateUrl: './trip-list.component.html',
  styleUrls: ['./trip-list.component.scss'],
})
export class TripListComponent implements OnInit, OnDestroy {
  private allPlaces: PlaceType[] = [];
  private subscriptions = new Subscription();
  private selectedTrip: TripType | null = null;
  private initialValues: TripUpdatePayload | null = null;
  private unsubscribeAll: Subject<void> = new Subject<void>();

  form: FormGroup;
  filter: any = {};
  isButtonDisabled: boolean = true;
  statusUpdating: Record<string, boolean> = {};
  trips$ = this.tripService.trips$;
  loading$ = this.tripService.loading$;
  places$ = this.placesService.places$;
  agencies$ = this.agenciesService.agencies$;

  // Cached available options per stop index to avoid expensive per-render computations
  availablePlacesForStops: PlaceType[][] = [];
  // Options for origin/destination selects with optional disabled flag
  originOptions: Array<PlaceType & { disabled?: boolean }> = [];
  destinationOptions: Array<PlaceType & { disabled?: boolean }> = [];

  // Flatpickr options for departure date (min today, max +14 days)
  dateOptions: any = {};

  statusOptions: Array<{ value: TripStatus; labelKey: string }> = [
    { value: TripStatus.SCHEDULED, labelKey: 'TRIPS.STATUS.SCHEDULED' },
    { value: TripStatus.COMPLETED, labelKey: 'TRIPS.STATUS.COMPLETED' },
    { value: TripStatus.CANCELLED, labelKey: 'TRIPS.STATUS.CANCELLED' },
  ];
  statusLabelMap: Record<TripStatus, string> = {
    [TripStatus.SCHEDULED]: 'TRIPS.STATUS.SCHEDULED',
    [TripStatus.COMPLETED]: 'TRIPS.STATUS.COMPLETED',
    [TripStatus.CANCELLED]: 'TRIPS.STATUS.CANCELLED',
  };

  get editing(): boolean {
    return !!this.selectedTrip;
  }

  get stopsFormArray(): FormArray {
    return this.form.get('stops') as FormArray;
  }

  constructor(
    private fb: FormBuilder,
    private alert: AlertService,
    private modalService: NgbModal,
    private tripService: TripService,
    private translate: TranslateService,
    private placesService: PlacesService,
    private agenciesService: AgenciesService
  ) {}

  ngOnInit(): void {
    this.loadTrips();

    // Keep a cached copy of places so we can filter quickly without async pipes.
    const sub = this.places$.subscribe((places) => {
      this.allPlaces = Array.isArray(places) ? places : [];
      // recompute options when places list changes
      this.recomputeAvailablePlaces();
    });
    this.subscriptions.add(sub);
  }

  async changeStatus(trip: TripType, nextStatus: TripStatus): Promise<void> {
    if (!trip || trip.status === nextStatus) {
      return;
    }
    const statusLabel = this.t(this.statusLabelMap[nextStatus] || nextStatus);
    const result = await this.alert.confirm(
      this.t('TRIPS.MESSAGES.STATUS_CONFIRM_TITLE'),
      this.t('TRIPS.MESSAGES.STATUS_CONFIRM_TEXT', { status: statusLabel }),
      this.t('TRIPS.MESSAGES.STATUS_CONFIRM_OK'),
      this.t('COMMON.BUTTON.CANCEL')
    );
    if (!result.isConfirmed) {
      return;
    }
    this.statusUpdating[trip.id] = true;

    const sub = this.tripService
      .updateTrip(trip.id, { status: nextStatus })
      .pipe(finalize(() => (this.statusUpdating[trip.id] = false)))
      .subscribe({
        next: () =>
          this.alert.success(this.t('TRIPS.MESSAGES.STATUS_UPDATE_SUCCESS')),
        error: () =>
          this.alert.error(this.t('TRIPS.MESSAGES.STATUS_UPDATE_ERROR')),
      });
    this.subscriptions.add(sub);
  }

  loadTrips(): void {
    const sub = this.tripService.getTrips(this.filter).subscribe({
      error: () => this.alert.error(this.t('TRIPS.MESSAGES.LOAD_ERROR')),
    });
    this.subscriptions.add(sub);
  }

  applyFilters(filter: any): void {
    this.filter = filter;
    this.loadTrips();
  }

  openTripModal(modal: any, trip: TripType | null): void {
    // Tear down previous modal subscriptions to avoid leaks on repeated open/close.
    this.unsubscribeAll.next();
    this.unsubscribeAll.complete();
    this.unsubscribeAll = new Subject<void>();

    combineLatest([
      this.agenciesService.getAgencies(),
      this.placesService.getPlaces(),
    ]).subscribe();

    this.selectedTrip = trip;

    // Build stops form array from existing trip stops (each stop has placeId, rank, fare)
    const stopsControls = trip?.stops?.length
      ? trip.stops.map((s) =>
          this.fb.group({
            placeId: [s?.placeId ?? ''],
            fare: [s?.fare ?? 0],
          })
        )
      : [];
    const stopsFormArray = this.fb.array(stopsControls);

    this.form = this.fb.group({
      agencyId: [trip?.agency?.id],
      originId: [trip?.originId || '', Validators.required],
      destinationId: [trip?.destinationId || '', Validators.required],
      departureDate: [trip?.departureDate || '', Validators.required],
      totalPrice: [
        trip?.totalPrice || 0,
        [Validators.required, Validators.min(0)],
      ],
      totalPlaces: [
        (trip as any)?.totalPlaces ?? '',
        [Validators.required, Validators.min(0)],
      ],
      stops: stopsFormArray,
    });

    // Configure date picker bounds: min = today (start of day), max = today + 14 days
    const today = new Date();
    // Set time to 00:00 for min date
    const minDate = new Date(
      today.getFullYear(),
      today.getMonth(),
      today.getDate()
    );
    const maxDate = new Date(minDate.getTime() + 14 * 24 * 60 * 60 * 1000);
    this.dateOptions = {
      enableTime: true,
      altInput: true,
      altFormat: 'F j, Y h:i K',
      dateFormat: 'Y-m-d H:i',
      minDate,
      maxDate,
    };
    this.initialValues = this.form.value;
    this.form.valueChanges
      .pipe(takeUntil(this.unsubscribeAll))
      .subscribe((values) => {
        this.isButtonDisabled = isEqual(this.initialValues, values);
        this.recomputeAvailablePlaces();
      });

    // Compute initial options
    this.recomputeAvailablePlaces();

    this.modalService.open(modal, { size: 'lg', centered: true });
  }

  submit(modal?: any): void {
    let field = this.selectedTrip ? 'updateTrip' : 'createTrip';
    this.isButtonDisabled = true;

    // Build stops payload from the FormArray (each stop has placeId, fare)
    const stopsRaw = (this.stopsFormArray.value || []) as Array<{
      placeId: string;
      fare: number;
    }>;
    const stops: StopInput[] = stopsRaw
      .filter((s) => s?.placeId)
      .map((s, idx) => ({
        placeId: s.placeId,
        rank: idx,
        fare: s.fare ?? 0,
      }));

    const payload: any = {
      agencyId: this.form.get('agencyId')?.value,
      originId: this.form.get('originId')?.value,
      destinationId: this.form.get('destinationId')?.value,
      departureDate: this.form.get('departureDate')?.value,
      totalPrice: this.form.get('totalPrice')?.value,
      totalPlaces: this.form.get('totalPlaces')?.value,
      stops,
    };

    const args = this.selectedTrip
      ? [this.selectedTrip.id, payload]
      : [payload];
    this.tripService[field](...args).subscribe({
      next: (res) => {
        this.alert.success(this.t('TRIPS.MESSAGES.SAVE_SUCCESS'));
        modal?.close();
        // NOTE: seat generation requires a seat-map layout matching totalPlaces.
        // Keep manual generation for now to avoid server-side mismatch errors.
      },
      error: (err: any) => {
        const rawMsg =
          err?.error?.message || err?.error?.details || err?.message;
        const normalizedMsg = this.normalizeServerMessage(rawMsg);

        // Known validation: totalPlaces must match the seat map size (N)
        if (typeof normalizedMsg === 'string') {
          const match = normalizedMsg.match(
            /totalPlaces\s+must\s+match\s+the\s+seat\s+map\s+size\s*\((\d+)\)/i
          );
          if (match?.[1]) {
            this.alert.error(
              this.t('TRIPS.MESSAGES.SAVE_ERROR'),
              this.t('TRIPS.MESSAGES.TOTAL_PLACES_SEATMAP_MISMATCH', {
                total: match[1],
              })
            );
            return;
          }
        }

        if (normalizedMsg) {
          this.alert.error(
            this.t('TRIPS.MESSAGES.SAVE_ERROR'),
            String(normalizedMsg)
          );
        } else {
          this.alert.error(this.t('COMMON.MESSAGES.GENERIC_ERROR'));
        }
      },
    });
  }

  private normalizeServerMessage(message: unknown): string | null {
    if (message === null || message === undefined) return null;
    let text = String(message).trim();
    if (!text) return null;

    // Strip Spring/Angular style prefixes like: 400 BAD_REQUEST "..."
    text = text.replace(/^\s*\d{3}\s+[A-Z_]+\s*/g, '');

    // Strip surrounding quotes
    if (
      (text.startsWith('"') && text.endsWith('"')) ||
      (text.startsWith("'") && text.endsWith("'"))
    ) {
      text = text.slice(1, -1).trim();
    }

    return text || null;
  }

  // Get place name for display
  getPlaceName(placeId: string): string {
    const place = this.allPlaces.find((p) => p.id === placeId);
    return place?.city || placeId;
  }

  // Get route preview for trip display
  routePreview(trip: TripType | null | undefined): string {
    if (!trip) return '';

    const parts: string[] = [];
    if (trip.origin?.city) {
      parts.push(trip.origin.city);
    } else {
      const origin = this.allPlaces.find((p) => p.id === trip.originId);
      if (origin?.city) parts.push(origin.city);
    }

    // Add intermediate stops if any
    if (trip.stops?.length) {
      for (const stop of trip.stops) {
        const city = stop.place?.city || this.getPlaceName(stop.placeId);
        if (city && !parts.includes(city)) {
          parts.push(city);
        }
      }
    }

    // Add final destination
    if (trip.destination?.city) {
      if (!parts.includes(trip.destination.city)) {
        parts.push(trip.destination.city);
      }
    } else {
      const dest = this.allPlaces.find((p) => p.id === trip.destinationId);
      if (dest?.city && !parts.includes(dest.city)) {
        parts.push(dest.city);
      }
    }

    return parts.filter(Boolean).join(' → ');
  }

  addStopField() {
    const fa = this.stopsFormArray;
    fa.push(
      this.fb.group({
        placeId: [],
        fare: [0],
      })
    );
    this.recomputeAvailablePlaces();
  }

  removeStop(idx: number): void {
    const fa = this.stopsFormArray;
    fa.removeAt(idx);
    this.recomputeAvailablePlaces();
  }

  moveStopUp(idx: number): void {
    if (idx <= 0) return;
    const fa = this.stopsFormArray;
    const val = fa.at(idx).value;
    fa.removeAt(idx);
    fa.insert(
      idx - 1,
      this.fb.group({
        placeId: [val?.placeId || ''],
        fare: [val?.fare || 0],
      })
    );
    this.recomputeAvailablePlaces();
  }

  moveStopDown(idx: number): void {
    if (idx >= this.stopsFormArray.length - 1) return;
    const fa = this.stopsFormArray;
    const val = fa.at(idx).value;
    fa.removeAt(idx);
    fa.insert(
      idx + 1,
      this.fb.group({
        placeId: [val?.placeId || ''],
        fare: [val?.fare || 0],
      })
    );
    this.recomputeAvailablePlaces();
  }

  dropStop(event: CdkDragDrop<any[]>): void {
    const fa = this.stopsFormArray;
    const val = fa.at(event.previousIndex).value;
    fa.removeAt(event.previousIndex);
    fa.insert(
      event.currentIndex,
      this.fb.group({
        placeId: [val?.placeId || ''],
        fare: [val?.fare || 0],
      })
    );
    this.recomputeAvailablePlaces();
  }

  deleteTrip(trip: TripType): void {
    this.alert
      .warning(
        this.t('COMMON.CONFIRM.DELETE_TITLE'),
        this.t('COMMON.CONFIRM.DELETE_TEXT')
      )
      .then((result) => {
        if (result.isConfirmed) {
          const sub = this.tripService.deleteTrip(trip.id).subscribe({
            next: () =>
              this.alert.success(this.t('TRIPS.MESSAGES.DELETE_SUCCESS')),
            error: () =>
              this.alert.error(this.t('TRIPS.MESSAGES.DELETE_ERROR')),
          });
          this.subscriptions.add(sub);
        }
      });
  }

  isInvalid(controlName: string): boolean {
    const control = this.form.get(controlName);
    return !!control && control.invalid && (control.dirty || control.touched);
  }

  ngOnDestroy(): void {
    this.unsubscribeAll.next();
    this.unsubscribeAll.complete();
    this.subscriptions.unsubscribe();
  }

  private t(key: string, params?: Record<string, unknown>): string {
    return this.translate.instant(key, params);
  }

  // Format fare for display
  formatFare(fare: number | undefined): string {
    if (fare === undefined || fare === null) return '-';
    return fare.toFixed(3) + ' TND';
  }

  // Recompute cached available options for all stop indices. This is called
  // once per form change instead of per-render to avoid overload.
  private recomputeAvailablePlaces(): void {
    if (!this.form) return;

    const originId = this.form.get('originId')?.value;
    const destinationId = this.form.get('destinationId')?.value;

    // Build set of selected placeIds (including origin/destination)
    const selected = new Set<string>();
    if (originId) selected.add(originId);
    if (destinationId) selected.add(destinationId);

    const stops = this.stopsFormArray.controls.map((ctrl) => ctrl.value || {});

    // Collect selected stops (all indices)
    stops.forEach((s: any) => {
      const id = s?.placeId;
      if (id) selected.add(id);
    });

    // For each stop index, compute its allowed options but allow the control's
    // current value even if it's in `selected` (so editing doesn't clear it).
    this.availablePlacesForStops = this.stopsFormArray.controls.map((ctrl) => {
      const current = ctrl.value?.placeId;
      return this.allPlaces.filter((p) => {
        if (!p || !p.id) return false;
        if (p.id === current) return true;
        return !selected.has(p.id);
      });
    });

    // Build origin/destination option lists with disabled flags.
    const selectedStops = new Set<string>();
    stops.forEach((s: any) => {
      if (s?.placeId) selectedStops.add(s.placeId);
    });

    this.originOptions = this.allPlaces.map((p) => {
      const curr = originId;
      const disabled =
        p.id !== curr && (p.id === destinationId || selectedStops.has(p.id));
      return { ...p, disabled };
    });

    this.destinationOptions = this.allPlaces.map((p) => {
      const curr = destinationId;
      const disabled =
        p.id !== curr && (p.id === originId || selectedStops.has(p.id));
      return { ...p, disabled };
    });
  }
}
