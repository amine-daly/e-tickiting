import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';

import { CompanyDetailsFormComponent } from 'src/app/shared/components/company-details-form/company-details-form.component';
import { CompanyService } from '../company.service';

@Component({
  standalone: true,
  imports: [CommonModule, CompanyDetailsFormComponent],
  selector: 'app-company-details',
  templateUrl: './company-details.component.html',
})
export class CompanyDetailsComponent implements OnInit {
  company$ = this.companyService.company$;

  constructor(
    private route: ActivatedRoute,
    private companyService: CompanyService,
  ) {}

  ngOnInit(): void {
    if (!this.route.snapshot.paramMap.get('companyId')) {
      this.companyService.clearCompany();
    }
  }
}
