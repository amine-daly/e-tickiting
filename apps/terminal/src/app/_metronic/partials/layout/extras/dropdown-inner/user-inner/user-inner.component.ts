import { CommonModule } from '@angular/common';
import { Observable, Subscription } from 'rxjs';
import { CookieService } from 'ngx-cookie-service';
import { TranslateModule } from '@ngx-translate/core';
import { Component, HostBinding, OnDestroy, OnInit } from '@angular/core';

import { UserType } from 'src/app/core/models/user-type';
import { TranslationService } from '../../../../../../modules/i18n';
import { AuthService } from '../../../../../../modules/auth';

@Component({
  selector: 'app-user-inner',
  standalone: true,
  imports: [CommonModule, TranslateModule],
  templateUrl: './user-inner.component.html',
})
export class UserInnerComponent implements OnInit, OnDestroy {
  @HostBinding('class')
  class =
    `menu menu-sub menu-sub-dropdown menu-column menu-rounded menu-gray-600 menu-state-bg menu-state-primary fw-bold py-4 fs-6 w-275px`;
  @HostBinding('attr.data-kt-menu') dataKtMenu = 'true';

  language: LanguageFlag;
  user$: Observable<UserType>;
  langs = languages;
  private unsubscribe: Subscription[] = [];

  constructor(
    private auth: AuthService,
    private translationService: TranslationService,
  ) {}

  ngOnInit(): void {
    this.user$ = this.auth.currentUser.asObservable();
    const lang = localStorage.getItem('lang') || 'fr-fr';
    this.selectLanguage(lang);
  }

  logout() {
    this.auth.logout();
  }

  selectLanguage(lang: string) {
    this.langs.forEach((language: LanguageFlag) => {
      if (language.lang === lang) {
        language.active = true;
        this.language = language;
      } else {
        language.active = false;
      }
    });
    this.translationService.setLanguage(lang);
  }

  ngOnDestroy() {
    this.unsubscribe.forEach((sb) => sb.unsubscribe());
  }
}

interface LanguageFlag {
  lang: string;
  name: string;
  flag: string;
  active?: boolean;
}

const languages = [
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
