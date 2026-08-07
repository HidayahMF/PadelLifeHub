import { Injectable, signal } from '@angular/core';

export type ToastType = 'success' | 'error' | 'info';

export interface Toast {
  id: number;
  type: ToastType;
  message: string;
  title?: string;
}

@Injectable({ providedIn: 'root' })
export class ToastService {
  readonly toasts = signal<Toast[]>([]);
  private counter = 0;

  success(message: string, title = 'Done') {
    this.show(message, title, 'success');
  }

  error(message: string, title = 'Something went wrong') {
    this.show(message, title, 'error');
  }

  info(message: string, title = 'Heads up') {
    this.show(message, title, 'info');
  }

  dismiss(id: number) {
    this.toasts.update((list) => list.filter((t) => t.id !== id));
  }

  private show(message: string, title: string, type: ToastType) {
    const toast: Toast = { id: ++this.counter, message, title, type };
    this.toasts.update((list) => [...list, toast]);
    setTimeout(() => this.dismiss(toast.id), 3500);
  }
}
