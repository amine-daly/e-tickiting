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
    private cookieService: CookieService,
    @Inject(PLATFORM_ID) private platformId: Object
  ) {
    if (isPlatformBrowser(this.platformId)) {
      let browserLang: any;

      const allowedLanguages = ['fr-fr', 'ar-tn', 'en-gb', 'de'];
      this.translate.addLangs(allowedLanguages);

      if (this.cookieService.check('lang')) {
        browserLang = this.cookieService.get('lang');
      } else {
        browserLang = translate.getBrowserLang();
      }

      this.setLanguage(
        allowedLanguages.includes(browserLang) ? browserLang : 'fr-fr'
      );
    }
  }

  setLanguage(lang: string) {
    this.translate.use(lang);
    console.log(
      '🚀 ~ TranslationService ~ setLanguage ~ this.translate:',
      this.translate
    );
    this.cookieService.set('lang', lang);
  }
}
