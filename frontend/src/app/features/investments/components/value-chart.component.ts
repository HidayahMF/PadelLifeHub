import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

export interface ValuePoint {
  label: string;
  value: number;
  date?: string;
}

function compact(n: number): string {
  const abs = Math.abs(n);
  if (abs >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(1).replace(/\.0$/, '')}B`;
  if (abs >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace(/\.0$/, '')}jt`;
  if (abs >= 1_000) return `${(n / 1_000).toFixed(0)}rb`;
  return String(Math.round(n));
}

@Component({
  selector: 'app-value-chart',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block' },
  template: `
    <div class="w-full">
      @if (data().length === 0) {
        <div class="py-10 text-center text-sm text-ink-soft">No data yet</div>
      } @else {
        <svg viewBox="0 0 600 240" class="w-full" role="img" [attr.aria-label]="ariaLabel()">
          @for (line of gridlines(); track line.y) {
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
          <path [attr.d]="areaPath()" [attr.fill]="'url(#invGrad)'" opacity="0.35" />
          <path
            [attr.d]="linePath()"
            fill="none"
            [attr.stroke]="trendColor()"
            stroke-width="2.5"
            stroke-linecap="round"
            stroke-linejoin="round"
          />
          @for (pt of points(); track pt.i) {
            <circle
              [attr.cx]="pt.x"
              [attr.cy]="pt.y"
              r="4"
              fill="var(--color-surface)"
              [attr.stroke]="trendColor()"
              stroke-width="2.5"
            >
              <title>{{ pt.rawLabel }}: {{ pt.rawValue }}</title>
            </circle>
            <text
              [attr.x]="pt.x"
              [attr.y]="pt.y - 8"
              text-anchor="middle"
              fill="var(--color-ink-soft)"
              font-size="11"
              font-weight="600"
            >{{ pt.compactValue }}</text>
          }
          <defs>
            <linearGradient id="invGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" [attr.stop-color]="trendColor()" />
              <stop offset="100%" [attr.stop-color]="trendColor()" stop-opacity="0" />
            </linearGradient>
          </defs>
        </svg>
        @if (showLabels()) {
          <div class="mt-2 flex justify-between">
            @for (d of data(); track $index) {
              <span class="truncate text-center text-[11px] text-ink-faint">{{ d.label }}</span>
            }
          </div>
        }
      }
    </div>
  `,
})
export class ValueChartComponent {
  readonly data = input.required<ValuePoint[]>();
  readonly showLabels = input(true);
  readonly ariaLabel = input('Investment value chart');

  protected readonly trendColor = computed(() => {
    const d = this.data();
    if (!d.length) return 'var(--color-primary)';
    const first = d[0].value;
    const last = d[d.length - 1].value;
    if (last > first) return 'var(--color-success)';
    if (last < first) return 'var(--color-danger)';
    return 'var(--color-primary)';
  });

  protected readonly points = computed(() => {
    const data = this.data();
    if (!data.length) return [] as { i: number; x: number; y: number; compactValue: string; rawLabel: string; rawValue: string }[];
    const w = 600;
    const h = 200;
    const pad = 20;
    let min = Math.min(...data.map((d) => d.value), 0) || 0;
    const maxV = Math.max(...data.map((d) => d.value), 1);
    if (maxV === min) min = 0;
    const span = Math.max(maxV - min, 1);
    return data.map((d, i) => {
      const x = pad + (i * (w - pad * 2)) / Math.max(data.length - 1, 1);
      const y = h - pad - ((d.value - min) / span) * (h - pad * 2);
      return {
        i,
        x,
        y,
        compactValue: compact(d.value),
        rawLabel: d.label,
        rawValue: String(d.value),
      };
    });
  });

  protected readonly linePath = computed(() => {
    const pts = this.points();
    if (!pts.length) return '';
    return pts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
  });

  protected readonly areaPath = computed(() => {
    const pts = this.points();
    if (!pts.length) return '';
    const first = pts[0];
    const last = pts[pts.length - 1];
    return `${this.linePath()} L ${last.x} 200 L ${first.x} 200 Z`;
  });

  protected readonly gridlines = computed(() => [40, 100, 160].map((y) => ({ y })));
}
