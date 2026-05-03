// This file can be replaced during build by using the `fileReplacements` array.
// `ng build` replaces `environment.ts` with `environment.prod.ts`.
// The list of file replacements can be found in `angular.json`.

export const environment = {
  production: false,
  appVersion: 'v1',
  USERDATA_KEY: 'auth',
  isMockEnabled: false, // disable in-memory mocks
  apiBase: 'http://localhost:8080/api', // direct backend URL, no proxy
  /* apiBase: 'http://13.61.196.160/api', */
};
