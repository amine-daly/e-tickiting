import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-tiles-widget3',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './tiles-widget3.component.html',
})
export class TilesWidget3Component {
  @Input() cssClass = '';
  @Input() widgetHeight = '130px';

  constructor() {}
}
