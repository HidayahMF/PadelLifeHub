import { Component, computed, input } from '@angular/core';
import { NgClass } from '@angular/common';
import { IconComponent } from '../icon/icon.component';

export type StatTone = 'default' | 'success' | 'danger' | 'warning' | 'primary';

@Component({
  selector: 'app-stat-card',
  standalone: true,
  imports: [NgClass, IconComponent],
  template: `
    <div
      class="rounded-card border-2 border-ink bg-surface p-5 shadow-card transition-all duration-200 hover:-translate-y-1"
    >
      <div class="flex items-start justify-between gap-3">
        <div class="min-w-0">
          <p class="truncate text-xs font-bold uppercase tracking-wider text-ink-soft">{{ label() }}</p>
          <p class="mt-1.5 text-2xl font-bold tracking-tight text-ink">{{ value() }}</p>
        </div>
        @if (icon()) {
          <span
            class="flex h-10 w-10 shrink-0 items-center justify-center rounded-[10px] border-2 border-ink shadow-[2px_2px_0_0_var(--color-ink)]"
            [ngClass]="toneClass()"
          >
            <app-icon [name]="icon() ?? ''" [size]="20" [strokeWidth]="2.4" />
          </span>
        }
      </div>
      @if (delta() !== null && delta() !== undefined) {
        <div class="mt-3 flex items-center gap-1.5 text-xs font-bold">
          <span
            class="rounded border-2 border-ink px-1 py-px"
            [ngClass]="deltaNum() >= 0 ? 'bg-success/20 text-ink' : 'bg-danger/20 text-ink'"
          >
            {{ deltaNum() >= 0 ? '▲' : '▼' }} {{ deltaAbs() }}%
          </span>
          <span class="font-medium text-ink-faint">vs last month</span>
        </div>
      }
    </div>
  `,
})
export class StatCardComponent {
  readonly label = input.required<string>();
  readonly value = input.required<string | number>();
  readonly icon = input<string>();
  readonly tone = input<StatTone>('default');
  readonly delta = input<number | null>(null);

  protected deltaNum(): number {
    return Number(this.delta() ?? 0);
  }

  protected deltaAbs(): number {
    return Math.abs(this.deltaNum());
  }

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
