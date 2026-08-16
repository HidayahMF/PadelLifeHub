import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { CardComponent } from '../../layout/components/card.component';
import { StatCardComponent } from './components/stat-card.component';
import { SkeletonComponent } from '../../layout/components/skeleton.component';
import { LineChartComponent } from './components/line-chart.component';
import type { ChartPoint } from '../../core/models/chart.model';
import { DonutChartComponent, DonutSegment } from './components/donut-chart.component';
import { SegmentedComponent } from '../../layout/components/segmented.component';
import { InsightsComponent } from './components/insights.component';
import { DashboardService, InsightsService } from '../../core/services/data.service';
import type { InsightsData, Statistics } from '../../core/models/misc.model';
import { formatCurrency, formatDuration } from '../../core/utils/format';
import { getLocale } from '../../core/utils/locale';
import { I18nService } from '../../core/services/i18n.service';

type RangeKey = 'thisMonth' | 'lastMonth' | '7d' | '30d' | 'thisYear' | 'all';

const RANGE_OPTIONS: { value: RangeKey; label: string }[] = [
  { value: '7d', label: '7 days' },
  { value: '30d', label: '30 days' },
  { value: 'thisMonth', label: 'This month' },
  { value: 'lastMonth', label: 'Last month' },
  { value: 'thisYear', label: 'This year' },
  { value: 'all', label: 'All time' },
];

@Component({
  selector: 'app-statistics',
  standalone: true,
  imports: [
    CardComponent,
    StatCardComponent,
    SkeletonComponent,
    LineChartComponent,
    DonutChartComponent,
    SegmentedComponent,
    InsightsComponent,
  ],
  template: `
    <div class="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 class="text-2xl font-bold tracking-tight text-ink">{{ t('Statistics') }}</h1>
        <p class="mt-1 text-sm text-ink-soft">
          {{ t('Insights into your productivity and finances.') }}
        </p>
      </div>
      <app-segmented
        [options]="rangeOptions()"
        [model]="range()"
        (change)="setRange($event)"
      />
    </div>

    @if (loading()) {
      <div class="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-4">
        @for (_ of [1, 2, 3, 4]; track $index) { <app-skeleton size="button" class="rounded-card" /> }
      </div>
    } @else if (stats()) {
      <div class="mb-6 grid grid-cols-2 gap-5 xl:grid-cols-4">
        <app-stat-card [label]="t('Total tasks')" [value]="stats()!.productivity.totalTasks" icon="list-todo" />
        <app-stat-card [label]="t('Completed tasks')" [value]="stats()!.productivity.completedTasks" icon="circle-check" tone="success" />
        <app-stat-card [label]="t('Completed this week')" [value]="stats()!.productivity.weeklyCompleted" icon="trending-up" />
        <app-stat-card [label]="t('Completed this month')" [value]="stats()!.productivity.monthlyCompleted" icon="calendar-check" />
        <app-stat-card
          [label]="t('Focus today')"
          [value]="formatDuration(stats()!.focus.today.duration)"
          icon="timer"
        />
        <app-stat-card
          [label]="t('Focus this week')"
          [value]="formatDuration(stats()!.focus.week.duration)"
          icon="timer"
        />
        <app-stat-card
          [label]="t('Focus this month')"
          [value]="formatDuration(stats()!.focus.month.duration)"
          icon="timer"
        />
      </div>

      <div class="mb-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
        <app-card [padding]="'none'">
          <div class="px-5 pt-5">
            <h2 class="text-base font-semibold text-ink">{{ t('Weekly activity') }}</h2>
            <p class="text-xs text-ink-soft">{{ t('Tasks completed per day (last 7 days)') }}</p>
          </div>
          <div class="p-4">
            <app-line-chart [data]="weeklyActivity()" [attr.aria-label]="t('Weekly completed tasks')" />
          </div>
        </app-card>

        <app-card [padding]="'none'">
          <div class="px-5 pt-5">
            <h2 class="text-base font-semibold text-ink">{{ t('Cash flow') }}</h2>
            <p class="text-xs text-ink-soft">{{ rangeLabel() }}</p>
          </div>
          <div class="p-4">
            <app-line-chart [data]="cashFlow()" [attr.aria-label]="t('Cash flow')" />
          </div>
        </app-card>
      </div>

      <div class="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <app-card [padding]="'none'">
          <div class="px-5 pt-5">
            <h2 class="text-base font-semibold text-ink">{{ t('Spending by category') }}</h2>
            <p class="text-xs text-ink-soft">{{ rangeLabel() }}</p>
          </div>
          <div class="p-5">
            <app-donut-chart [segments]="categorySpending()" [totalLabel]="t('spent')" />
          </div>
        </app-card>

        <!-- Financial insights -->
        <app-card [padding]="'none'">
          <div class="p-5">
            @if (insightsLoading()) {
              <div class="space-y-3">
                @for (_ of [1, 2]; track $index) { <app-skeleton size="field" /> }
              </div>
            } @else {
              <app-insights [insights]="insights()" />
            }
          </div>
        </app-card>

        <app-card [padding]="'none'">
          <div class="px-5 pt-5">
            <h2 class="text-base font-semibold text-ink">{{ t('Financial summary') }}</h2>
            <p class="text-xs text-ink-soft">{{ rangeLabel() }}</p>
          </div>
          <div class="space-y-3 p-5">
            <div class="flex items-center justify-between rounded-card bg-surface-2 px-4 py-3">
              <span class="text-sm text-ink-soft">{{ t('Total income') }}</span>
              <span class="text-sm font-semibold text-success">{{ formatCurrency(stats()!.finance.totalIncome) }}</span>
            </div>
            <div class="flex items-center justify-between rounded-card bg-surface-2 px-4 py-3">
              <span class="text-sm text-ink-soft">{{ t('Total expenses') }}</span>
              <span class="text-sm font-semibold text-danger">{{ formatCurrency(stats()!.finance.totalExpense) }}</span>
            </div>
            <div class="flex items-center justify-between rounded-card bg-primary/10 px-4 py-3">
              <span class="text-sm font-medium text-ink">{{ t('Balance (all accounts)') }}</span>
              <span class="text-sm font-bold text-ink">{{ formatCurrency(stats()!.finance.balance) }}</span>
            </div>
            <p class="pt-1 text-xs text-ink-faint">
              {{ t('Balance is the current stored balance across your accounts, matching the Finance page.') }}
            </p>
            <p class="pt-1 text-xs text-ink-faint">
              {{ t('Completion rate: {rate}%', { rate: completionRate() }) }}
            </p>
          </div>
        </app-card>
      </div>
    }
  `,
})
export class StatisticsComponent implements OnInit {
  private service = inject(DashboardService);
  private insightsService = inject(InsightsService);
  private i18n = inject(I18nService);

