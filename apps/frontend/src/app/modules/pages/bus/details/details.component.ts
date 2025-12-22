import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-bus-details',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './details.component.html',
  styleUrls: ['./details.component.scss'],
})
export class BusDetailsComponent {
  // Static showcase only for now – real bindings will be reintroduced later.
}
