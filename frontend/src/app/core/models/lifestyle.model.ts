export type WishlistStatus = 'saved' | 'in-progress' | 'purchased';

export interface WishlistItem {
  _id: string;
  user: string;
  name: string;
  price: number;
  priority: 'low' | 'medium' | 'high';
  savingProgress: number;
  targetDate?: string | null;
  link?: string;
  status: WishlistStatus;
  createdAt?: string;
}

export interface Need {
  _id: string;
  user: string;
  name: string;
  quantity: number;
  unit?: string;
  price: number;
  category?: string;
  onShoppingList: boolean;
  purchased: boolean;
  purchaseHistory?: {
    date: string;
    quantity: number;
    price: number;
  }[];
}

export interface Goal {
  _id: string;
  user: string;
  title: string;
  description?: string;
  target?: number | null;
  unit?: string;
  progress: number;
  deadline?: string | null;
  completed: boolean;
  createdAt?: string;
}

export type HabitFrequency = 'daily' | 'weekly' | 'monthly';

export interface Habit {
  _id: string;
  user: string;
  name: string;
  description?: string;
  frequency: HabitFrequency;
  completedDates: string[];
  streak: number;
  bestStreak: number;
  archived: boolean;
  createdAt?: string;
}

export interface Reminder {
  _id: string;
  user: string;
  title: string;
  datetime: string;
  type: 'task' | 'bill' | 'shopping' | 'goal' | 'wishlist' | 'custom';
  relatedId?: string | null;
  recurring?: {
    isRecurring: boolean;
    frequency: string;
  };
  sent?: boolean;
}
