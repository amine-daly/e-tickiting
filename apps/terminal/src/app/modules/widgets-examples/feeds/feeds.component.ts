import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { WidgetsModule } from '../../../_metronic/partials';

@Component({
  selector: 'app-feeds',
  standalone: true,
  imports: [CommonModule, WidgetsModule],
  templateUrl: './feeds.component.html',
})
export class FeedsComponent implements OnInit {
  constructor() {}

  ngOnInit(): void {}
}
