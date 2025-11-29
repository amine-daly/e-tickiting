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
  statusOptions: Array<{ value: TripStatus; label: string }> = [
    { value: TripStatus.SCHEDULED, label: 'Planifié' },
    { value: TripStatus.COMPLETED, label: 'Terminé' },
    { value: TripStatus.CANCELLED, label: 'Annulé' },
  ];
  statusLabelMap: Record<TripStatus, string> = {
    [TripStatus.SCHEDULED]: 'Planifié',
    [TripStatus.COMPLETED]: 'Terminé',
    [TripStatus.CANCELLED]: 'Annulé',
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
    private placesService: PlacesService
  ) {}

  ngOnInit(): void {
    this.loadTrips();
  }

  async changeStatus(trip: TripType, nextStatus: TripStatus): Promise<void> {
    if (!trip || trip.status === nextStatus) {
      return;
    }
    const result = await this.alert.confirm(
      'Confirmer le changement de statut',
      `Voulez-vous vraiment changer le statut du ticket à « ${
        this.statusLabelMap[nextStatus] || nextStatus
      } » ?`,
      'Oui, changer',
      'Annuler'
    );
    if (!result.isConfirmed) {
      return;
    }
    this.statusUpdating[trip.id] = true;

    const sub = this.tripService
      .updateTrip(trip.id, { status: nextStatus })
      .pipe(finalize(() => (this.statusUpdating[trip.id] = false)))
      .subscribe({
        next: () => this.alert.success('Statut mis à jour'),
        error: () => this.alert.error('Impossible de mettre à jour le statut'),
      });
    this.subscriptions.add(sub);
  }

  loadTrips(): void {
    const sub = this.tripService.getTrips(this.filter).subscribe({
      error: () =>
        this.alert.error(
          'Impossible de charger les voyages. Veuillez réessayer plus tard.'
        ),
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
        this.alert.success('Opération réussie');
        modal?.close();
        if (!this.selectedTrip) {
          this.tripService.generateSeats(res.id).subscribe();
        }
      },
      error: () => this.alert.error('Une erreur est survenue'),
    });
  }

  deleteTrip(trip: TripType): void {
    Swal.fire({
      title: 'Êtes-vous sûr ?',
      text: 'Cette action est irréversible !',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Oui, supprimer !',
      cancelButtonText: 'Annuler',
    }).then((result) => {
      if (result.isConfirmed) {
        const sub = this.tripService.deleteTrip(trip.id).subscribe({
          next: () => this.alert.success('Voyage supprimé avec succès'),
          error: () => this.alert.error('Échec de la suppression du voyage'),
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
}
