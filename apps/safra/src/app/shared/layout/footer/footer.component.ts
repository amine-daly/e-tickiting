import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { CommonModule } from '@angular/common';

import { LOGO_BASE } from '../../../environments/environment';

@Component({
  standalone: true,
  imports: [CommonModule, RouterLink],
  selector: 'app-footer',
  templateUrl: './footer.component.html',
  styleUrls: ['./footer.component.scss'],
})
export class FooterComponent {
  logoBase = LOGO_BASE;
}
