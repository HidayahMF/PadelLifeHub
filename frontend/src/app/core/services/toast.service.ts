import { inject, Injectable, signal } from '@angular/core';
import { I18nService } from './i18n.service';

export type ToastType = 'success' | 'error' | 'info';

export interface Toast {
  id: number;
  type: ToastType;
  message: string;
  title?: string;
}

@Injectable({ providedIn: 'root' })
export class ToastService {
  private i18n = inject(I18nService);
  private t = this.i18n.t.bind(this.i18n);

  readonly toasts = signal<Toast[]>([]);
  private counter = 0;

  success(message: string, title?: string) {
    this.show(message, title ?? this.t('Done'), 'success');
  }

  error(message: string, title?: string) {
    this.show(message, title ?? this.t('Something went wrong'), 'error');
  }

  info(message: string, title?: string) {
    this.show(message, title ?? this.t('Heads up'), 'info');
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
