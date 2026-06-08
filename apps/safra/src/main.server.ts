import {
  bootstrapApplication,
  type BootstrapContext,
} from '@angular/platform-browser';
import { AppComponent } from './app/app.component';
import { config } from './app/app.config.server';
export default function bootstrap(context?: BootstrapContext) {
  // During dev route extraction, Angular may call this without a context.
  // Only pass the context when provided to avoid NG0401.
  return bootstrapApplication(AppComponent, config, context);
}
