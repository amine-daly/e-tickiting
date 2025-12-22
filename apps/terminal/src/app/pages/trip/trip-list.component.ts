import { isEqual } from 'lodash';
import { Component, OnDestroy, OnInit, TemplateRef } from '@angular/core';
import {
  NgbDropdownModule,
  NgbModal,
  NgbModule,
} from '@ng-bootstrap/ng-bootstrap';
import Swal from 'sweetalert2';
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
import { RouteType } from '../../core/models/route.model';
import { TripService, TripUpdatePayload, RouteInput } from './trip.service';
import { KeeniconComponent } from 'src/app/_metronic/shared/keenicon/keenicon.component';
import { AlertService } from '../../core/services/alert.service';
import { FormHelper } from '../../core/helpers/form-helper';
import { AgenciesService } from '../agencies/agencies.service';
import { PlacesService } from '../places/places.service';
import { RoutesService } from '../routes/routes.service';
import { NgSelectComponent } from '@ng-select/ng-select';
import {
  FlatpickrDirective,
  provideFlatpickrDefaults,
} from 'angularx-flatpickr';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import {
  CdkDragDrop,
  moveItemInArray,
  DragDropModule,
} from '@angular/cdk/drag-drop';
import { firstValueFrom } from 'rxjs';
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
  routes$ = this.routesService.routes$;

  private allPlaces: PlaceType[] = [];
  private allRoutes: RouteType[] = [];

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
    private agenciesService: AgenciesService,
    private routesService: RoutesService
  ) {}

  ngOnInit(): void {
    this.loadTrips();

    // Keep a cached copy of places so we can filter quickly without async pipes.
    const sub = this.places$.subscribe((places) => {
      this.allPlaces = Array.isArray(places) ? places : [];
    });
    this.subscriptions.add(sub);

    // Keep a cached copy of routes
    const routeSub = this.routes$.subscribe((routes) => {
      this.allRoutes = Array.isArray(routes) ? routes : [];
    });
    this.subscriptions.add(routeSub);
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
      this.routesService.getRoutes(),
    ]).subscribe();

    this.selectedTrip = trip;

    // Build stops form array from existing trip stops
    const stopsControls = trip?.stops?.length
      ? trip.stops.map((r) => this.fb.control(r?.id ?? null))
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
      availableSeats: [
        trip?.availableSeats || '',
        [Validators.required, Validators.min(0)],
      ],
      stops: stopsFormArray,
    });

    this.initialValues = this.form.value;
    this.form.valueChanges
      .pipe(takeUntil(this.unsubscribeAll))
      .subscribe((values) => {
        this.isButtonDisabled = isEqual(this.initialValues, values);
      });

    this.modalService.open(modal, { size: 'lg', centered: true });
  }

  submit(modal?: any): void {
    let field = this.selectedTrip ? 'updateTrip' : 'createTrip';
    this.isButtonDisabled = true;

    // Build stops payload from the FormArray
    const stopIds = (this.stopsFormArray.value || []) as Array<string | null>;
    const stops: RouteInput[] = stopIds
      .filter((id): id is string => !!id)
      .map((routeId) => ({ routeId }));

    const payload: any = {
      agencyId: this.form.get('agencyId')?.value,
      originId: this.form.get('originId')?.value,
      destinationId: this.form.get('destinationId')?.value,
      departureDate: this.form.get('departureDate')?.value,
      totalPrice: this.form.get('totalPrice')?.value,
      availableSeats: this.form.get('availableSeats')?.value,
      stops,
    };

    const args = this.selectedTrip
      ? [this.selectedTrip.id, payload]
      : [payload];
    this.tripService[field](...args).subscribe({
      next: (res) => {
        console.log('🚀 ~ TripListComponent ~ submit ~ res:', res);
        this.alert.success(this.t('TRIPS.MESSAGES.SAVE_SUCCESS'));
        modal?.close();
        if (!this.selectedTrip) {
          this.tripService.generateSeats(res.id).subscribe();
        }
      },
      error: () => this.alert.error(this.t('COMMON.MESSAGES.GENERIC_ERROR')),
    });
  }

  // Get route label for display
  getRouteLabel(routeId: string): string {
    const route = this.allRoutes.find((r) => r.id === routeId);
    if (!route) return routeId;
    const origin = route.origin?.city || route.originId;
    const dest = route.destination?.city || route.destinationId;
    return `${origin} → ${dest} (${route.fare?.toFixed(3) || '0'} TND)`;
  }

  // Get route preview for trip display
  routePreview(trip: TripType | null | undefined): string {
    if (!trip) return '';

    // Use origin and destination directly
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
        const place = this.allPlaces.find((p) => p.id === stop.destinationId);
        if (place?.city && !parts.includes(place.city)) {
          parts.push(place.city);
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
    fa.push(this.fb.control(null));
  }

  removeStop(idx: number): void {
    const fa = this.stopsFormArray;
    fa.removeAt(idx);
  }

  moveStopUp(idx: number): void {
    if (idx <= 0) return;
    const fa = this.stopsFormArray;
    const val = fa.at(idx).value;
    fa.removeAt(idx);
    fa.insert(idx - 1, this.fb.control(val));
  }

  moveStopDown(idx: number): void {
    if (idx >= this.stopsFormArray.length - 1) return;
    const fa = this.stopsFormArray;
    const val = fa.at(idx).value;
    fa.removeAt(idx);
    fa.insert(idx + 1, this.fb.control(val));
  }

  dropStop(event: CdkDragDrop<any[]>): void {
    const fa = this.stopsFormArray;
    const val = fa.at(event.previousIndex).value;
    fa.removeAt(event.previousIndex);
    fa.insert(event.currentIndex, this.fb.control(val));
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
}
