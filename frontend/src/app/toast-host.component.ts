import { Component, inject } from '@angular/core';
import { ToastService } from './core/services/toast.service';
import { NgClass } from '@angular/common';
import { IconComponent } from './layout/components/icon.component';

@Component({
  selector: 'app-toast-host',
  standalone: true,
  imports: [NgClass, IconComponent],
  template: `
    <div
      class="pointer-events-none fixed inset-x-4 top-4 z-[100] flex flex-col gap-2 sm:inset-x-auto sm:right-4 sm:w-96"
      aria-live="polite"
    >
      @for (toast of toasts(); track toast.id) {
        <div
          class="pointer-events-auto flex items-start gap-3 rounded-card border-2 border-ink bg-surface p-4 shadow-pop animate-slide-in-right"
          role="alert"
          [ngClass]="{ 'border-danger!': toast.type === 'error' }"
        >
          <span
            class="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-[8px] border-2 border-ink"
            [style.background]="iconBg(toast.type)"
            [style.color]="iconColor(toast.type)"
          >
            <app-icon
              [name]="toast.type === 'success' ? 'check' : toast.type === 'error' ? 'alert-circle' : 'info'"
              [size]="15"
              [strokeWidth]="3"
            />
          </span>
          <div class="min-w-0 flex-1">
            <p class="text-sm font-bold text-ink">{{ toast.title }}</p>
            <p class="mt-0.5 text-sm font-medium text-ink-soft">{{ toast.message }}</p>
          </div>
          <button
            (click)="dismiss(toast.id)"
            class="rounded-[8px] border-2 border-transparent p-1 text-ink-faint transition-colors hover:border-ink hover:bg-surface-2 hover:text-ink"
            aria-label="Dismiss notification"
          >
            <app-icon name="x" [size]="16" />
          </button>
        </div>
      }
    </div>
  `,
})
export class ToastHostComponent {
  private toastService = inject(ToastService);
  protected readonly toasts = this.toastService.toasts;

  protected iconBg(type: string): string {
    if (type === 'success') return 'var(--color-success)';
    if (type === 'error') return 'var(--color-danger)';
    return 'var(--color-ink)';
  }

  protected iconColor(type: string): string {
    if (type === 'success' || type === 'info') return 'var(--color-ink)';
    return '#ffffff';
  }

  protected dismiss(id: number): void {
    this.toastService.dismiss(id);
  }
}
