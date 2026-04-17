// Localization is based on '@ngx-translate/core';
// Please be familiar with official documentations first => https://github.com/ngx-translate/core

import { isPlatformBrowser } from '@angular/common';
import { Inject, Injectable, PLATFORM_ID } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';
import { CookieService } from 'ngx-cookie-service';

export interface Locale {
  lang: string;
  data: any;
}

const LOCALIZATION_LOCAL_STORAGE_KEY = 'language';

@Injectable({
  providedIn: 'root',
})
export class TranslationService {
  // Private properties
  private langIds: any = [];

  constructor(
    public translate: TranslateService,
    @Inject(PLATFORM_ID) private platformId: Object,
  ) {
    if (isPlatformBrowser(this.platformId)) {
      const allowedLanguages = ['fr-fr', 'ar-sa', 'en-gb', 'de'];
      this.translate.addLangs(allowedLanguages);
      const lang = localStorage.getItem('lang');
      this.setLanguage(allowedLanguages.includes(lang) ? lang : 'fr-fr');
    }
  }

  setLanguage(lang: string) {
    this.translate.use(lang);
    localStorage.setItem('lang', lang);
  }
}
