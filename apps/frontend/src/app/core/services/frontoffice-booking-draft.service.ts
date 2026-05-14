import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';

import { FrontofficeBookingDraft } from '../models/booking.model';

@Injectable({ providedIn: 'root' })
export class FrontofficeBookingDraftService {
  private readonly storageKey = 'frontoffice-booking-draft';
  private readonly draftSubject = new BehaviorSubject<FrontofficeBookingDraft | null>(
    this.readDraft(),
  );

  get draft$(): Observable<FrontofficeBookingDraft | null> {
    return this.draftSubject.asObservable();
  }

  getDraft(): FrontofficeBookingDraft | null {
    return this.draftSubject.getValue();
  }

  saveDraft(draft: FrontofficeBookingDraft): void {
    this.draftSubject.next(draft);
    if (typeof window === 'undefined') {
      return;
    }
    sessionStorage.setItem(this.storageKey, JSON.stringify(draft));
  }

  updateDraft(patch: Partial<FrontofficeBookingDraft>): void {
    const currentDraft = this.getDraft();
    if (!currentDraft) {
      return;
    }
    this.saveDraft({ ...currentDraft, ...patch });
  }

  clearDraft(): void {
    this.draftSubject.next(null);
    if (typeof window === 'undefined') {
      return;
    }
    sessionStorage.removeItem(this.storageKey);
  }

  private readDraft(): FrontofficeBookingDraft | null {
    if (typeof window === 'undefined') {
      return null;
    }

    const rawDraft = sessionStorage.getItem(this.storageKey);
    if (!rawDraft) {
      return null;
    }

    try {
      return JSON.parse(rawDraft) as FrontofficeBookingDraft;
    } catch {
      sessionStorage.removeItem(this.storageKey);
      return null;
    }
  }
}