import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  ReactiveFormsModule,
  FormBuilder,
  FormGroup,
  Validators,
  AbstractControl,
} from '@angular/forms';
import { FormsModule } from '@angular/forms';
import { RouterLink, Router } from '@angular/router';
import { finalize } from 'rxjs';

import { AuthService } from '../../core/services/auth.service';
import { ToastService } from '../../core/ui/toast.service';

@Component({
  selector: 'app-register',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, FormsModule, RouterLink],
  templateUrl: './register.component.html',
  styleUrl: './register.component.scss',
})
export class RegisterComponent {
  registerForm: FormGroup;
  loading = false;
  showPassword = false;
  usePhone = false;

  private fb = inject(FormBuilder);
  private authService = inject(AuthService);
  private router = inject(Router);
  private toastService = inject(ToastService);

  constructor() {
    this.registerForm = this.fb.group(
      {
        email: ['', [Validators.email]],
        countryCode: ['+1'],
        phoneNumber: [''],
        password: ['', [Validators.required, Validators.minLength(8)]],
        confirmPassword: ['', Validators.required],
        acceptTerms: [false, Validators.requiredTrue],
      },
      { validators: this.passwordMatchValidator }
    );

    this.updateValidators();
  }

  updateValidators(): void {
    const emailControl = this.registerForm.get('email');
    const phoneControl = this.registerForm.get('phoneNumber');

    if (this.usePhone) {
      emailControl?.clearValidators();
      phoneControl?.setValidators([
        Validators.required,
        Validators.pattern(/^\d{9,15}$/),
      ]);
    } else {
      emailControl?.setValidators([Validators.required, Validators.email]);
      phoneControl?.clearValidators();
    }

    emailControl?.updateValueAndValidity();
    phoneControl?.updateValueAndValidity();
  }

  passwordMatchValidator(form: AbstractControl) {
    const password = form.get('password');
    const confirmPassword = form.get('confirmPassword');

    if (
      password &&
      confirmPassword &&
      password.value !== confirmPassword.value
    ) {
      confirmPassword.setErrors({ passwordMismatch: true });
      return { passwordMismatch: true };
    }

    if (confirmPassword?.hasError('passwordMismatch')) {
      delete confirmPassword.errors!['passwordMismatch'];
      if (Object.keys(confirmPassword.errors!).length === 0) {
        confirmPassword.setErrors(null);
      }
    }

    return null;
  }

  togglePasswordVisibility(): void {
    this.showPassword = !this.showPassword;
  }

  toggleContactMethod(): void {
    this.usePhone = !this.usePhone;
    this.updateValidators();
  }

  getPasswordStrength(): number {
    const password = this.registerForm.get('password')?.value || '';
    let strength = 0;

    if (password.length >= 8) strength += 25;
    if (/[a-z]/.test(password)) strength += 25;
    if (/[A-Z]/.test(password)) strength += 25;
    if (/\d/.test(password)) strength += 25;
    if (/[^\w\s]/.test(password)) strength += 25;

    return Math.min(100, strength);
  }

  getPasswordStrengthClass(): string {
    const strength = this.getPasswordStrength();
    if (strength < 50) return 'bg-danger';
    if (strength < 75) return 'bg-warning';
    return 'bg-success';
  }

  getPasswordStrengthText(): string {
    const strength = this.getPasswordStrength();
    if (strength < 50) return 'Weak';
    if (strength < 75) return 'Medium';
    return 'Strong';
  }

  onSubmit(): void {
    this.updateValidators();

    if (this.registerForm.valid) {
      this.loading = true;
      const formValue = this.registerForm.value;

      const registerData = {
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
        .register(registerData)
        .pipe(finalize(() => (this.loading = false)))
        .subscribe({
          next: () => {
            this.toastService.success(
              'Account created successfully! Please sign in.'
            );
            this.router.navigate(['/login']);
          },
          error: (error) => {
            this.toastService.error(
              error.message || 'Registration failed. Please try again.'
            );
          },
        });
    } else {
      Object.keys(this.registerForm.controls).forEach((key) => {
        this.registerForm.get(key)?.markAsTouched();
      });
    }
  }
}
