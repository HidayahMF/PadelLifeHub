import type { Transaction } from './finance.model';
import type { Task } from './task.model';
import type { Goal } from './lifestyle.model';

export interface Note {
  _id: string;
  user: string;
  title: string;
  content?: string;
  pinned: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Setting {
  _id?: string;
  user?: string;
  theme: string;
  darkMode: boolean;
  language: string;
  currency: string;
  notifications: {
    taskReminders: boolean;
    billReminders: boolean;
    habitReminders: boolean;
    emailUpdates: boolean;
  };
}

export interface TaskSummary {
  total: number;
  completed: number;
  pending: number;
  today: Task[];
  upcoming: Task[];
}

export interface FinanceSummaryBlock {
  totalIncome: number;
  totalExpense: number;
  monthIncome: number;
  monthExpense: number;
  balance: number;
}

export interface DashboardSummary {
  taskSummary: TaskSummary;
  financeSummary: FinanceSummaryBlock;
  recentTransactions: Transaction[];
  activeGoals: Goal[];
}

export interface CategorySpend {
  _id: string | null;
  total: number;
}

export interface CashFlowPoint {
  _id: string;
  income: number;
  expense: number;
}

export interface ProductivityStats {
  totalTasks: number;
  completedTasks: number;
  pendingTasks: number;
  weeklyCompleted: number;
  monthlyCompleted: number;
  weeklyActive: Task[];
  weeklyActivity: { date: string; completed: number }[];
}

export interface FinanceStats {
  totalIncome: number;
  totalExpense: number;
  balance: number;
  categorySpending: CategorySpend[];
  monthlyCashFlow: CashFlowPoint[];
}

export interface Statistics {
  productivity: ProductivityStats;
  finance: FinanceStats;
}

export interface NotificationItem {
  _id: string;
  user: string;
  title: string;
  message: string;
  type: 'reminder' | 'task' | 'bill' | 'habit' | 'recurring' | 'system';
  relatedId?: string | null;
  read: boolean;
  createdAt: string;
}
