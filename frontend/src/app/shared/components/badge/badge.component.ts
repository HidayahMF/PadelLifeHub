import { Component, computed, input } from '@angular/core';
import { NgClass } from '@angular/common';
import { IconComponent } from '../icon/icon.component';

export type BadgeTone = 'neutral' | 'success' | 'warning' | 'danger' | 'primary' | 'info';

@Component({
  selector: 'app-badge',
  standalone: true,
  imports: [NgClass, IconComponent],
  template: `
    <span
      class="inline-flex items-center gap-1 rounded-md border-2 border-ink px-2 py-0.5 text-xs font-bold whitespace-nowrap shadow-[2px_2px_0_0_var(--color-ink)]"
      [ngClass]="toneClass()"
    >
      <app-icon *ngIf="icon()" [name]="icon() ?? ''" [size]="12" [strokeWidth]="3" />
      <ng-content></ng-content>
    </span>
  `,
})
export class BadgeComponent {
  readonly tone = input<BadgeTone>('neutral');
  readonly icon = input<string>();

  protected readonly toneClass = computed(() => {
    switch (this.tone()) {
      case 'success':
        return 'bg-success text-ink';
      case 'warning':
        return 'bg-warning text-ink';
      case 'danger':
        return 'bg-danger text-white';
      case 'primary':
        return 'bg-primary text-ink';
      case 'info':
        return 'bg-accent text-white';
      default:
        return 'bg-surface-2 text-ink';
    }
  });
}
