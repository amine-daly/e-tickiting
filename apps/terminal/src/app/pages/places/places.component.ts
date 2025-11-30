import { CommonModule } from '@angular/common';
import {
  ChangeDetectorRef,
  Component,
  OnDestroy,
  OnInit,
  TemplateRef,
} from '@angular/core';
import {
  FormBuilder,
  FormGroup,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { GoogleMapsModule } from '@angular/google-maps';
import { NgbModal } from '@ng-bootstrap/ng-bootstrap';
import { Subscription } from 'rxjs';

import { AlertService } from '../../core/services/alert.service';
import { FormHelper } from '../../core/helpers/form-helper';
import { PlaceType } from '../../modules/auth/models/place-type';
import { KeeniconComponent } from 'src/app/_metronic/shared/keenicon/keenicon.component';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import {
  PlaceCreatePayload,
  PlaceUpdatePayload,
  PlacesService,
} from './places.service';
import { isEqual } from 'lodash';
import Swal from 'sweetalert2';

@Component({
  selector: 'app-places',
  standalone: true,
  imports: [
    CommonModule,
    GoogleMapsModule,
    ReactiveFormsModule,
    TranslateModule,
  ],
  templateUrl: './places.component.html',
  styleUrls: ['./places.component.scss'],
})
export class PlacesComponent implements OnInit, OnDestroy {
  private formChangesSub?: Subscription;
  private subscriptions = new Subscription();
  private selectedPlace: PlaceType | null = null;
  private initialValues: PlaceCreatePayload | PlaceUpdatePayload | null = null;

  loading = true;
  form: FormGroup;
  editing = false;
  isButtonDisabled = true;
  error: string | null = null;
  places$ = this.placesService.places$;
  position: google.maps.LatLngLiteral | null = null;

  constructor(
    private placesService: PlacesService,
    private alert: AlertService,
    private modalService: NgbModal,
    private fb: FormBuilder,
    private cd: ChangeDetectorRef,
    private translate: TranslateService
  ) {}

  ngOnInit(): void {
    this.loadPlaces();
  }

  loadPlaces(): void {
    this.loading = true;
    this.error = null;
    const sub = this.placesService.getPlaces().subscribe({
      next: () => {
        this.loading = false;
        this.cd.detectChanges();
      },
      error: () => {
        this.error = this.t('PLACES.ERROR.LOAD');
        this.loading = false;
        this.cd.detectChanges();
      },
    });
    this.subscriptions.add(sub);
  }

  openPlaceModal(placeModal: TemplateRef<any>, place?: PlaceType): void {
    this.selectedPlace = place ?? null;
    this.editing = !!place;
    this.position = place?.location?.coordinates
      ? {
          lat: place.location.coordinates[1],
          lng: place.location.coordinates[0],
        }
      : null;

    this.form = this.buildForm(place);
    this.initialValues = this.form.value;
    this.isButtonDisabled = true;
    this.subscribeToFormChanges();
    this.modalService.open(placeModal, { size: 'lg' });
  }

  submit(modal?: any): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const initial = this.initialValues ?? this.form.value;
    const changes = FormHelper.getChangedValues(this.form.value, initial);

    const isEdit = !!this.selectedPlace?.id;
    const request$ = isEdit
      ? this.placesService.updatePlace(
          this.selectedPlace!.id!,
          changes as PlaceUpdatePayload
        )
      : this.placesService.createPlace(changes as PlaceCreatePayload);

    this.isButtonDisabled = true;

    const sub = request$.subscribe({
      next: () => {
        this.alert.success(
          this.t(
            isEdit
              ? 'PLACES.MESSAGES.UPDATE_SUCCESS'
              : 'PLACES.MESSAGES.CREATE_SUCCESS'
          )
        );
        modal?.close();
      },
      error: () => {
        this.alert.error(
          this.t(
            isEdit
              ? 'PLACES.MESSAGES.UPDATE_ERROR'
              : 'PLACES.MESSAGES.CREATE_ERROR'
          )
        );
        this.isButtonDisabled = false;
      },
    });
    this.subscriptions.add(sub);
  }

  deletePlace(place: PlaceType): void {
    if (!place.id) {
      return;
    }
    Swal.fire({
      title: this.t('COMMON.CONFIRM.DELETE_TITLE'),
      text: this.t('COMMON.CONFIRM.DELETE_TEXT'),
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: this.t('COMMON.CONFIRM.DELETE_CONFIRM'),
      cancelButtonText: this.t('COMMON.BUTTON.CANCEL'),
    }).then((result) => {
      if (result.isConfirmed) {
        const sub = this.placesService.deletePlace(place.id).subscribe({
          next: () =>
            this.alert.success(this.t('PLACES.MESSAGES.DELETE_SUCCESS')),
          error: () => this.alert.error(this.t('PLACES.MESSAGES.DELETE_ERROR')),
        });
        this.subscriptions.add(sub);
      }
    });
  }

  pickAddress(event: google.maps.MapMouseEvent): void {
    if (!event.latLng) {
      return;
    }
    const coords = event.latLng;
    this.position = { lat: coords.lat(), lng: coords.lng() };
    const control = this.form.get('location');
    control?.setValue({ coordinates: [coords.lng(), coords.lat()] });
    control?.markAsDirty();
    control?.markAsTouched();
  }

  isInvalid(controlName: string): boolean {
    const control = this.form.get(controlName);
    return !!control && control.invalid && (control.dirty || control.touched);
  }

  private subscribeToFormChanges(): void {
    this.formChangesSub?.unsubscribe();
    this.formChangesSub = this.form.valueChanges.subscribe((values) => {
      this.isButtonDisabled = isEqual(this.initialValues, values);
    });
  }

  private buildForm(place?: PlaceType): FormGroup {
    return this.fb.group({
      city: [place?.city || '', Validators.required],
      location: [place?.location || null, Validators.required],
    });
  }

  ngOnDestroy(): void {
    this.subscriptions.unsubscribe();
    this.formChangesSub?.unsubscribe();
  }

  private t(key: string, params?: Record<string, unknown>): string {
    return this.translate.instant(key, params);
  }
}
