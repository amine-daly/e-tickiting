import { Injectable } from '@angular/core';
import { Subject } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class MobileShellService {
  private readonly scanRequest = new Subject<void>();
  readonly scanRequested$ = this.scanRequest.asObservable();

  requestScan(): void {
    this.scanRequest.next();
  }
}
