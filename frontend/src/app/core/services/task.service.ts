import { inject, Injectable, signal } from '@angular/core';
import type { Task, TaskPayload } from '../models/task.model';
import type { QueryParams } from './api.service';
import { ApiService } from './api.service';

@Injectable({ providedIn: 'root' })
export class TaskService {
  private api = inject(ApiService);

  readonly tasks = signal<Task[]>([]);
  readonly loading = signal(false);

  load(params?: QueryParams) {
    this.loading.set(true);
    return this.api.get<Task[]>('/tasks', params).subscribe({
      next: (res) => {
        this.tasks.set(res);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  getAll(params?: QueryParams) {
    return this.api.get<Task[]>(`/tasks`, params);
  }

  create(payload: TaskPayload) {
    return this.api.post<Task>('/tasks', payload);
  }

  update(id: string, payload: TaskPayload) {
    return this.api.put<Task>(`/tasks/${id}`, payload);
  }

  remove(id: string) {
    return this.api.delete<{ message: string }>(`/tasks/${id}`);
  }
}
