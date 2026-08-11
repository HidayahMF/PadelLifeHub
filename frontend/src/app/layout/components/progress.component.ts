import { Component, computed, input } from '@angular/core';

@Component({
  selector: 'app-progress',
  standalone: true,
  host: { class: 'block' },
  template: `
    <div class="h-4 w-full overflow-hidden rounded-md border-2 border-ink bg-surface-2">
      <div
        class="h-full rounded-[3px] transition-all duration-300"
        [style.width.%]="value()"
        [style.background]="barColor()"
      ></div>
    </div>
  `,
})
export class ProgressComponent {
  readonly value = input<number>(0);
  readonly color = input<string>();

  protected readonly barColor = computed(() => {
    if (this.color()) return this.color();
    const v = this.value();
    if (v >= 100) return 'var(--color-success)';
    if (v > 70) return 'var(--color-primary)';
    if (v > 40) return 'var(--color-warning)';
    return 'var(--color-primary)';
  });
}
