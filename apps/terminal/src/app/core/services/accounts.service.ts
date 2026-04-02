import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { map, Observable, switchMap, take } from 'rxjs';
import { environment } from 'src/environments/environment';
import { AccountType } from '../models/account.model';
import { AuthService } from 'src/app/modules/auth';

export interface AddTargetPayload {
  companyId: string;
  permissionId?: string;
}

@Injectable({ providedIn: 'root' })
export class AccountsService {
  private apiBase = `${environment.apiBase}/accounts`;

  constructor(
    private http: HttpClient,
    private authService: AuthService,
  ) {}

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
   * Create a new account linked to a company for the same user as the source account.
   * This does NOT update the existing account - it creates a new one.
   */
  addTargetToAccount(
    accountId: string,
    payload: AddTargetPayload,
  ): Observable<AccountType> {
    return this.authService.accounts$.pipe(
      take(1),
      switchMap((accounts) => {
        return this.http
          .post<AccountType>(`${this.apiBase}/${accountId}/target`, payload)
          .pipe(
            map((res) => {
              if (res) {
                this.authService.accounts$ = [...accounts, res];
                return res;
              }
              throw new Error('Failed to create account target');
            }),
          );
      }),
    );
  }

  /**
   * Delete an account
   */
  deleteAccount(id: string): Observable<void> {
    return this.http.delete<void>(`${this.apiBase}/${id}`).pipe(
      switchMap(() => {
        return this.authService.accounts$.pipe(
          take(1),
          map((accounts) => {
            const updatedAccounts = accounts.filter((acc) => acc.id !== id);
            this.authService.accounts$ = updatedAccounts;
          }),
        );
      }),
    );
  }
}
