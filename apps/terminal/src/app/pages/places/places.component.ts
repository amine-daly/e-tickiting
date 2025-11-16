import {
  ChangeDetectorRef,
  Component,
  OnInit,
  computed,
  signal,
  WritableSignal,
} from '@angular/core';
import { NgbModal } from '@ng-bootstrap/ng-bootstrap';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { GoogleMapsModule } from '@angular/google-maps';
import { PlacesService } from './places.service';
import { AlertService } from '../../core/services/alert.service';
import { PlaceType } from '../../modules/auth/models/place-type';
import { KeeniconComponent } from 'src/app/_metronic/shared/keenicon/keenicon.component';

@Component({
  selector: 'app-places',
  standalone: true,
  imports: [CommonModule, FormsModule, GoogleMapsModule, KeeniconComponent],
  templateUrl: './places.component.html',
  styleUrls: ['./places.component.scss'],
})
export class PlacesComponent implements OnInit {
  loading = true;
  error: string | null = null;

  places$ = this.placesService.places$;

  constructor(
    private placesService: PlacesService,
    private alert: AlertService,
    private modalService: NgbModal,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.loading = true;
    this.error = null;
    this.placesService.getPlaces().subscribe({
      next: () => {
        this.loading = false;
        this.cdr.detectChanges();
      },
      error: (err) => {
        this.error = 'Failed to load places';
        this.loading = false;
        this.cdr.detectChanges();
      },
    });
  }

  // No global map on page, only in modal

  form: any = { city: '', location: null };
  editing = false;
  position: any = null;

  openCreate(placeModal: any) {
    this.form = { city: '', location: null };
    this.editing = false;
    this.position = null;
    this.modalService.open(placeModal, { size: 'lg' });
  }

  pickAddress(event: any) {
    const coords = event.latLng;
    this.position = { lat: coords.lat(), lng: coords.lng() };
    this.form.location = { coordinates: [coords.lng(), coords.lat()] };
  }

  submit(modal?: any) {
    if (!this.form.city || !this.form.location) return;
    this.placesService.create(this.form).subscribe({
      next: () => {
        this.alert.success('Place created');
        this.modalService.dismissAll();
      },
      error: () => this.alert.error('Failed to create place'),
    });
  }

  deletePlace(place: PlaceType) {
    if (!place.id) return;
    this.placesService.delete(place.id).subscribe({
      next: () => {
        this.alert.success('Place deleted');
      },
      error: () => this.alert.error('Failed to delete place'),
    });
  }

  openEdit(placeModal: any, place: any) {
    this.form = {
      city: place.city,
      location: { ...place.location },
      id: place.id,
    };
    this.editing = true;
    this.position = {
      lat: place.location.coordinates[1],
      lng: place.location.coordinates[0],
    };
    // Open modal using template ref
    const modalRef = this.modalService.open(placeModal, {
      size: 'lg',
    });
    modalRef.result
      .then((result: any) => {
        if (result && place.id) {
          this.placesService.update(place.id, result).subscribe({
            next: () => {
              this.alert.success('Place updated');
            },
            error: () => this.alert.error('Failed to update place'),
          });
        }
      })
      .catch(() => {});
  }
}
