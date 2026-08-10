import { Component, input } from '@angular/core';
import { ButtonComponent } from '../button/button.component';

@Component({
  selector: 'app-page-header',
  standalone: true,
  imports: [ButtonComponent],
  template: `
    <div class="mb-6 flex flex-wrap items-center justify-between gap-4">
      <div class="min-w-0">
        <h1 class="font-display text-3xl leading-tight text-ink">
          <span
            class="box-decoration-clone bg-primary px-2 py-0.5 shadow-[4px_4px_0_0_var(--color-ink)]"
            >{{ title() }}</span
          >
        </h1>
        @if (subtitle()) {
          <p class="mt-2.5 text-sm font-medium text-ink-soft">{{ subtitle() }}</p>
        }
      </div>
      <div class="flex items-center gap-2">
        <ng-content></ng-content>
        @if (actionLabel()) {
          <app-button [icon]="actionIcon()" (click)="action()()"> {{ actionLabel() }} </app-button>
        }
      </div>
    </div>
  `,
})
export class PageHeaderComponent {
  readonly title = input.required<string>();
  readonly subtitle = input('');
  readonly actionLabel = input('');
  readonly actionIcon = input('plus');
  readonly action = input.required<() => void>();
}
