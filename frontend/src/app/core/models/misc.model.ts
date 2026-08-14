import type { Transaction } from './finance.model';
import type { Task } from './task.model';
import type { Goal, Habit, Need, Reminder, WishlistItem } from './lifestyle.model';

export interface Note {
  _id: string;
  user: string;
  title: string;
  content?: string;
  pinned: boolean;
  tags?: string[];
  archived?: boolean;
  trashed?: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Setting {
  _id?: string;
  user?: string;
  theme: string;
  darkMode: boolean;
  language: string;
  notifications: {
    taskReminders: boolean;
    billReminders: boolean;
    habitReminders: boolean;
    emailUpdates: boolean;
  };
  dashboardWidgets?: string[];
  hideBalance?: boolean;
  onboarding?: {
    status: 'not_started' | 'in_progress' | 'completed' | 'skipped';
    completedAt?: string;
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

export interface SearchResults {
  tasks: Task[];
  transactions: Transaction[];
  notes: Note[];
  goals: Goal[];
  habits: Habit[];
  wishlist: WishlistItem[];
  needs: Need[];
  reminders: Reminder[];
}

export interface TodayHabit extends Habit {
  doneToday: boolean;
}

export interface TodayData {
  date: string;
  focus: Task[];
  overdue: Task[];
  completedToday: number;
  habits: TodayHabit[];
  finance: { income: number; expense: number; net: number };
  upcomingReminders: Reminder[];
  upcomingTasks: Task[];
  goals: Goal[];
  progress: {
    totalTasksToday: number;
    completedTasksToday: number;
    habitsTotal: number;
    habitsDone: number;
  };
}

export interface WeeklyReviewData {
  weekStart: string;
  weekEnd: string;
  weekLabel: string;
  productivity: {
    completed: number;
    created: number;
    completionRate: number;
    overdue: number;
  };
  habits: { bestStreak: number; averageCompletion: number; tracked: number };
  finance: { income: number; expense: number; saved: number };
  goals: { progressed: number; completed: number };
  topCategory: { name: string; total: number } | null;
  reflection: { wentWell: string; improve: string };
}

export interface InsightsData {
  month: string;
  income: { thisMonth: number; lastMonth: number };
  expense: { thisMonth: number; lastMonth: number };
  savingsRate: number;
  savingsRateLastMonth: number;
  spendingByCategory: { name: string; color: string; total: number; pct: number }[];
  largestCategory: { name: string; total: number; pct: number } | null;
  monthOverMonth: { spent: number; lastMonthSpent: number; diff: number; pct: number };
  budget: {
    totalBudget: number;
    totalSpent: number;
    pct: number;
    count: number;
    overBudget: string[];
  };
  cashFlow: { _id: string; income: number; expense: number; net: number }[];
  weekendVsWeekday: { weekendAvg: number; weekdayAvg: number };
}
