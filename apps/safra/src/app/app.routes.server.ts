import { RenderMode, type ServerRoute } from '@angular/ssr';

export const serverRoutes: ServerRoute[] = [
  // Render all routes on the client (CSR) during development
  { path: '', renderMode: RenderMode.Client },
  { path: '**', renderMode: RenderMode.Client },
];
