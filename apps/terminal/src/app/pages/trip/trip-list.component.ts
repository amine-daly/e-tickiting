import { Component, OnInit, TemplateRef } from '@angular/core';
import { NgbModal } from '@ng-bootstrap/ng-bootstrap';
import { Trip } from '../../core/models/trip.model';
import { TripService } from './trip.service';
import { CommonModule } from '@angular/common';

@Component({
  standalone: true,
  imports: [CommonModule],
  selector: 'app-trip-list',
  templateUrl: './trip-list.component.html',
  styleUrls: ['./trip-list.component.scss'],
})
export class TripListComponent implements OnInit {
  editing = false;
  form: any = {};
  filter: any = {};
  trips$ = this.tripService.trips$;
  loading$ = this.tripService.loading$;

  constructor(
    private tripService: TripService,
    private modalService: NgbModal
  ) {}

  ngOnInit() {
    this.loadTrips();
  }

  loadTrips() {
    this.tripService.getTrips(this.filter).subscribe();
  }

  applyFilters(filter: any) {
    this.filter = filter;
    this.loadTrips();
  }

  openCreate(modal: TemplateRef<any>) {
    this.editing = false;
    this.form = {};
    this.modalService.open(modal, { size: 'lg' });
  }

  openEdit(modal: TemplateRef<any>, trip: Trip) {
    this.editing = true;
    this.form = { ...trip };
    this.modalService.open(modal, { size: 'lg' });
  }

  submit(modal: any) {
    if (this.editing) {
      this.tripService.updateTrip(this.form).subscribe();
    } else {
      this.tripService.createTrip(this.form).subscribe();
    }
  }

  deleteTrip(trip: Trip) {
    if (!confirm('Are you sure you want to delete this trip?')) return;
    this.tripService.deleteTrip(trip.id).subscribe();
  }
}
