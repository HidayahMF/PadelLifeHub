import { Component, input } from '@angular/core';
import { IconComponent } from '../icon/icon.component';
import { ButtonComponent } from '../button/button.component';

@Component({
  selector: 'app-error-state',
  standalone: true,
  imports: [IconComponent, ButtonComponent],
  template: `
    <div class="flex flex-col items-center justify-center gap-3 py-12 text-center">
      <div
        class="flex h-16 w-16 items-center justify-center rounded-[14px] border-2 border-ink bg-danger/10 text-danger shadow-soft"
      >
        <app-icon name="alert-circle" [size]="28" [strokeWidth]="1.8" />
      </div>
      <div class="space-y-1">
        <p class="font-display text-lg text-ink">Something went wrong</p>
        <p class="mx-auto max-w-xs text-sm font-medium text-ink-soft">{{ message() }}</p>
      </div>
      <app-button class="mt-2" size="sm" variant="secondary" icon="refresh-cw" (click)="retry()()">
        Try again
      </app-button>
    </div>
  `,
})
export class ErrorStateComponent {
  readonly message = input('We couldn’t load this data. Please try again.');
  readonly retry = input.required<() => void>();
}
