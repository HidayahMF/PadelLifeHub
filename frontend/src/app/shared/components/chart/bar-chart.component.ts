import { Component, computed, input } from '@angular/core';
import { ChartPoint } from './line-chart.component';

@Component({
  selector: 'app-bar-chart',
  standalone: true,
  template: `
    <div class="w-full">
      <svg
        viewBox="0 0 600 240"
        class="w-full"
        [attr.aria-label]="ariaLabel()"
        role="img"
      >
        @for (line of gridlines(); track line.y) {
          <line
            x1="8"
            [attr.y1]="line.y"
            x2="592"
            [attr.y2]="line.y"
            stroke="var(--color-line)"
            stroke-width="1.5"
            stroke-dasharray="6 6"
          />
        }
        @for (bar of bars(); track bar.x) {
          <rect
            [attr.x]="bar.x"
            [attr.y]="bar.y"
            [attr.width]="barWidth()"
            [attr.height]="bar.height"
            rx="4"
            fill="var(--color-primary)"
            stroke="var(--color-ink)"
            stroke-width="2"
          >
            <title>{{ bar.label }}: {{ bar.value }}</title>
          </rect>
        }
      </svg>
      @if (showLabels()) {
        <div class="mt-2 grid grid-cols-12 gap-1">
          @for (d of data(); track d.label) {
            <span class="truncate text-center text-[11px] font-medium text-ink-faint">{{ d.label }}</span>
          }
        </div>
      }
    </div>
  `,
})
export class BarChartComponent {
  readonly data = input.required<ChartPoint[]>();
  readonly showLabels = input(true);
  readonly ariaLabel = input('Bar chart');

  protected readonly barWidth = computed(() => {
    const n = this.data().length;
    const available = 592 - 12;
    const group = available / Math.max(n, 1);
    return Math.max(group * 0.55, 6);
  });

  protected readonly bars = computed(() => {
    const data = this.data();
    if (!data.length) return [] as { x: number; y: number; height: number; label: string; value: number }[];
    const max = Math.max(...data.map((d) => d.value), 1);
    const n = data.length;
    const group = 584 / Math.max(n, 1);
    return data.map((d, i) => ({
      x: 12 + i * group + (group - this.barWidth()) / 2,
      y: 200 - (d.value / max) * 180 - 4,
      height: Math.max((d.value / max) * 180, 2),
      label: d.label,
      value: d.value,
    }));
  });

  protected readonly gridlines = computed(() => {
    return [40, 100, 160].map((y) => ({ y }));
  });
}
