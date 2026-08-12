export type TaskStatus = 'todo' | 'in-progress' | 'completed';
export type TaskPriority = 'low' | 'medium' | 'high';
export type TaskRecurrenceFrequency = 'none' | 'daily' | 'weekly' | 'monthly' | 'yearly';

export interface TaskRecurring {
  isRecurring: boolean;
  frequency: TaskRecurrenceFrequency;
  daysOfWeek: number[];
}

export interface Task {
  _id: string;
  user: string;
  title: string;
  description?: string;
  priority: TaskPriority;
  tags?: string[];
  category?: string | Category | null;
  pinned: boolean;
  status: TaskStatus;
  dueDate?: string | null;
  reminder?: string | null;
  archived: boolean;
  trashed?: boolean;
  completedAt?: string | null;
  recurring?: TaskRecurring;
  recurrenceId?: string | null;
  nextOccurrence?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface TaskPayload {
  title?: string;
  description?: string;
  priority?: TaskPriority;
  tags?: string[];
  category?: string | null;
  pinned?: boolean;
  status?: TaskStatus;
  dueDate?: string | null;
  reminder?: string | null;
  archived?: boolean;
  trashed?: boolean;
  recurring?: Partial<TaskRecurring>;
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
