import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { WidgetsModule } from '../../../_metronic/partials';

@Component({
  selector: 'app-lists',
  standalone: true,
  imports: [CommonModule, WidgetsModule],
  templateUrl: './lists.component.html',
})
export class ListsComponent {
  constructor() {}
}
