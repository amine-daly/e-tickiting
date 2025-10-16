import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormGroup, FormBuilder, Validators } from '@angular/forms';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { Subscription, Observable } from 'rxjs';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { AlertService } from '../../../../core/services/alert.service';
import { ConfirmPasswordValidator } from './confirm-password.validator';
import { first } from 'rxjs/operators';
import { UserType } from '../../models/user-type';

@Component({
  selector: 'app-registration',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule, RouterLink],
  templateUrl: './registration.component.html',
  styleUrls: ['./registration.component.scss'],
})
export class RegistrationComponent implements OnInit, OnDestroy {
  private unsubscribe: Subscription[] = [];
  hasError: boolean;
  registrationForm: FormGroup;
  isLoading$: Observable<boolean>;

  get f() {
    return this.registrationForm.controls;
  }

  constructor(
    private fb: FormBuilder,
    private authService: AuthService,
    private router: Router,
    private alert: AlertService
  ) {
    this.isLoading$ = this.authService.isLoading$;
    // redirect to home if already logged in
    if (this.authService.currentUserValue) {
      this.router.navigate(['/']);
    }
  }

  ngOnInit(): void {
    this.registrationForm = this.fb.group(
      {
        firstName: [
          '',
          Validators.compose([
            Validators.required,
            Validators.minLength(2),
            Validators.maxLength(100),
          ]),
        ],
        lastName: [
          '',
          Validators.compose([
            Validators.required,
            Validators.minLength(2),
            Validators.maxLength(100),
          ]),
        ],
        email: [
          '',
          Validators.compose([
            Validators.required,
            Validators.email,
            Validators.minLength(3),
            Validators.maxLength(320),
          ]),
        ],
        password: [
          '',
          Validators.compose([
            Validators.required,
            Validators.minLength(3),
            Validators.maxLength(100),
          ]),
        ],
        cPassword: [
          '',
          Validators.compose([
            Validators.required,
            Validators.minLength(3),
            Validators.maxLength(100),
          ]),
        ],
      },
      {
        validator: ConfirmPasswordValidator.MatchPassword,
      }
    );
    this.registrationForm.valueChanges.subscribe(() => {
      console.log(
        '🚀 ~ RegistrationComponent ~ ngOnInit ~ this.registrationForm:',
        this.registrationForm
      );
    });
  }

  submit() {
    this.hasError = false;
    if (this.registrationForm.invalid) {
      return;
    }
    const payload: any = {
      firstName: this.f['firstName'].value,
      lastName: this.f['lastName'].value,
      email: this.f['email'].value,
      password: this.f['password'].value,
      role: 'CUSTOMER',
    };
    const sub = this.authService
      .registration(payload)
      .pipe(first())
      .subscribe({
        next: (res: any) => {
          if (res) {
            this.alert.success('Account created', 'Welcome aboard!');
            this.router.navigate(['/']);
          } else {
            this.hasError = true;
            this.alert.error(
              'Registration failed',
              'Please verify your details and try again.'
            );
          }
        },
        error: (err) => {
          this.hasError = true;
          const msg =
            err?.error?.message ||
            err?.message ||
            'Please verify your details and try again.';
          this.alert.error('Registration failed', msg);
        },
      });
    this.unsubscribe.push(sub);
  }

  ngOnDestroy() {
    this.unsubscribe.forEach((sb) => sb.unsubscribe());
  }
}
