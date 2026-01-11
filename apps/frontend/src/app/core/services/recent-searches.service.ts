import { Injectable, PLATFORM_ID, Inject } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { BehaviorSubject } from 'rxjs';
import { RecentSearch } from '../models/recent-search.model';

@Injectable({
  providedIn: 'root',
})
export class RecentSearchesService {
  private readonly STORAGE_KEY = 'recent_searches';
  private recentSearchesSubject = new BehaviorSubject<RecentSearch[]>([]);
  public recentSearches$ = this.recentSearchesSubject.asObservable();

  constructor(@Inject(PLATFORM_ID) private platformId: Object) {
    this.loadSearches();
  }

  private loadSearches(): void {
    if (isPlatformBrowser(this.platformId)) {
      const saved = localStorage.getItem(this.STORAGE_KEY);
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          this.recentSearchesSubject.next(parsed);
        } catch (e) {
          console.error('Failed to parse recent searches', e);
        }
      }
    }
  }

  addSearch(search: Omit<RecentSearch, 'timestamp'>): void {
    if (isPlatformBrowser(this.platformId)) {
      const current = this.recentSearchesSubject.value;
      const newSearch: RecentSearch = { ...search, timestamp: Date.now() };

      // Remove duplicates (same origin, dest, date)
      const filtered = current.filter(
        (s) =>
          !(
            s.originId === search.originId &&
            s.destinationId === search.destinationId &&
            s.date === search.date
          )
      );

      // Add to top, limit to 5
      const updated = [newSearch, ...filtered].slice(0, 5);

      this.recentSearchesSubject.next(updated);
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(updated));
    }
  }

  clearSearches(): void {
    if (isPlatformBrowser(this.platformId)) {
      localStorage.removeItem(this.STORAGE_KEY);
      this.recentSearchesSubject.next([]);
    }
  }
}
