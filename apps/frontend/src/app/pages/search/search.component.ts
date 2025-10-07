import { Component } from '@angular/core';
import { Router } from '@angular/router';

@Component({
  selector: 'app-search',
  standalone: true,
  template: `
    <h2>Search trips</h2>
    <form (submit)="go($event)">
      <label>From <input name="source" required /></label>
      <label>To <input name="destination" required /></label>
      <label>Date <input type="date" name="date" required /></label>
      <button type="submit">Search</button>
    </form>
  `,
})
export class SearchComponent {
  constructor(private router: Router) {}
  go(e: Event) {
    e.preventDefault();
    const form = e.target as HTMLFormElement;
    const data = new FormData(form);
    const q = new URLSearchParams(data as any).toString();
    this.router.navigateByUrl('/results?' + q);
  }
}
