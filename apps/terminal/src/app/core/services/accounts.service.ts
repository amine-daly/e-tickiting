import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from 'src/environments/environment';
import { AccountType } from '../models/account.model';

export interface AddTargetPayload {
  posId: string;
  permissionId?: string;
}

@Injectable({ providedIn: 'root' })
export class AccountsService {
  private apiBase = `${environment.apiBase}/accounts`;

  constructor(private http: HttpClient) {}

  /**
   * Get current user's accounts
   */
  getCurrentAccounts(): Observable<AccountType[]> {
    return this.http.get<AccountType[]>(`${this.apiBase}/current`);
  }

  /**
   * Get account by ID
   */
  getAccountById(id: string): Observable<AccountType> {
    return this.http.get<AccountType>(`${this.apiBase}/${id}`);
  }

  /**
   * Create a new account linked to a POS for the same user as the source account.
   * This does NOT update the existing account - it creates a new one.
   */
  addTargetToAccount(
    accountId: string,
    payload: AddTargetPayload,
  ): Observable<AccountType> {
    return this.http.post<AccountType>(
      `${this.apiBase}/${accountId}/target`,
      payload,
    );
  }

  /**
   * Delete an account
   */
  deleteAccount(id: string): Observable<void> {
    return this.http.delete<void>(`${this.apiBase}/${id}`);
  }
}
