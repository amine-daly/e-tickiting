import { Injectable, signal } from '@angular/core';

export type ToastLevel = 'success' | 'info' | 'warning' | 'danger';

export interface Toast {
  id: number;
  text: string;
  level: ToastLevel;
  delay?: number; // ms
}

@Injectable({ providedIn: 'root' })
export class ToastService {
  private seq = 0;
  toasts = signal<Toast[]>([]);

  show(text: string, level: ToastLevel = 'info', delay = 3000) {
    const id = ++this.seq;
    const toast: Toast = { id, text, level, delay };
    this.toasts.update((list) => [...list, toast]);
    if (delay && delay > 0) {
      setTimeout(() => this.remove(id), delay);
    }
  }

  success(text: string, delay = 3000) {
    this.show(text, 'success', delay);
  }
  info(text: string, delay = 3000) {
    this.show(text, 'info', delay);
  }
  warning(text: string, delay = 3000) {
    this.show(text, 'warning', delay);
  }
  error(text: string, delay = 4000) {
    this.show(text, 'danger', delay);
  }

  remove(id: number) {
    this.toasts.update((list) => list.filter((t) => t.id !== id));
  }

  clear() {
    this.toasts.set([]);
  }
}
