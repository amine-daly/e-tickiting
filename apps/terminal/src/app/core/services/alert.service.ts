import { Injectable } from '@angular/core';
import Swal, { SweetAlertIcon, SweetAlertOptions } from 'sweetalert2';

@Injectable({ providedIn: 'root' })
export class AlertService {
  fire(options: SweetAlertOptions) {
    return Swal.fire(options);
  }

  success(title: string, text?: string, timer = 1500) {
    return Swal.fire({
      icon: 'success',
      title,
      text,
      timer,
      showConfirmButton: false,
    });
  }

  error(title: string, text?: string) {
    return Swal.fire({ icon: 'error', title, text });
  }

  warning(title: string, text?: string) {
    return Swal.fire({ icon: 'warning', title, text });
  }

  info(title: string, text?: string) {
    return Swal.fire({ icon: 'info', title, text });
  }

  confirm(
    title: string,
    text?: string,
    confirmButtonText = 'Yes',
    cancelButtonText = 'Cancel'
  ) {
    return Swal.fire({
      title,
      text,
      icon: 'question',
      showCancelButton: true,
      confirmButtonText,
      cancelButtonText,
    });
  }
}
