import { inject, Injectable, signal } from '@angular/core';
import type { Account, Budget, FinanceSummary, Transaction, TransactionPayload } from '../models/finance.model';
import type { QueryParams } from './api.service';
import { ApiService } from './api.service';

@Injectable({ providedIn: 'root' })
export class TransactionService {
  private api = inject(ApiService);

  readonly transactions = signal<Transaction[]>([]);
  readonly loading = signal(false);

  load(params?: QueryParams) {
    this.loading.set(true);
    return this.api.get<Transaction[]>('/transactions', params).subscribe({
      next: (res) => {
        this.transactions.set(res);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  getAll(params?: QueryParams) {
    return this.api.get<Transaction[]>('/transactions', params);
  }

  create(payload: TransactionPayload) {
    return this.api.post<Transaction>('/transactions', payload);
  }

  update(id: string, payload: TransactionPayload) {
    return this.api.put<Transaction>(`/transactions/${id}`, payload);
  }

  remove(id: string) {
    return this.api.delete<{ message: string }>(`/transactions/${id}`);
  }

  summary(params?: QueryParams) {
    return this.api.get<FinanceSummary>('/transactions/summary', params);
  }
}

@Injectable({ providedIn: 'root' })
export class AccountService {
  private api = inject(ApiService);

  readonly accounts = signal<Account[]>([]);
  readonly loading = signal(false);

  load() {
    this.loading.set(true);
    return this.api.get<Account[]>('/accounts').subscribe({
      next: (res) => {
        this.accounts.set(res);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  getAll() {
    return this.api.get<Account[]>('/accounts');
  }

  create(payload: Partial<Account>) {
    return this.api.post<Account>('/accounts', payload);
  }

  update(id: string, payload: Partial<Account>) {
    return this.api.put<Account>(`/accounts/${id}`, payload);
  }

  remove(id: string) {
    return this.api.delete<{ message: string }>(`/accounts/${id}`);
  }
}

@Injectable({ providedIn: 'root' })
export class BudgetService {
  private api = inject(ApiService);

  readonly budgets = signal<Budget[]>([]);
  readonly loading = signal(false);

  load(params?: QueryParams) {
    this.loading.set(true);
    return this.api.get<Budget[]>('/budgets', params).subscribe({
      next: (res) => {
        this.budgets.set(res);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  getAll(params?: QueryParams) {
    return this.api.get<Budget[]>('/budgets', params);
  }

  create(payload: Partial<Budget>) {
    return this.api.post<Budget>('/budgets', payload);
  }

  update(id: string, payload: Partial<Budget>) {
    return this.api.put<Budget>(`/budgets/${id}`, payload);
  }

  remove(id: string) {
    return this.api.delete<{ message: string }>(`/budgets/${id}`);
  }
}
