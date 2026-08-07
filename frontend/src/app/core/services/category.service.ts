import { inject, Injectable, signal } from '@angular/core';
import type { Category } from '../models/finance.model';
import type { QueryParams } from './api.service';
import { ApiService } from './api.service';

@Injectable({ providedIn: 'root' })
export class CategoryService {
  private api = inject(ApiService);

  readonly categories = signal<Category[]>([]);
  readonly loading = signal(false);

  load(params?: QueryParams) {
    this.loading.set(true);
    return this.api.get<Category[]>('/categories', params).subscribe({
      next: (res) => {
        this.categories.set(res);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  getAll(params?: QueryParams) {
    return this.api.get<Category[]>(`/categories`, params);
  }

  create(payload: Partial<Category>) {
    return this.api.post<Category>('/categories', payload);
  }

  update(id: string, payload: Partial<Category>) {
    return this.api.put<Category>(`/categories/${id}`, payload);
  }

  remove(id: string) {
    return this.api.delete<{ message: string }>(`/categories/${id}`);
  }
}
