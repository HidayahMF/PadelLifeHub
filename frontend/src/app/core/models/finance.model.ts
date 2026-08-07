export type TransactionType = 'income' | 'expense';
export type AccountType = 'cash' | 'bank' | 'ewallet';
export type RecurringFrequency = 'daily' | 'weekly' | 'monthly' | 'yearly';

export interface Recurring {
  isRecurring: boolean;
  frequency: RecurringFrequency;
}

export interface Category {
  _id: string;
  user: string;
  name: string;
  color: string;
  icon: string;
  type: 'task' | 'transaction';
  createdAt?: string;
}

export interface Transaction {
  _id: string;
  user: string;
  type: TransactionType;
  amount: number;
  description?: string;
  category?: string | Category | null;
  account?: string | Account | null;
  date: string;
  recurring?: Recurring;
  createdAt: string;
}

export interface TransactionPayload {
  type?: TransactionType;
  amount?: number;
  description?: string;
  category?: string | null;
  account?: string | null;
  date?: string;
  recurring?: Partial<Recurring>;
}

export interface Account {
  _id: string;
  user: string;
  name: string;
  type: AccountType;
  balance: number;
  currency: string;
  createdAt?: string;
}

export interface Budget {
  _id: string;
  user: string;
  category?: string | Category | null;
  amount: number;
  month: string;
  spent: number;
  createdAt?: string;
}

export interface FinanceSummary {
  totalIncome: number;
  totalExpense: number;
  balance: number;
}
