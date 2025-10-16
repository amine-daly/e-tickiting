import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { WidgetsModule } from '../../../_metronic/partials';
import { KeeniconComponent } from 'src/app/_metronic/shared/keenicon/keenicon.component';

@Component({
  selector: 'app-overview',
  standalone: true,
  imports: [CommonModule, RouterModule, WidgetsModule, KeeniconComponent],
  templateUrl: './overview.component.html',
})
export class OverviewComponent implements OnInit {
  constructor() {}

  ngOnInit(): void {}
}
