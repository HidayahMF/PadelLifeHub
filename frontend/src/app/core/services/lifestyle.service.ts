import { inject, Injectable, signal } from '@angular/core';
import type { Goal, Habit, Need, Reminder, WishlistItem } from '../models/lifestyle.model';
import type { QueryParams } from './api.service';
import { ApiService } from './api.service';

@Injectable({ providedIn: 'root' })
export class WishlistService {
  private api = inject(ApiService);
  readonly items = signal<WishlistItem[]>([]);
  readonly loading = signal(false);

  load(params?: QueryParams) {
    this.loading.set(true);
    return this.api.get<WishlistItem[]>('/wishlist', params).subscribe({
      next: (res) => {
        this.items.set(res);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  getAll(params?: QueryParams) {
    return this.api.get<WishlistItem[]>('/wishlist', params);
  }

  create(payload: Partial<WishlistItem>) {
    return this.api.post<WishlistItem>('/wishlist', payload);
  }

  update(id: string, payload: Partial<WishlistItem>) {
    return this.api.put<WishlistItem>(`/wishlist/${id}`, payload);
  }

  remove(id: string) {
    return this.api.delete<{ message: string }>(`/wishlist/${id}`);
  }
}

@Injectable({ providedIn: 'root' })
export class NeedService {
  private api = inject(ApiService);
  readonly needs = signal<Need[]>([]);
  readonly loading = signal(false);

  load(params?: QueryParams) {
    this.loading.set(true);
    return this.api.get<Need[]>('/needs', params).subscribe({
      next: (res) => {
        this.needs.set(res);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  getAll(params?: QueryParams) {
    return this.api.get<Need[]>('/needs', params);
  }

  create(payload: Partial<Need>) {
    return this.api.post<Need>('/needs', payload);
  }

  update(id: string, payload: Partial<Need>) {
    return this.api.put<Need>(`/needs/${id}`, payload);
  }

  remove(id: string) {
    return this.api.delete<{ message: string }>(`/needs/${id}`);
  }
}

@Injectable({ providedIn: 'root' })
export class GoalService {
  private api = inject(ApiService);
  readonly goals = signal<Goal[]>([]);
  readonly loading = signal(false);

  load(params?: QueryParams) {
    this.loading.set(true);
    return this.api.get<Goal[]>('/goals', params).subscribe({
      next: (res) => {
        this.goals.set(res);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  getAll(params?: QueryParams) {
    return this.api.get<Goal[]>('/goals', params);
  }

  create(payload: Partial<Goal>) {
    return this.api.post<Goal>('/goals', payload);
  }

  update(id: string, payload: Partial<Goal>) {
    return this.api.put<Goal>(`/goals/${id}`, payload);
  }

  remove(id: string) {
    return this.api.delete<{ message: string }>(`/goals/${id}`);
  }
}

@Injectable({ providedIn: 'root' })
export class HabitService {
  private api = inject(ApiService);
  readonly habits = signal<Habit[]>([]);
  readonly loading = signal(false);

  load() {
    this.loading.set(true);
    return this.api.get<Habit[]>('/habits').subscribe({
      next: (res) => {
        this.habits.set(res);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  getAll() {
    return this.api.get<Habit[]>('/habits');
  }

  create(payload: Partial<Habit>) {
    return this.api.post<Habit>('/habits', payload);
  }

  update(id: string, payload: Partial<Habit>) {
    return this.api.put<Habit>(`/habits/${id}`, payload);
  }

  toggle(id: string) {
    return this.api.put<Habit>(`/habits/${id}/toggle`);
  }

  remove(id: string) {
    return this.api.delete<{ message: string }>(`/habits/${id}`);
  }
}

@Injectable({ providedIn: 'root' })
export class ReminderService {
  private api = inject(ApiService);
  readonly reminders = signal<Reminder[]>([]);
  readonly loading = signal(false);

  load(params?: QueryParams) {
    this.loading.set(true);
    return this.api.get<Reminder[]>('/reminders', params).subscribe({
      next: (res) => {
        this.reminders.set(res);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  getAll(params?: QueryParams) {
    return this.api.get<Reminder[]>('/reminders', params);
  }

  create(payload: Partial<Reminder>) {
    return this.api.post<Reminder>('/reminders', payload);
  }

  update(id: string, payload: Partial<Reminder>) {
    return this.api.put<Reminder>(`/reminders/${id}`, payload);
  }

  remove(id: string) {
    return this.api.delete<{ message: string }>(`/reminders/${id}`);
  }
}
