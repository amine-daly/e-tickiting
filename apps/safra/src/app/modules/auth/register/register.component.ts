import { omit } from 'lodash';
import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, inject } from '@angular/core';
import {
  FormGroup,
  Validators,
  FormBuilder,
  AbstractControl,
  ReactiveFormsModule,
} from '@angular/forms';
import { RouterLink, Router } from '@angular/router';

import { RoleEnum } from '../../../core/models/user-type';
import { LOGO_BASE } from '../../../environments/environment';
import { FormHelper } from '../../../core/helpers/form-helper';
import { AuthService } from '../../../core/services/auth.service';
import { ToasterService } from '../../../shared/components/toast/toaster.service';

@Component({
  selector: 'app-register',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink],
  templateUrl: './register.component.html',
  styleUrl: './register.component.scss',
})
export class RegisterComponent {
  registerForm: FormGroup;
  loading = false;
  showPassword = false;
  usePhone = false;
  initialValues: any;
  logoBase = LOGO_BASE;
  constructor(
    private router: Router,
    private cdr: ChangeDetectorRef,
    private formBuilder: FormBuilder,
    private authService: AuthService,
    private toastService: ToasterService,
  ) {
    this.registerForm = this.formBuilder.group(
      {
        firstName: ['', Validators.required],
        lastName: ['', Validators.required],
        email: ['', Validators.email],
        phone: this.formBuilder.group({
          countryCode: ['216'],
          number: [''],
        }),
        role: [RoleEnum.CUSTOMER],
        countryCode: ['216'],
        password: ['', [Validators.required]],
        confirmPassword: ['', Validators.required],
      },
      { validators: this.passwordMatchValidator },
    );
    this.initialValues = this.registerForm.value;
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
      delete confirmPassword.errors?.['passwordMismatch'];
      if (!Object.keys(confirmPassword.errors || {}).length) {
        confirmPassword.setErrors(null);
      }
    }

    return null;
  }

  togglePasswordVisibility(): void {
    this.showPassword = !this.showPassword;
  }

  setEmailMode(): void {
    this.usePhone = false;
  }

  setPhoneMode(): void {
    this.usePhone = true;
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

  getPasswordStrengthText(): string {
    const strength = this.getPasswordStrength();
    if (strength < 50) return 'Weak';
    if (strength < 75) return 'Medium';
    return 'Strong';
  }

  getPasswordStrengthColor(): string {
    const strength = this.getPasswordStrength();
    if (strength < 50) return '#f97316';
    if (strength < 75) return '#facc15';
    return '#22c55e';
  }

  onSubmit(): void {
    this.loading = true;
    const formValue = this.registerForm.value;
    const payload: any = FormHelper.getChangedValues(
      omit(formValue, 'confirmPassword'),
      omit(this.initialValues, 'confirmPassword', 'role'),
    );
    this.authService.register(payload).subscribe({
      next: () => {
        this.loading = false;
        this.toastService.success('Account created!');
        this.router.navigate(['/']);
      },
      error: (err) => {
        this.loading = false;
        this.toastService.error(err?.error?.message || 'Registration failed.');
        this.cdr.detectChanges();
      },
    });
  }
}
