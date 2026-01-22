import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { KeeniconComponent } from 'src/app/_metronic/shared/keenicon/keenicon.component';
import { WidgetsModule } from 'src/app/_metronic/partials';
import { CustomersService } from '../../customers.service';

@Component({
  selector: 'app-overview',
  standalone: true,
  imports: [CommonModule, RouterModule, WidgetsModule, KeeniconComponent],
  templateUrl: './overview.component.html',
})
export class OverviewComponent implements OnInit {
  user$ = this.customersService.user$;

  constructor(private customersService: CustomersService) {}

  ngOnInit(): void {}
}
