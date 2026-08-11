import { Component, computed, input, output } from '@angular/core';
import { NgClass } from '@angular/common';

export interface ToggleOption {
  value: string;
  label: string;
  icon?: string;
}

@Component({
  selector: 'app-segmented',
  standalone: true,
  imports: [NgClass],
  host: { class: 'block' },
  template: `
    <div
      role="tablist"
      class="inline-flex items-center gap-1 rounded-button border-2 border-ink bg-surface-2 p-1 shadow-soft"
    >
      @for (opt of options(); track opt.value) {
        <button
          type="button"
          role="tab"
          [attr.aria-selected]="model() === opt.value"
          (click)="select(opt.value)"
          class="flex items-center gap-1.5 rounded-[8px] px-3 py-1.5 text-sm transition-all duration-150"
          [ngClass]="
            model() === opt.value
              ? 'bg-primary font-bold text-ink shadow-[2px_2px_0_0_var(--color-ink)]'
              : 'font-medium text-ink-soft hover:text-ink'
          "
        >
          {{ opt.label }}
        </button>
      }
    </div>
  `,
})
export class SegmentedComponent {
  readonly options = input.required<ToggleOption[]>();
  readonly model = input.required<string>();
  readonly change = output<string>();

  protected select(value: string): void {
    if (value !== this.model()) {
      this.change.emit(value);
    }
  }
}
