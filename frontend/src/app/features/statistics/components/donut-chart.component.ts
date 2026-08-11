// Feature-local copy (duplicated per feature by design — no global shared/components).

import { Component, computed, input } from '@angular/core';

export interface DonutSegment {
  label: string;
  value: number;
  color: string;
}

@Component({
  selector: 'app-donut-chart',
  standalone: true,
  host: { class: 'block' },
  template: `
    <div class="flex flex-wrap items-center justify-center gap-6">
      <div class="relative">
        <svg viewBox="0 0 120 120" class="h-36 w-36" [attr.aria-label]="ariaLabel()" role="img">
          <circle cx="60" cy="60" r="48" fill="none" stroke="var(--color-surface-2)" stroke-width="14" />
          @for (arc of arcs(); track arc.label) {
            <circle
              cx="60"
              cy="60"
              r="48"
              fill="none"
              [attr.stroke]="arc.color"
              stroke-width="14"
              [attr.stroke-dasharray]="arc.length"
              [attr.stroke-dashoffset]="arc.offset"
              transform="rotate(-90 60 60)"
            >
              <title>{{ arc.label }}: {{ arc.value }}</title>
            </circle>
          }
          <text
            x="60"
            y="56"
            text-anchor="middle"
            class="fill-ink"
            style="font-size:18px;font-weight:700"
          >
            {{ total() }}
          </text>
          <text x="60" y="74" text-anchor="middle" class="fill-ink-soft" style="font-size:9px">
            {{ totalLabel() }}
          </text>
        </svg>
      </div>
      @if (showLegend()) {
        <ul class="space-y-2">
          @for (seg of segments(); track seg.label) {
            <li class="flex min-w-0 items-center gap-2 text-sm text-ink">
              <span class="h-2.5 w-2.5 shrink-0 rounded-full" [style.background]="seg.color"></span>
              <span class="min-w-0 break-words">{{ seg.label }}</span>
              <span class="ml-1 shrink-0 font-medium text-ink-soft">{{ seg.value }}</span>
            </li>
          }
        </ul>
      }
    </div>
  `,
})
export class DonutChartComponent {
  readonly segments = input.required<DonutSegment[]>();
  readonly totalLabel = input('');
  readonly showLegend = input(true);
  readonly ariaLabel = input('Donut chart');

  protected readonly total = computed(() =>
    this.segments().reduce((sum, s) => sum + s.value, 0)
  );

  protected readonly arcs = computed(() => {
    const segs = this.segments();
    const total = Math.max(segs.reduce((s, x) => s + x.value, 0), 1);
    const C = 2 * Math.PI * 48;
    let offset = 0;
    return segs.map((seg) => {
      const length = (seg.value / total) * C;
      const start = offset;
      offset += length;
      return { ...seg, length, offset: -start };
    });
  });
}
