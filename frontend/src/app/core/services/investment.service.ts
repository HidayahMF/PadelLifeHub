import { inject, Injectable } from '@angular/core';
import type {
  Investment,
  InvestmentDetail,
  InvestmentOverview,
  InvestmentTransaction,
  InvestmentTransactionType,
} from '../models/finance.model';
import { ApiService } from './api.service';

@Injectable({ providedIn: 'root' })
export class InvestmentService {
  private api = inject(ApiService);

  overview() {
    return this.api.get<InvestmentOverview>('/investments/overview');
  }

  getAll() {
    return this.api.get<Investment[]>('/investments');
  }

  createPortfolio(payload: { name: string; description?: string }) {
    return this.api.post<Investment>('/investments', payload);
  }

  updatePortfolio(id: string, payload: { name?: string; description?: string }) {
    return this.api.put<Investment>(`/investments/${id}`, payload);
  }

  deletePortfolio(id: string) {
    return this.api.delete<{ message: string }>(`/investments/${id}`);
  }

  getDetail(id: string) {
    return this.api.get<InvestmentDetail>(`/investments/${id}`);
  }

  getTransactions(investmentId?: string) {
    const params = investmentId ? { investment: investmentId } : undefined;
    return this.api.get<InvestmentTransaction[]>('/investments/transactions', params);
  }

  createTransaction(payload: {
    investment: string;
    type: InvestmentTransactionType;
    amount: number;
    transaction_date: string;
    note?: string;
  }) {
    return this.api.post<InvestmentTransaction>('/investments/transactions', payload);
  }

  updateTransaction(
    id: string,
    payload: Partial<{
      investment: string;
      type: InvestmentTransactionType;
      amount: number;
      transaction_date: string;
      note: string;
    }>
  ) {
    return this.api.put<InvestmentTransaction>(`/investments/transactions/${id}`, payload);
  }

  deleteTransaction(id: string) {
    return this.api.delete<{ message: string }>(`/investments/transactions/${id}`);
  }
}
