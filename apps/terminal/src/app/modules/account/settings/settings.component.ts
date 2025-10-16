import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ProfileDetailsComponent } from './forms/profile-details/profile-details.component';
import { SignInMethodComponent } from './forms/sign-in-method/sign-in-method.component';
import { ConnectedAccountsComponent } from './forms/connected-accounts/connected-accounts.component';
import { EmailPreferencesComponent } from './forms/email-preferences/email-preferences.component';
import { NotificationsComponent } from './forms/notifications/notifications.component';
import { DeactivateAccountComponent } from './forms/deactivate-account/deactivate-account.component';

@Component({
  selector: 'app-settings',
  standalone: true,
  imports: [
    CommonModule,
    ProfileDetailsComponent,
    SignInMethodComponent,
    ConnectedAccountsComponent,
    EmailPreferencesComponent,
    NotificationsComponent,
    DeactivateAccountComponent,
  ],
  templateUrl: './settings.component.html',
})
export class SettingsComponent {
  constructor() {}
}
