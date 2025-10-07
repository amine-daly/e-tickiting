import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  RouterLink,
  RouterLinkActive,
  RouterOutlet,
  Router,
} from '@angular/router';
import { NgbCollapse } from '@ng-bootstrap/ng-bootstrap';
import { ToastsComponent } from './core/ui/toasts.component';
import { AuthService } from './core/services/auth.service';
import { ToastService } from './core/ui/toast.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [
    CommonModule,
    RouterOutlet,
    RouterLink,
    RouterLinkActive,
    NgbCollapse,
    ToastsComponent,
  ],
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss',
})
export class AppComponent {
  title = 'frontend';
  isNavCollapsed = true;

  authService = inject(AuthService);
  private router = inject(Router);
  private toastService = inject(ToastService);

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
