import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink } from '@angular/router';

import { LOGO_DARK } from '../../../environments/environment';
import { AuthService } from '../../../core/services/auth.service';

@Component({
  standalone: true,
  imports: [CommonModule, RouterLink],
  selector: 'app-header',
  templateUrl: './header.component.html',
  styleUrls: ['./header.component.scss'],
})
export class HeaderComponent {
  title = 'frontend';
  isNavCollapsed = true;
  logodark = LOGO_DARK;

  authenticated$ = this.authService.authenticated$;

  constructor(
    private authService: AuthService,
    private router: Router,
  ) {}

  shouldShowHero(): boolean {
    // Show hero section only on landing page
    return this.router.url === '/';
  }

  logout(): void {
    this.authService.logout();
    this.router.navigate(['/auth/login']);
  }
}
