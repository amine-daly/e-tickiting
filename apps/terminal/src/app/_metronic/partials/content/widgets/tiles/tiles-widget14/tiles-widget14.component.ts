import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { KeeniconComponent } from 'src/app/_metronic/shared/keenicon/keenicon.component';

@Component({
  selector: 'app-tiles-widget14',
  standalone: true,
  imports: [CommonModule, KeeniconComponent],
  templateUrl: './tiles-widget14.component.html',
})
export class TilesWidget14Component {
  @Input() cssClass = '';
  constructor() {}
}
