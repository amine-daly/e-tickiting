import { bootstrapApplication } from '@angular/platform-browser';
import {
  provideRouter,
  withEnabledBlockingInitialNavigation,
} from '@angular/router';
import {
  provideHttpClient,
  withInterceptorsFromDi,
} from '@angular/common/http';
import { provideAnimations } from '@angular/platform-browser/animations';
import { importProvidersFrom } from '@angular/core';
import { AppComponent } from './app/app.component';
import { routes } from './app/app.routes';
import { TranslateModule } from '@ngx-translate/core';
import { InlineSVGModule } from 'ng-inline-svg-2';
import { NgbModule } from '@ng-bootstrap/ng-bootstrap';
import { HttpClientInMemoryWebApiModule } from 'angular-in-memory-web-api';
import { environment } from './environments/environment';
import { FakeAPIService } from './app/_fake/fake-api.service';
import { HTTP_INTERCEPTORS } from '@angular/common/http';
import { AuthTokenClassInterceptor } from './app/core/interceptors/auth-token.class.interceptor';

bootstrapApplication(AppComponent, {
  providers: [
    provideRouter(routes, withEnabledBlockingInitialNavigation()),
    provideHttpClient(withInterceptorsFromDi()),
    provideAnimations(),
    {
      provide: HTTP_INTERCEPTORS,
      useClass: AuthTokenClassInterceptor,
      multi: true,
    },
    importProvidersFrom(
      TranslateModule.forRoot(),
      InlineSVGModule.forRoot(),
      NgbModule,
      ...(environment.isMockEnabled
        ? [
            HttpClientInMemoryWebApiModule.forRoot(FakeAPIService, {
              passThruUnknownUrl: true,
              dataEncapsulation: false,
            }),
          ]
        : [])
    ),
    // Interceptor already registered above
  ],
}).catch((err) => console.error(err));
