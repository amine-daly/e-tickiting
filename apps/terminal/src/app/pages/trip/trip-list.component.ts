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
  FormGroup,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import {
  combineLatest,
  finalize,
  Subject,
  Subscription,
  takeUntil,
} from 'rxjs';

import { Trip as TripType, TripStatus } from '../../core/models/trip.model';
import {
  TripCreatePayload,
  TripService,
  TripUpdatePayload,
} from './trip.service';
import { KeeniconComponent } from 'src/app/_metronic/shared/keenicon/keenicon.component';
import { AlertService } from '../../core/services/alert.service';
import { FormHelper } from '../../core/helpers/form-helper';
import { AgenciesService } from '../agencies/agencies.service';
import { PlacesService } from '../places/places.service';
import { NgSelectComponent } from '@ng-select/ng-select';
import {
  FlatpickrDirective,
  provideFlatpickrDefaults,
} from 'angularx-flatpickr';
import { TranslateModule, TranslateService } from '@ngx-translate/core';

@Component({
  standalone: true,
  imports: [
    CommonModule,
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
  private unsubscribeAll: Subject<void> = new Subject<void>();

  form: FormGroup;
  filter: any = {};
  isButtonDisabled: boolean = true;
  statusUpdating: Record<string, boolean> = {};
  trips$ = this.tripService.trips$;
  loading$ = this.tripService.loading$;
  places$ = this.placesService.places$;
  agencies$ = this.agenciesService.agencies$;
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

  private subscriptions = new Subscription();
  private selectedTrip: TripType | null = null;
  private initialValues: TripUpdatePayload | null = null;

  constructor(
    private tripService: TripService,
    private modalService: NgbModal,
    private fb: FormBuilder,
    private alert: AlertService,
    private agenciesService: AgenciesService,
    private placesService: PlacesService,
    private translate: TranslateService
  ) {}

  ngOnInit(): void {
    this.loadTrips();
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

  openTripModal(modal: any, trip: TripType): void {
    combineLatest([
      this.agenciesService.getAgencies(),
      this.placesService.getPlaces(),
    ]).subscribe();
    this.selectedTrip = trip;
    this.form = this.fb.group({
      agencyId: [trip?.agency?.id],
      originId: [trip?.origin?.id, Validators.required],
      destinationId: [trip?.destination?.id, Validators.required],
      departureDate: [trip?.departureDate || '', Validators.required],
      price: [trip?.price || '', [Validators.required, Validators.min(0)]],
      availableSeats: [
        trip?.availableSeats || '',
        [Validators.required, Validators.min(0)],
      ],
    });
    this.initialValues = this.form.value;
    this.form.valueChanges
      .pipe(takeUntil(this.unsubscribeAll))
      .subscribe((values) => {
        this.isButtonDisabled = isEqual(this.initialValues, values);
      });
    this.modalService.open(modal, { size: 'lg' });
  }

  submit(modal?: any): void {
    let field = this.selectedTrip ? 'updateTrip' : 'createTrip';
    this.isButtonDisabled = true;
    const changes = FormHelper.getChangedValues(
      this.form.value,
      this.initialValues
    );
    const args = this.selectedTrip
      ? [this.selectedTrip.id, changes]
      : [changes];
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

  deleteTrip(trip: TripType): void {
    Swal.fire({
      title: this.t('COMMON.CONFIRM.DELETE_TITLE'),
      text: this.t('COMMON.CONFIRM.DELETE_TEXT'),
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: this.t('COMMON.CONFIRM.DELETE_CONFIRM'),
      cancelButtonText: this.t('COMMON.BUTTON.CANCEL'),
    }).then((result) => {
      if (result.isConfirmed) {
        const sub = this.tripService.deleteTrip(trip.id).subscribe({
          next: () =>
            this.alert.success(this.t('TRIPS.MESSAGES.DELETE_SUCCESS')),
          error: () => this.alert.error(this.t('TRIPS.MESSAGES.DELETE_ERROR')),
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
}
