import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  ReactiveFormsModule,
  FormBuilder,
  FormGroup,
  Validators,
} from '@angular/forms';
import { FormsModule } from '@angular/forms';
import { RouterLink, Router } from '@angular/router';
import { finalize } from 'rxjs';

import { AuthService } from '../../core/services/auth.service';
import { ToastService } from '../../core/ui/toast.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, FormsModule, RouterLink],
  templateUrl: './login.component.html',
  styleUrl: './login.component.scss',
})
export class LoginComponent {
  loginForm: FormGroup;
  loading = false;
  showPassword = false;
  usePhone = false;

  private fb = inject(FormBuilder);
  private authService = inject(AuthService);
  private router = inject(Router);
  private toastService = inject(ToastService);

  constructor() {
    this.loginForm = this.fb.group({
      email: ['', [Validators.email]],
      countryCode: ['216'],
      phoneNumber: [''],
      password: ['', Validators.required],
      rememberMe: [false],
    });

    this.updateValidators();
  }

  updateValidators(): void {
    const emailControl = this.loginForm.get('email');
    const phoneControl = this.loginForm.get('phoneNumber');

    if (this.usePhone) {
      emailControl?.clearValidators();
      emailControl?.setValue('');
      phoneControl?.setValidators([
        Validators.required,
        Validators.pattern(/^\d{8}$/),
      ]);
    } else {
      emailControl?.setValidators([Validators.required, Validators.email]);
      phoneControl?.clearValidators();
      phoneControl?.setValue('');
    }

    emailControl?.updateValueAndValidity();
    phoneControl?.updateValueAndValidity();
  }

  togglePasswordVisibility(): void {
    this.showPassword = !this.showPassword;
  }

  toggleContactMethod(): void {
    this.usePhone = !this.usePhone;
    this.updateValidators();
  }

  setEmailMode(): void {
    this.usePhone = false;
    this.updateValidators();
  }

  setPhoneMode(): void {
    this.usePhone = true;
    this.updateValidators();
  }

  onSubmit(): void {
    this.updateValidators();

    if (this.loginForm.valid) {
      this.loading = true;
      const formValue = this.loginForm.value;

      const loginData = {
        email: this.usePhone ? undefined : formValue.email,
        phone: this.usePhone
          ? {
              countryCode: formValue.countryCode,
              number: formValue.phoneNumber,
            }
          : undefined,
        password: formValue.password,
      };

      this.authService
        .login(loginData)
        .pipe(finalize(() => (this.loading = false)))
        .subscribe({
          next: () => {
            this.toastService.success('Welcome back!');
            this.router.navigate(['/']);
          },
          error: (error) => {
            this.toastService.error(
              error.message || 'Login failed. Please try again.'
            );
          },
        });
    } else {
      Object.keys(this.loginForm.controls).forEach((key) => {
        this.loginForm.get(key)?.markAsTouched();
      });
    }
  }
}
