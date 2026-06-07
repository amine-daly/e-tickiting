import { InjectionToken } from '@angular/core';

export const IS_MOBILE_SHELL = new InjectionToken<boolean>('IS_MOBILE_SHELL', {
  factory: () => false,
});
