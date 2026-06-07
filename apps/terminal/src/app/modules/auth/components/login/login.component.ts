import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { ReactiveFormsModule, FormsModule } from '@angular/forms';
import { Subscription, Observable } from 'rxjs';
import { first } from 'rxjs/operators';
import { AuthService } from '../../services/auth.service';
import { AlertService } from '../../../../core/services/alert.service';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { resolveUserErrorMessage } from 'src/app/core/helpers/user-error-message.helper';
@Component({
  selector: 'app-login',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    RouterLink,
  ],
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.scss'],
})
export class LoginComponent implements OnInit, OnDestroy {
  loginForm: FormGroup;
  hasError: boolean;
  returnUrl: string;
  isLoading$: Observable<boolean> = this.authService.isLoading$;

  // private fields
  private unsubscribe: Subscription[] = []; // Read more: => https://brianflove.com/2016/12/11/anguar-2-unsubscribe-observables/

  constructor(
    private fb: FormBuilder,
    private authService: AuthService,
    private route: ActivatedRoute,
    private router: Router,
    private alert: AlertService,
  ) {
    // redirect to home if already logged in
    if (this.authService.currentUser$) {
      this.router.navigate(['/']);
    }
  }

  ngOnInit(): void {
    this.initForm();
    // get return url from route parameters or default to '/'
    this.returnUrl =
      this.route.snapshot.queryParams['returnUrl'.toString()] || '/';
  }

  // convenience getter for easy access to form fields
  get f() {
    return this.loginForm.controls;
  }

  initForm() {
    this.loginForm = this.fb.group({
      email: [
        '',
        Validators.compose([
          Validators.required,
          Validators.email,
          Validators.minLength(3),
          Validators.maxLength(320), // https://stackoverflow.com/questions/386294/what-is-the-maximum-length-of-a-valid-email-address
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
    });
    this.loginForm.valueChanges.subscribe(() => {
      if (this.hasError) this.hasError = false;
    });
  }

  submit() {
    this.hasError = false;
    const loginSubscr = this.authService
      .login(this.f.email.value, this.f.password.value)
      .pipe(first())
      .subscribe({
        next: (res) => {
          if (res) {
            this.alert.success('Welcome back!');
            this.router.navigate([this.returnUrl]);
          } else {
            this.hasError = true;
            this.alert.error('Login failed', 'Please check your credentials.');
          }
        },
        error: (err) => {
          this.hasError = true;
          const msg = resolveUserErrorMessage(
            err,
            [
              {
                pattern:
                  /invalid|credential|unauthorized|forbidden|password|email|account/i,
                message: 'Please check your credentials and try again.',
              },
            ],
            'Please check your credentials and try again.',
          );
          this.alert.error('Login failed', msg);
        },
      });
    this.unsubscribe.push(loginSubscr);
  }

  ngOnDestroy() {
    this.unsubscribe.forEach((sb) => sb.unsubscribe());
  }
}
