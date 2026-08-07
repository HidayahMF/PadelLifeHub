import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { CardComponent } from '../../shared/components/card/card.component';
import { StatCardComponent } from '../../shared/components/stat-card/stat-card.component';
import { SkeletonComponent } from '../../shared/components/skeleton/skeleton.component';
import { LineChartComponent, ChartPoint } from '../../shared/components/chart/line-chart.component';
import { DonutChartComponent, DonutSegment } from '../../shared/components/chart/donut-chart.component';
import { DashboardService } from '../../core/services/data.service';
import type { Statistics } from '../../core/models/misc.model';
import { formatCurrency } from '../../core/utils/format';

@Component({
  selector: 'app-statistics',
  standalone: true,
  imports: [
    CardComponent,
    StatCardComponent,
    SkeletonComponent,
    LineChartComponent,
    DonutChartComponent,
  ],
  template: `
    <div class="mb-6">
      <h1 class="text-2xl font-bold tracking-tight text-ink">Statistics</h1>
      <p class="mt-1 text-sm text-ink-soft">Insights into your productivity and finances.</p>
    </div>

    @if (loading()) {
      <div class="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        @for (_ of [1, 2, 3, 4]; track $index) { <app-skeleton size="button" class="rounded-card" /> }
      </div>
    } @else if (stats()) {
      <div class="grid grid-cols-2 gap-4 xl:grid-cols-4">
        <app-stat-card label="Total tasks" [value]="stats()!.productivity.totalTasks" icon="list-todo" />
        <app-stat-card label="Completed tasks" [value]="stats()!.productivity.completedTasks" icon="circle-check" tone="success" />
        <app-stat-card label="Completed this week" [value]="stats()!.productivity.weeklyCompleted" icon="trending-up" />
        <app-stat-card label="Completed this month" [value]="stats()!.productivity.monthlyCompleted" icon="calendar-check" />
      </div>

      <div class="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <app-card>
          <div class="px-5 pt-5">
            <h2 class="text-base font-semibold text-ink">Weekly activity</h2>
            <p class="text-xs text-ink-soft">Tasks completed per day</p>
          </div>
          <div class="p-4">
            <app-line-chart [data]="weeklyActivity()" aria-label="Weekly completed tasks" />
          </div>
        </app-card>

        <app-card>
          <div class="px-5 pt-5">
            <h2 class="text-base font-semibold text-ink">Monthly cash flow</h2>
            <p class="text-xs text-ink-soft">Net balance per month</p>
          </div>
          <div class="p-4">
            <app-line-chart [data]="cashFlow()" aria-label="Monthly cash flow" />
          </div>
        </app-card>
      </div>

      <div class="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <app-card>
          <div class="px-5 pt-5">
            <h2 class="text-base font-semibold text-ink">Spending by category</h2>
            <p class="text-xs text-ink-soft">All time</p>
          </div>
          <div class="p-5">
            <app-donut-chart [segments]="categorySpending()" [totalLabel]="'spent'" />
          </div>
        </app-card>

        <app-card>
          <div class="px-5 pt-5">
            <h2 class="text-base font-semibold text-ink">Financial summary</h2>
            <p class="text-xs text-ink-soft">All time</p>
          </div>
          <div class="space-y-3 p-5">
            <div class="flex items-center justify-between rounded-card bg-surface-2 px-4 py-3">
              <span class="text-sm text-ink-soft">Total income</span>
              <span class="text-sm font-semibold text-success">{{ formatCurrency(stats()!.finance.totalIncome) }}</span>
            </div>
            <div class="flex items-center justify-between rounded-card bg-surface-2 px-4 py-3">
              <span class="text-sm text-ink-soft">Total expenses</span>
              <span class="text-sm font-semibold text-danger">{{ formatCurrency(stats()!.finance.totalExpense) }}</span>
            </div>
            <div class="flex items-center justify-between rounded-card bg-primary/10 px-4 py-3">
              <span class="text-sm font-medium text-ink">Net balance</span>
              <span class="text-sm font-bold text-ink">{{ formatCurrency(stats()!.finance.balance) }}</span>
            </div>
            <p class="pt-1 text-xs text-ink-faint">
              Completion rate: {{ completionRate() }}%
            </p>
          </div>
        </app-card>
      </div>
    }
  `,
})
export class StatisticsComponent implements OnInit {
  private service = inject(DashboardService);

  protected readonly stats = signal<Statistics | null>(null);
  protected readonly loading = signal(true);

  protected readonly weeklyActivity = computed<ChartPoint[]>(() =>
    (this.stats()?.productivity.weeklyActivity ?? []).map((a) => ({
      label: new Date(a.date).toLocaleDateString('en-US', { weekday: 'short' }),
      value: a.completed,
    }))
  );

  protected readonly cashFlow = computed<ChartPoint[]>(() =>
    (this.stats()?.finance.monthlyCashFlow ?? []).map((c) => ({
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
      label: c._id ?? 'Other',
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
    this.service.statistics().subscribe({
      next: (res) => {
        this.stats.set(res);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  protected readonly formatCurrency = formatCurrency;
}
