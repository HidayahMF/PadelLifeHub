export type TaskPriority = 'low' | 'medium' | 'high';
export type TaskStatus = 'todo' | 'in-progress' | 'completed';

export interface Task {
  _id: string;
  user: string;
  title: string;
  description?: string;
  category?: string | Category | null;
  priority: TaskPriority;
  status: TaskStatus;
  dueDate?: string | null;
  reminder?: string | null;
  archived: boolean;
  completedAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface TaskPayload {
  title?: string;
  description?: string;
  category?: string | null;
  priority?: TaskPriority;
  status?: TaskStatus;
  dueDate?: string | null;
  reminder?: string | null;
  archived?: boolean;
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
