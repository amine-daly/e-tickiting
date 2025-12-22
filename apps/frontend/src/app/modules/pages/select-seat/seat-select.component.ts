import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-seat-select',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './seat-select.component.html',
  styleUrls: ['./seat-select.component.scss'],
})
export class SeatSelectComponent {
  // Static showcase only for now – real bindings will be reintroduced later.
}
