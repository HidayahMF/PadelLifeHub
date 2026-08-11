import { Component, computed, input } from '@angular/core';
import type { ChartPoint } from '../../../core/models/chart.model';

@Component({
  selector: 'app-line-chart',
  standalone: true,
  host: { class: 'block' },
  template: `
    <div class="w-full">
      <svg
        viewBox="0 0 600 240"
        class="w-full"
        [attr.aria-label]="ariaLabel()"
        role="img"
      >
        @if (gridlines(); as lines) {
          @for (line of lines; track line.y) {
            <line
              x1="8"
              [attr.y1]="line.y"
              x2="592"
              [attr.y2]="line.y"
              stroke="var(--color-line)"
              stroke-width="1"
              stroke-dasharray="4 4"
            />
          }
        }
        <path [attr.d]="areaPath()" fill="url(#lcGrad)" opacity="0.35" />
        <path
          [attr.d]="linePath()"
          fill="none"
          stroke="var(--color-primary)"
          stroke-width="2.5"
          stroke-linecap="round"
          stroke-linejoin="round"
        />
        @for (pt of points(); track $index) {
          <circle
            [attr.cx]="pt.x"
            [attr.cy]="pt.y"
            r="4"
            fill="var(--color-surface)"
            stroke="var(--color-primary)"
            stroke-width="2.5"
          />
        }
        <defs>
          <linearGradient id="lcGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="var(--color-primary)" />
            <stop offset="100%" stop-color="var(--color-primary)" stop-opacity="0" />
          </linearGradient>
        </defs>
      </svg>
      @if (showLabels()) {
        <div class="mt-2 grid grid-cols-12 gap-1">
          @for (d of data(); track d.label) {
            <span class="truncate text-center text-[11px] text-ink-faint">{{ d.label }}</span>
          }
        </div>
      }
    </div>
  `,
})
export class LineChartComponent {
  readonly data = input.required<ChartPoint[]>();
  readonly showLabels = input(true);
  readonly ariaLabel = input('Line chart');

  protected readonly points = computed(() => {
    const data = this.data();
    if (!data.length) return [] as { x: number; y: number }[];
    const w = 600;
    const h = 200;
    const pad = 12;
    const max = Math.max(...data.map((d) => d.value), 1);
    return data.map((d, i) => ({
      x: pad + (i * (w - pad * 2)) / Math.max(data.length - 1, 1),
      y: h - pad - (d.value / max) * (h - pad * 2),
    }));
  });

  protected readonly linePath = computed(() => {
    const pts = this.points();
    if (!pts.length) return '';
    return pts
      .map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`)
      .join(' ');
  });

  protected readonly areaPath = computed(() => {
    const pts = this.points();
    if (!pts.length) return '';
    const first = pts[0];
    const last = pts[pts.length - 1];
    return `${this.linePath()} L ${last.x} 200 L ${first.x} 200 Z`;
  });

  protected readonly gridlines = computed(() => {
    return [40, 100, 160].map((y) => ({ y }));
  });
}
