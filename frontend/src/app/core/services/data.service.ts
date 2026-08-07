import { inject, Injectable, signal } from '@angular/core';
import type { Note, Setting, DashboardSummary, Statistics } from '../models/misc.model';
import type { QueryParams } from './api.service';
import { ApiService } from './api.service';

@Injectable({ providedIn: 'root' })
export class NoteService {
  private api = inject(ApiService);
  readonly notes = signal<Note[]>([]);
  readonly loading = signal(false);

  load(params?: QueryParams) {
    this.loading.set(true);
    return this.api.get<Note[]>('/notes', params).subscribe({
      next: (res) => {
        this.notes.set(res);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  getAll(params?: QueryParams) {
    return this.api.get<Note[]>('/notes', params);
  }

  create(payload: Partial<Note>) {
    return this.api.post<Note>('/notes', payload);
  }

  update(id: string, payload: Partial<Note>) {
    return this.api.put<Note>(`/notes/${id}`, payload);
  }

  remove(id: string) {
    return this.api.delete<{ message: string }>(`/notes/${id}`);
  }
}

@Injectable({ providedIn: 'root' })
export class SettingService {
  private api = inject(ApiService);
  readonly settings = signal<Setting | null>(null);
  readonly loading = signal(false);

  load() {
    this.loading.set(true);
    return this.api.get<Setting>('/settings').subscribe({
      next: (res) => {
        this.settings.set(res);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  get() {
    return this.api.get<Setting>('/settings');
  }

  update(payload: Partial<Setting>) {
    return this.api.put<Setting>('/settings', payload);
  }
}

@Injectable({ providedIn: 'root' })
export class DashboardService {
  private api = inject(ApiService);

  summary() {
    return this.api.get<DashboardSummary>('/dashboard/summary');
  }

  statistics() {
    return this.api.get<Statistics>('/dashboard/statistics');
  }
}
