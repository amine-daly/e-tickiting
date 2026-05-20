// Localization is based on '@ngx-translate/core';
// Please be familiar with official documentations first => https://github.com/ngx-translate/core

import { DOCUMENT, isPlatformBrowser } from '@angular/common';
import { Inject, Injectable, PLATFORM_ID } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';

const DEFAULT_LANGUAGE = 'fr-fr';
const LANGUAGE_STORAGE_KEY = 'lang';
const RTL_STYLESHEET_ID = 'terminal-rtl-stylesheet';
const RTL_STYLESHEET_PATH = 'assets/css/style.rtl.css';
const RTL_LANGUAGE_PREFIXES = ['ar', 'fa', 'he', 'ur'];
const SUPPORTED_LANGUAGES = ['fr-fr', 'ar-sa', 'en-gb', 'de'];

@Injectable({
  providedIn: 'root',
})
export class TranslationService {
  constructor(
    public translate: TranslateService,
    @Inject(PLATFORM_ID) private platformId: Object,
    @Inject(DOCUMENT) private document: Document,
  ) {
    this.translate.addLangs(SUPPORTED_LANGUAGES);

    if (isPlatformBrowser(this.platformId)) {
      this.setLanguage(this.getInitialLanguage());
    }
  }

  setLanguage(lang: string): string {
    const normalizedLanguage = this.resolveLanguage(lang);

    this.translate.use(normalizedLanguage);

    if (!isPlatformBrowser(this.platformId)) {
      return normalizedLanguage;
    }

    localStorage.setItem(LANGUAGE_STORAGE_KEY, normalizedLanguage);
    this.syncDirection(normalizedLanguage);

    return normalizedLanguage;
  }

  getCurrentLanguage(): string {
    if (!isPlatformBrowser(this.platformId)) {
      return DEFAULT_LANGUAGE;
    }

    return this.resolveLanguage(
      this.translate.currentLang ?? localStorage.getItem(LANGUAGE_STORAGE_KEY),
    );
  }

  private getInitialLanguage(): string {
    return this.resolveLanguage(localStorage.getItem(LANGUAGE_STORAGE_KEY));
  }

  private resolveLanguage(lang: string | null | undefined): string {
    const candidate = lang ?? '';

    return SUPPORTED_LANGUAGES.includes(candidate)
      ? candidate
      : DEFAULT_LANGUAGE;
  }

  private syncDirection(lang: string): void {
    const isRtl = this.isRtlLanguage(lang);
    const direction = isRtl ? 'rtl' : 'ltr';

    this.document.documentElement.lang = lang;
    this.document.documentElement.dir = direction;

    if (this.document.body) {
      this.document.body.dir = direction;
      this.document.body.style.direction = direction;
    }

    this.toggleRtlStylesheet(isRtl);
  }

  private toggleRtlStylesheet(enable: boolean): void {
    const existingLink = this.document.getElementById(
      RTL_STYLESHEET_ID,
    ) as HTMLLinkElement | null;

    if (!enable) {
      existingLink?.remove();
      return;
    }

    if (existingLink) {
      return;
    }

    const link = this.document.createElement('link');
    link.id = RTL_STYLESHEET_ID;
    link.rel = 'stylesheet';
    link.href = new URL(RTL_STYLESHEET_PATH, this.document.baseURI).toString();
    this.document.head.appendChild(link);
  }

  private isRtlLanguage(lang: string): boolean {
    return RTL_LANGUAGE_PREFIXES.some((prefix) => lang.startsWith(prefix));
  }
}
