import { Component, effect, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ToastService } from './toast.service';

@Component({
  selector: 'app-toasts',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div
      class="toast-container position-fixed top-0 end-0 p-3"
      style="z-index: 1080"
    >
      <div
        *ngFor="let t of svc.toasts()"
        class="toast show align-items-center text-bg-{{
          mapLevel(t.level)
        }} border-0 mb-2"
        role="alert"
        aria-live="assertive"
        aria-atomic="true"
      >
        <div class="d-flex">
          <div class="toast-body">{{ t.text }}</div>
          <button
            type="button"
            class="btn-close btn-close-white me-2 m-auto"
            (click)="svc.remove(t.id)"
            aria-label="Close"
          ></button>
        </div>
      </div>
    </div>
  `,
})
export class ToastsComponent {
  svc = inject(ToastService);
  mapLevel(level: 'success' | 'info' | 'warning' | 'danger') {
    return level;
  }
}
