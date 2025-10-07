import { Component } from '@angular/core';

@Component({
  selector: 'app-landing',
  standalone: true,
  template: `
    <section class="landing">
      <h1>E‑Ticketing</h1>
      <a routerLink="/search">Search trips</a>
      <a routerLink="/login">Login</a>
      <a routerLink="/register">Register</a>
    </section>
  `,
  styles: [
    `
      .landing {
        display: flex;
        gap: 1rem;
        align-items: center;
      }
    `,
  ],
})
export class LandingComponent {}
