import { Component, input, output } from '@angular/core';

@Component({
  selector: 'app-toggle',
  standalone: true,
  imports: [],
  template: `
    <button
      type="button"
      role="switch"
      [attr.aria-checked]="model()"
      [attr.aria-label]="label()"
      (click)="change.emit(!model())"
      class="relative inline-flex h-6 w-11 shrink-0 items-center rounded-full border-2 border-ink shadow-[2px_2px_0_0_var(--color-ink)] transition-colors duration-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
      [style.background]="model() ? 'var(--color-primary)' : 'var(--color-surface-2)'"
    >
      <span
        class="inline-block h-5 w-5 transform rounded-full border-2 border-ink bg-surface transition-transform duration-200"
        [style.transform]="model() ? 'translateX(18px)' : 'translateX(2px)'"
      ></span>
    </button>
  `,
})
export class ToggleComponent {
  readonly model = input(false);
  readonly label = input('');
  readonly change = output<boolean>();
}
