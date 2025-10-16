import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { WidgetsModule } from '../../../_metronic/partials';

@Component({
  selector: 'app-charts',
  standalone: true,
  imports: [CommonModule, WidgetsModule],
  templateUrl: './charts.component.html',
})
export class ChartsComponent {
  constructor() {}
}
