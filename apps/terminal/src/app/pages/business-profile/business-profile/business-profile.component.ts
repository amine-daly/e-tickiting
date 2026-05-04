import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';

import { AuthService } from 'src/app/modules/auth';
import { CompanyDetailsFormComponent } from 'src/app/shared/components/company-details-form/company-details-form.component';

@Component({
  selector: 'app-business-profile',
  standalone: true,
  imports: [CommonModule, CompanyDetailsFormComponent],
  templateUrl: './business-profile.component.html',
  styleUrls: ['./business-profile.component.scss'],
})
export class BusinessProfileComponent {
  company$ = this.authService.company$;

  constructor(private authService: AuthService) {}
}
