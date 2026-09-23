export type TransactionType = 'income' | 'expense' | 'transfer';
export type AccountType = 'cash' | 'bank' | 'ewallet' | 'investment' | 'store';
export type RecurringFrequency = 'none' | 'daily' | 'weekly' | 'monthly' | 'yearly';

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
  financeScope?: 'personal' | 'business';
  amount: number;
  description?: string;
  category?: string | Category | null;
  account?: string | Account | null;
  businessProject?: string | BusinessProject | null;
  fromAccount?: string | Account | null;
  toAccount?: string | Account | null;
  date: string;
  recurring?: Recurring;
  nextRunAt?: string | null;
  lastRunAt?: string | null;
  parentRecurringId?: string | null;
  migratedToInvestment?: boolean;
  investmentTransactionId?: string | null;
  createdAt: string;
}

export interface TransactionPayload {
  type?: TransactionType;
  financeScope?: 'personal' | 'business';
  amount?: number;
  description?: string;
  category?: string | null;
  account?: string | null;
  businessProject?: string | null;
  fromAccount?: string | null;
  toAccount?: string | null;
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

/**
 * Append-only record of a manual balance adjustment. Never an income/expense/
 * transfer — it only corrects the stored account balance to match reality.
 */
export interface AccountBalanceAdjustment {
  _id: string;
  user: string;
  account: string;
  previousBalance: number;
  newBalance: number;
  difference: number;
  reason: string;
  currency: string;
  adjustmentDate: string;
  createdAt: string;
  updatedAt?: string;
}

export interface AdjustmentPayload {
  newBalance: number;
  reason: string;
}

export interface AdjustmentHistoryPage {
  adjustments: AccountBalanceAdjustment[];
  total: number;
  page: number;
  limit: number;
  hasMore: boolean;
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

export type InvestmentTransactionType = 'deposit' | 'withdrawal' | 'gain' | 'loss';

export interface Investment {
  _id: string;
  user: string;
  name: string;
  description?: string;
  createdAt?: string;
  // derived (server-calculated)
  currentValue?: number;
  totalInvested?: number;
  netCapitalInvested?: number;
  profitLoss?: number;
  returnPct?: number;
  totalDeposits?: number;
  totalWithdrawals?: number;
}

export interface InvestmentTransaction {
  _id: string;
  user: string;
  investment: string;
  type: InvestmentTransactionType;
  amount: number;
  transaction_date: string;
  note?: string;
  createdAt?: string;
}

export interface InvestmentDetail extends Investment {
  todayChange: number;
  monthChange: number;
  history: { date: string; value: number }[];
  transactions: InvestmentTransaction[];
}

export interface BusinessProject {
  _id: string;
  user: string;
  name: string;
  description?: string;
  startDate: string;
  endDate?: string | null;
  status: 'planned' | 'active' | 'completed' | 'cancelled';
  totalIncome?: number;
  totalExpense?: number;
  profitLoss?: number;
}

export interface InvestmentSyncResult {
  previousValue: number;
  currentValue: number;
  difference: number;
  changeType: 'gain' | 'loss' | 'none';
  transaction: InvestmentTransaction | null;
  portfolio?: Investment;
}

export interface InvestmentOverview {
  currentValue: number;
  totalInvested: number;
  netCapitalInvested: number;
  profitLoss: number;
  returnPct: number;
  todayChange: number;
  monthChange: number;
  portfolios: Investment[];
  count: number;
}
