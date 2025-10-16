import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-tiles-widget10',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './tiles-widget10.component.html',
})
export class TilesWidget10Component {
  @Input() cssClass = '';
  @Input() widgetHeight = '130px';

  constructor() {}
}
