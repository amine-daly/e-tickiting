import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterOutlet } from '@angular/router';
import { AuthService } from './core/services/auth.service';
import { ToastPopupComponent } from './shared/components/toast/toast-container.component';
import { ToasterService } from './shared/components/toast/toaster.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, RouterOutlet, ToastPopupComponent],
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss',
})
export class AppComponent {
  title = 'frontend';
  isNavCollapsed = true;

  constructor(
    private toastService: ToasterService,
    private router: Router,
    private authService: AuthService
  ) {}

  shouldShowHero(): boolean {
    // Show hero section only on landing page
    return this.router.url === '/';
  }

  logout(): void {
    this.authService.logout();
    this.toastService.success('Logged out successfully');
    this.router.navigate(['/']);
  }
}
