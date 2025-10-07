import { Component, inject } from '@angular/core';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { AuthService } from '../../core/services/auth.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  template: `
    <div class="row justify-content-center">
      <div class="col-12 col-md-6 col-lg-5">
        <h2 class="mb-4">Login</h2>
        <div *ngIf="error" class="alert alert-danger">{{ error }}</div>
        <form [formGroup]="form" (ngSubmit)="onSubmit()" novalidate>
          <div class="mb-3">
            <label class="form-label">Email</label>
            <input
              type="email"
              class="form-control"
              formControlName="email"
              placeholder="you@example.com"
            />
          </div>
          <div class="text-center text-muted my-2">or</div>
          <div class="row g-2 align-items-end">
            <div class="col-4">
              <label class="form-label">Country code</label>
              <input
                type="text"
                class="form-control"
                formControlName="countryCode"
                placeholder="+1"
              />
            </div>
            <div class="col-8">
              <label class="form-label">Phone number</label>
              <input
                type="tel"
                class="form-control"
                formControlName="phoneNumber"
                placeholder="555123456"
              />
            </div>
          </div>
          <div class="form-text" [class.text-danger]="xorInvalid">
            Provide either email or phone, not both.
          </div>

          <div class="mb-3 mt-3">
            <label class="form-label">Password</label>
            <input
              type="password"
              class="form-control"
              formControlName="password"
              required
            />
          </div>

          <button
            class="btn btn-primary w-100"
            [disabled]="submitting || xorInvalid || form.invalid"
          >
            {{ submitting ? 'Signing in…' : 'Login' }}
          </button>
        </form>
      </div>
    </div>
  `,
})
export class LoginComponent {
  private router = inject(Router);
  private fb = inject(FormBuilder);
  private auth = inject(AuthService);

  error: string | null = null;
  submitting = false;

  form = this.fb.group({
    email: [''],
    countryCode: [''],
    phoneNumber: [''],
    password: ['', Validators.required],
  });

  get xorInvalid() {
    const email = this.form.value.email?.trim();
    const cc = this.form.value.countryCode?.trim();
    const pn = this.form.value.phoneNumber?.trim();
    const hasEmail = !!email;
    const hasPhone = !!cc && !!pn;
    return !(hasEmail !== hasPhone); // invalid if both or none
  }

  onSubmit() {
    this.error = null;
    if (this.form.invalid || this.xorInvalid) return;
    this.submitting = true;
    const { email, countryCode, phoneNumber, password } =
      this.form.getRawValue();
    const payload: any = { password };
    if (email) payload.email = email;
    else payload.phone = { countryCode, number: phoneNumber };
    this.auth.login(payload).subscribe({
      next: () => {
        this.submitting = false;
        this.router.navigateByUrl('/');
      },
      error: (e) => {
        this.submitting = false;
        this.error = e?.error?.message || 'Login failed';
      },
    });
  }
}
