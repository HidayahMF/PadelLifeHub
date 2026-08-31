import { Component, computed, input } from '@angular/core';
import type { ChartPoint } from '../../../core/models/chart.model';

export interface GroupedPoint {
  label: string;
  income: number;
  expense: number;
}

/** Compact IDR label, e.g. 1.5jt / 250rb — fits on the chart without spilling. */
function compact(value: number): string {
  const abs = Math.abs(value);
  if (abs >= 1_000_000_000) return `${(value / 1_000_000_000).toFixed(1).replace(/\.0$/, '')}m`;
  if (abs >= 1_000_000) return `${(value / 1_000_000).toFixed(1).replace(/\.0$/, '')}jt`;
  if (abs >= 1_000) return `${(value / 1_000).toFixed(0)}rb`;
  return String(Math.round(value));
}

@Component({
  selector: 'app-bar-chart',
  standalone: true,
  host: { class: 'block' },
  template: `
    <div class="w-full">
      @if (legend()) {
        <div class="mb-3 flex items-center justify-center gap-5 text-xs font-medium text-ink-soft">
          <span class="flex items-center gap-1.5">
            <span class="inline-block h-2.5 w-2.5 rounded-sm" style="background: var(--color-success)"></span>
            {{ legend()!.income }}
          </span>
          <span class="flex items-center gap-1.5">
            <span class="inline-block h-2.5 w-2.5 rounded-sm" style="background: var(--color-danger)"></span>
            {{ legend()!.expense }}
          </span>
        </div>
      }
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
        @for (bar of bars(); track bar.id) {
          <rect
            [attr.x]="bar.x"
            [attr.y]="bar.y"
            [attr.width]="bar.width"
            [attr.height]="bar.height"
            rx="3"
            [attr.fill]="bar.income ? 'var(--color-success)' : 'var(--color-danger)'"
            stroke="var(--color-ink)"
            stroke-width="1.5"
          >
            <title>{{ bar.label }}: {{ compact(bar.value) }}</title>
          </rect>
          @if (bar.showValue) {
            <text
              [attr.x]="bar.x + bar.width / 2"
              [attr.y]="bar.y - 5"
              text-anchor="middle"
              fill="var(--color-ink-soft)"
              font-size="11"
              font-weight="600"
            >{{ compact(bar.value) }}</text>
          }
        }
      </svg>
      @if (showLabels()) {
        <div class="mt-2 flex justify-between">
          @for (d of labels(); track $index) {
            <span class="w-full truncate text-center text-[11px] font-medium text-ink-faint">{{ d }}</span>
          }
        </div>
      }
    </div>
  `,
})
export class BarChartComponent {
  readonly data = input<ChartPoint[]>([]);
  readonly showLabels = input(true);
  readonly showValues = input(true);
  readonly legend = input<{ income: string; expense: string } | null>(null);
  readonly ariaLabel = input('Bar chart');

  /** Grouped (income vs expense) data, when provided, takes precedence. */
  readonly grouped = input<GroupedPoint[] | null>(null);

  protected readonly compact = compact;

  protected readonly labels = computed(() => {
    const grouped = this.grouped() ?? [];
    return grouped.length ? grouped.map((g) => g.label) : this.data().map((d) => d.label);
  });

  protected readonly barWidth = computed(() => {
    const n = (this.grouped()?.length ?? this.data().length) || 1;
    const available = 592 - 24;
    const group = available / Math.max(n, 1);
    return Math.max(group * 0.28, 4);
  });

  protected readonly bars = computed(() => {
    const grouped = this.grouped();
    if (grouped?.length) {
      const max = Math.max(1, ...grouped.flatMap((g) => [g.income, g.expense]));
      const n = grouped.length;
      const group = 584 / Math.max(n, 1);
      const w = this.barWidth();
      const out: {
        id: string; x: number; y: number; width: number; height: number;
        income: boolean; label: string; value: number; showValue: boolean;
      }[] = [];
      grouped.forEach((g, i) => {
        const baseX = 12 + i * group + (group - w * 2) / 2;
        for (const bar of [
          { income: true, value: g.income },
          { income: false, value: g.expense },
        ] as const) {
          const height = Math.max((bar.value / max) * 176, 2);
          const x = baseX + (bar.income ? 0 : w);
          out.push({
            id: `${i}-${bar.income ? 'in' : 'ex'}`,
            x,
            y: 204 - height - 2,
            width: w,
            height,
            income: bar.income,
            label: g.label,
            value: bar.value,
            showValue: this.showValues() && bar.value > 0 && (bar.value / max) * 176 > 18,
          });
        }
      });
      return out;
    }

    const data = this.data();
    if (!data.length) return [] as { id: string; x: number; y: number; width: number; height: number; income: boolean; label: string; value: number; showValue: boolean }[];
    const max = Math.max(...data.map((d) => d.value), 1);
    const n = data.length;
    const group = 584 / Math.max(n, 1);
    const w = Math.max(group * 0.45, 6);
    return data.map((d, i) => {
      const height = Math.max((d.value / max) * 176, 2);
      return {
        id: `s-${i}`,
        x: 12 + i * group + (group - w) / 2,
        y: 204 - height - 2,
        width: w,
        height,
        income: true,
        label: d.label,
        value: d.value,
        showValue: this.showValues() && d.value > 0 && (d.value / max) * 176 > 18,
      };
    });
  });

  protected readonly gridlines = computed(() => {
    return [40, 100, 160].map((y) => ({ y }));
  });
}