  protected readonly t = this.i18n.t.bind(this.i18n);

  protected readonly stats = signal<Statistics | null>(null);
  protected readonly loading = signal(true);
  protected readonly range = signal<RangeKey>('thisMonth');
  protected readonly insights = signal<InsightsData | null>(null);
  protected readonly insightsLoading = signal(true);

  protected readonly rangeOptions = computed(() =>
    RANGE_OPTIONS.map((o) => ({ ...o, label: this.t(o.label) }))
  );

  protected readonly rangeLabel = computed(
    () => this.t(RANGE_OPTIONS.find((o) => o.value === this.range())?.label ?? 'This month')
  );

  protected readonly weeklyActivity = computed<ChartPoint[]>(() =>
    (this.stats()?.productivity.weeklyActivity ?? []).map((a) => ({
      label: new Date(a.date).toLocaleDateString(getLocale(), { weekday: 'short' }),
      value: a.completed,
    }))
  );

  protected readonly cashFlow = computed<ChartPoint[]>(() =>
    (this.stats()?.finance.monthlyCashFlow ?? []).map((c) => ({
      // Key is "MM-DD" for 7d/30d ranges and "MM" for longer ranges.
      label: c._id.slice(5),
      value: c.income - c.expense,
    }))
  );

  protected readonly categorySpending = computed<DonutSegment[]>(() => {
    const palette = [
      'var(--color-primary)',
      'var(--color-success)',
      'var(--color-warning)',
      'var(--color-danger)',
      'var(--color-ink)',
      'var(--color-ink-soft)',
    ];
    return (this.stats()?.finance.categorySpending ?? []).map((c, i) => ({
      label: c._id ?? this.t('Other'),
      value: c.total,
      color: palette[i % palette.length],
    }));
  });

  protected readonly completionRate = computed(() => {
    const p = this.stats()?.productivity;
    if (!p || p.totalTasks === 0) return 0;
    return Math.round((p.completedTasks / p.totalTasks) * 100);
  });

  ngOnInit(): void {
    this.loadRange();
    this.loadInsights();
  }

  private loadInsights(): void {
    this.insightsLoading.set(true);
    this.insightsService.get().subscribe({
      next: (res) => {
        this.insights.set(res);
        this.insightsLoading.set(false);
      },
      error: () => this.insightsLoading.set(false),
    });
  }

  protected setRange(value: string): void {
    this.range.set(value as RangeKey);
    this.loadRange();
  }

  private loadRange(): void {
    this.loading.set(true);
    this.service.statistics(this.range()).subscribe({
      next: (res) => {
        this.stats.set(res);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  protected readonly formatCurrency = formatCurrency;
  protected readonly formatDuration = formatDuration;
}
