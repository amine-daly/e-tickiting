import { CommonModule } from '@angular/common';
import { Observable } from 'rxjs';
import { TranslateModule } from '@ngx-translate/core';
import { Component, HostBinding, OnInit } from '@angular/core';

import { UserType } from 'src/app/core/models/user-type';
import { TranslationService } from '../../../../../../modules/i18n';
import { AuthService } from '../../../../../../modules/auth';

@Component({
  selector: 'app-user-inner',
  standalone: true,
  imports: [CommonModule, TranslateModule],
  templateUrl: './user-inner.component.html',
})
export class UserInnerComponent implements OnInit {
  @HostBinding('class')
  class =
    `menu menu-sub menu-sub-dropdown menu-column menu-rounded menu-gray-600 menu-state-bg menu-state-primary fw-bold py-4 fs-6 w-275px`;
  @HostBinding('attr.data-kt-menu') dataKtMenu = 'true';

  language?: LanguageFlag;
  user$!: Observable<UserType>;
  readonly langs: LanguageFlag[] = languages;

  constructor(
    private auth: AuthService,
    private translationService: TranslationService,
  ) {}

  ngOnInit(): void {
    this.user$ = this.auth.currentUser.asObservable();
    this.selectLanguage(this.translationService.getCurrentLanguage());
  }

  logout() {
    this.auth.logout();
  }

  selectLanguage(lang: string): void {
    const normalizedLanguage = this.translationService.setLanguage(lang);
    this.language =
      this.langs.find((language) => language.lang === normalizedLanguage) ??
      this.langs[0];
  }
}

interface LanguageFlag {
  lang: string;
  name: string;
  flag: string;
}

const languages: LanguageFlag[] = [
  {
    lang: 'en-gb',
    name: 'English',
    flag: './assets/media/flags/united-kingdom.svg',
  },
  {
    lang: 'fr-fr',
    name: 'French',
    flag: './assets/media/flags/france.svg',
  },
  {
    lang: 'ar-sa',
    name: 'Arabic',
    flag: './assets/media/flags/saudi-arabia.svg',
  },
];
