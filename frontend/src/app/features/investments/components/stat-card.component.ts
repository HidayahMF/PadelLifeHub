import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { NgClass } from '@angular/common';
import { IconComponent } from '../../../layout/components/icon.component';

export type StatTone = 'default' | 'success' | 'danger' | 'warning' | 'primary';

@Component({
  selector: 'app-stat-card',
  standalone: true,
  imports: [NgClass, IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block min-w-0' },
  template: `
    <div
      class="min-w-0 overflow-hidden rounded-card border-2 border-ink bg-surface p-4 shadow-card transition-all duration-200 hover:-translate-y-1 sm:p-5"
    >
      <div class="flex items-start justify-between gap-2 sm:gap-3">
        <p
          class="min-w-0 break-words text-[11px] leading-snug font-bold uppercase tracking-wider text-ink-soft sm:truncate sm:text-xs"
          >{{ label() }}</p
        >
        @if (icon()) {
          <span
            class="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border-2 border-ink shadow-[2px_2px_0_0_var(--color-ink)] sm:h-10 sm:w-10 sm:rounded-[10px]"
            [ngClass]="toneClass()"
          >
            <app-icon [name]="icon() ?? ''" [size]="20" [strokeWidth]="2.4" />
          </span>
        }
      </div>
      <p
        class="mt-2 text-lg leading-tight font-bold tracking-tight whitespace-nowrap text-ink tabular-nums sm:mt-1.5 sm:text-xl xl:text-2xl"
        >{{ value() }}</p
      >
    </div>
  `,
})
export class StatCardComponent {
  readonly label = input.required<string>();
  readonly value = input.required<string | number>();
  readonly icon = input<string>();
  readonly tone = input<StatTone>('default');

  protected readonly toneClass = computed(() => {
    switch (this.tone()) {
      case 'success':
        return 'bg-success text-ink';
      case 'danger':
        return 'bg-danger text-white';
      case 'warning':
        return 'bg-warning text-ink';
      case 'primary':
        return 'bg-primary text-ink';
      default:
        return 'bg-surface-2 text-ink';
    }
  });
}
