import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-tiles-widget13',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './tiles-widget13.component.html',
})
export class TilesWidget13Component {
  @Input() cssClass = '';
  @Input() widgetHeight = '225px';

  constructor() {}
}
