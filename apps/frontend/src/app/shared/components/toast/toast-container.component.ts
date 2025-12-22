import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';

import { ToasterService } from './toaster.service';

@Component({
  standalone: true,
  selector: 'toast-popup',
  imports: [CommonModule],
  template: `
    <div class="toast-container">
      <div
        class="lc-toast"
        *ngFor="let t of toasts$ | async"
        [class.success]="t.type === 'success'"
        [class.error]="t.type === 'error'"
        [class.info]="t.type === 'info'"
      >
        <span class="toast-icon">{{ t.icon || getIcon(t.type) }}</span>
        <div class="toast-content">
          <span class="toast-title" *ngIf="t.title">{{ t.title }}</span>
          <span class="toast-message">{{ t.message }}</span>
        </div>
        <button class="toast-close" (click)="dismiss(t.id)">×</button>
      </div>
    </div>
  `,
  styles: [
    `
      .toast-container {
        position: fixed;
        top: 24px;
        left: 50%;
        transform: translateX(-50%);
        z-index: 10000;
        display: flex;
        flex-direction: column;
        gap: 16px;
        pointer-events: none;
        width: min(92vw, 400px);
      }
      .lc-toast {
        pointer-events: auto;
        display: flex;
        align-items: center;
        gap: 14px;
        border-radius: 12px;
        padding: 16px 20px;
        color: #fff;
        box-shadow: 0 8px 32px rgba(0, 0, 0, 0.12),
          0 2px 8px rgba(0, 0, 0, 0.08);
        background: #ef4444;
        font-size: 24px;
        line-height: 1.5;
        font-weight: 500;
        animation: slideDown 350ms cubic-bezier(0.16, 1, 0.3, 1) forwards;
        opacity: 1;
        visibility: visible;
        min-height: 56px;
      }
      .lc-toast.success {
        background: #10b981;
      }
      .lc-toast.error {
        background: #ef4444;
      }
      .lc-toast.info {
        background: #3b82f6;
      }
      .lc-toast-icon {
        font-size: 22px;
        flex-shrink: 0;
        line-height: 1;
        display: flex;
        align-items: center;
        justify-content: center;
        width: 28px;
        height: 28px;
      }
      .toast-content {
        flex: 1;
        display: flex;
        flex-direction: column;
        gap: 4px;
      }
      .toast-title {
        display: block;
        font-weight: 600;
        font-size: 15px;
        letter-spacing: 0.2px;
        line-height: 1.3;
      }
      .toast-message {
        display: block;
        font-weight: 400;
        letter-spacing: 0.2px;
        font-size: 14px;
        opacity: 0.95;
      }
      .toast-close {
        flex-shrink: 0;
        background: rgba(255, 255, 255, 0.15);
        border: none;
        color: #fff;
        font-size: 20px;
        line-height: 1;
        cursor: pointer;
        padding: 0;
        width: 28px;
        height: 28px;
        display: flex;
        align-items: center;
        justify-content: center;
        border-radius: 6px;
        transition: all 0.2s ease;
        font-weight: 300;
      }
      .toast-close:hover {
        background: rgba(255, 255, 255, 0.25);
      }
      .toast-close:active {
        transform: scale(0.95);
      }

      @keyframes slideDown {
        from {
          transform: translateY(-100%);
          opacity: 0;
        }
        to {
          transform: translateY(0);
          opacity: 1;
        }
      }
    `,
  ],
})
export class ToastPopupComponent {
  toasts$ = this.toaster.toasts$;

  constructor(private toaster: ToasterService) {}

  getIcon(type: string): string {
    switch (type) {
      case 'success':
        return '✅';
      case 'error':
        return '⚠️';
      case 'info':
        return 'ℹ️';
      default:
        return 'ℹ️';
    }
  }

  dismiss(id: number): void {
    this.toaster.dismiss(id);
  }
}
