import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class ToasterService {
  private counter = 0;
  private duration = 4000;
  private readonly toastsSubject = new BehaviorSubject<ToastMessage[]>([]);
  readonly toasts$ = this.toastsSubject.asObservable();

  success(message: string, title?: string, icon?: string, duration?: number) {
    this.show('success', message, title, icon, duration ?? this.duration);
  }

  error(message: string, title?: string, icon?: string, duration?: number) {
    this.show('error', message, title, icon, duration ?? this.duration);
  }

  info(message: string, title?: string, icon?: string, duration?: number) {
    this.show('info', message, title, icon, duration ?? this.duration);
  }

  private show(
    type: ToastType,
    message: string,
    title?: string,
    icon?: string,
    duration?: number
  ) {
    const id = ++this.counter;
    const toast: ToastMessage = { id, type, message, title, icon };
    const list = this.toastsSubject.value;
    this.toastsSubject.next([...list, toast]);
    setTimeout(() => this.dismiss(id), duration);
  }

  dismiss(id: number) {
    const list = this.toastsSubject.value.filter((t) => t.id !== id);
    this.toastsSubject.next(list);
  }
}

export type ToastType = 'success' | 'error' | 'info';
export interface ToastMessage {
  id: number;
  type: ToastType;
  message: string;
  title?: string;
  icon?: string;
  duration?: number;
}
