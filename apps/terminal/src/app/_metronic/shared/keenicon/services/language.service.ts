import { isPlatformBrowser } from '@angular/common';
import { Inject, Injectable, PLATFORM_ID } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';
import { CookieService } from 'ngx-cookie-service';
import { BehaviorSubject, Observable } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class LanguageService {
  private rtl: BehaviorSubject<boolean> = new BehaviorSubject<boolean>(false);
  public currentFlag: Observable<boolean>;
  public languages: string[] = ['en', 'fr', 'tn'];
  private languageSubject: BehaviorSubject<string> = new BehaviorSubject(null);

  get languageChanges$(): Observable<string> {
    return this.languageSubject.asObservable();
  }

  set languageChanges$(value: any) {
    this.languageSubject.next(value);
  }

  get rtl$(): Observable<boolean> {
    return this.rtl.asObservable();
  }

  set rtl$(value: any) {
    this.rtl.next(value);
  }

  constructor(public translate: TranslateService, private cookieService: CookieService, @Inject(PLATFORM_ID) private platformId: Object) {
    if (isPlatformBrowser(this.platformId)) {
      let browserLang: any;

      const allowedLanguages = ['fr-fr', 'ar-tn', 'en-gb','de'];
      this.translate.addLangs(allowedLanguages);

      if (this.cookieService.check('elvkwdigtlanguage')) {
        browserLang = this.cookieService.get('elvkwdigtlanguage');
      } else {
        browserLang = translate.getBrowserLang();
      }

      this.setLanguage(allowedLanguages.includes(browserLang) ? browserLang : 'fr-fr');
    }
  }

  setLanguage(lang: string) {
    this.translate.use(lang);
    this.cookieService.set('elvkwdigtlanguage', lang);
    this.languageSubject.next(lang);
    const rtlLanguages = ['ar-tn', 'ar-sa', 'he', 'fa', 'ur'];
    const isRtl = rtlLanguages.includes(lang);
    this.rtl.next(isRtl);
  }
  setLanguageFromLocale(locale: string) {
    const allowedLanguages = ['fr-fr', 'ar-tn', 'en-gb','de'];
    const lang = allowedLanguages.includes(locale) ? locale : 'fr-fr';
    this.setLanguage(lang);
  }
}
