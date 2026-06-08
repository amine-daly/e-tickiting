import { mergeApplicationConfig, ApplicationConfig } from '@angular/core';
import { provideServerRendering } from '@angular/platform-server';
import { appConfig } from './app.config';

const serverConfig: ApplicationConfig = {
  providers: [
    // Enable server rendering features for route extraction and SSR
    provideServerRendering(),
  ],
};

export const config = mergeApplicationConfig(appConfig, serverConfig);
