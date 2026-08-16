import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { CardComponent } from '../../layout/components/card.component';
import { PageHeaderComponent } from '../../layout/components/page-header.component';
import { ButtonComponent } from '../../layout/components/button.component';
import { IconComponent } from '../../layout/components/icon.component';
import { ProgressComponent } from '../../layout/components/progress.component';
import { BadgeComponent } from '../../layout/components/badge.component';
import { SkeletonComponent } from '../../layout/components/skeleton.component';
import { MonthlyReviewService } from '../../core/services/data.service';
import { ToastService } from '../../core/services/toast.service';
import { I18nService } from '../../core/services/i18n.service';
import type { MonthlyReviewData } from '../../core/models/misc.model';
import { formatCurrency, formatDuration } from '../../core/utils/format';

@Component({
  selector: 'app-monthly-review',
  standalone: true,
  imports: [
    CardComponent,
    PageHeaderComponent,
    ButtonComponent,
    IconComponent,
    ProgressComponent,
    BadgeComponent,
    SkeletonComponent,
  ],
  template: `
    <app-page-header
      [title]="t('Monthly Review')"
      [subtitle]="t('A deeper look at your month — finances, productivity, habits and goals.')"
      actionLabel=""
      [action]="noop"
    ></app-page-header>

    @if (loading() && !data()) {
      <div class="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        @for (_ of [1, 2, 3, 4]; track $index) {
          <app-skeleton size="button" class="rounded-card" />
        }
      </div>
    } @else if (error() && !data()) {
      <app-card>
        <div class="flex flex-col items-center gap-3 py-10 text-center">
          <app-icon name="alert-circle" [size]="32" class="text-danger" />
          <p class="font-display text-lg text-ink">{{ t('Something went wrong') }}</p>
          <app-button variant="secondary" icon="refresh-cw" (click)="load()">{{ t('Try again') }}</app-button>
        </div>
      </app-card>
    } @else if (data(); as review) {
      <!-- Month header -->
      <div class="mb-5 inline-flex items-center gap-2 rounded-card border-2 border-ink bg-primary px-4 py-2 shadow-soft">
        <app-icon name="calendar" [size]="16" />
        <span class="text-sm font-bold text-ink">{{ review.monthLabel }}</span>
      </div>

      <!-- Finance overview -->
      <div class="mb-6 grid grid-cols-2 gap-4 xl:grid-cols-4">
        <div class="rounded-card border-2 border-ink bg-surface p-5 shadow-card">
          <p class="text-xs font-bold uppercase tracking-wider text-ink-soft">{{ t('Income') }}</p>
          <p class="mt-1.5 truncate text-2xl font-bold text-success">{{ formatCurrency(review.finance.income) }}</p>
          @if (review.finance.incomeChangePct !== 0) {
            <p class="mt-1 text-xs font-semibold text-ink-soft">
              {{ review.finance.incomeChangePct > 0 ? '▲' : '▼' }} {{ Math.abs(review.finance.incomeChangePct) }}%
              {{ t('vs last month') }}
            </p>
          }
        </div>
        <div class="rounded-card border-2 border-ink bg-surface p-5 shadow-card">
          <p class="text-xs font-bold uppercase tracking-wider text-ink-soft">{{ t('Expense') }}</p>
          <p class="mt-1.5 truncate text-2xl font-bold text-danger">{{ formatCurrency(review.finance.expense) }}</p>
          @if (review.finance.expenseChangePct !== 0) {
            <p class="mt-1 text-xs font-semibold text-ink-soft">
              {{ review.finance.expenseChangePct > 0 ? '▲' : '▼' }} {{ Math.abs(review.finance.expenseChangePct) }}%
              {{ t('vs last month') }}
            </p>
          }
        </div>
        <div class="rounded-card border-2 border-ink bg-surface p-5 shadow-card">
          <p class="text-xs font-bold uppercase tracking-wider text-ink-soft">{{ t('Net cash flow') }}</p>
          <p
            class="mt-1.5 truncate text-2xl font-bold"
            [class.text-success]="review.finance.saved >= 0"
            [class.text-danger]="review.finance.saved < 0"
          >
            {{ formatCurrency(review.finance.saved) }}
          </p>
        </div>
        <div class="rounded-card border-2 border-ink bg-surface p-5 shadow-card">
          <p class="text-xs font-bold uppercase tracking-wider text-ink-soft">{{ t('Net worth') }}</p>
          <p class="mt-1.5 truncate text-2xl font-bold text-ink">{{ formatCurrency(review.netWorth.total) }}</p>
          <p class="mt-1 text-xs font-semibold text-ink-soft">
            {{ t('Liquid') }} {{ formatCurrency(review.netWorth.liquid) }} · {{ t('Investment') }}
            {{ formatCurrency(review.netWorth.investment) }}
          </p>
        </div>
      </div>

      <div class="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <!-- Productivity -->
        <app-card>
          <h2 class="flex items-center gap-2 text-base font-bold text-ink">
            <app-icon name="list-todo" [size]="18" /> {{ t('Productivity') }}
          </h2>
          <div class="mt-4 grid grid-cols-2 gap-3">
            <div class="rounded-button border-2 border-ink bg-surface-2 p-3">
              <p class="text-xs font-bold uppercase tracking-wide text-ink-faint">{{ t('Completed') }}</p>
              <p class="mt-1 font-display text-2xl text-success">{{ review.productivity.completed }}</p>
            </div>
            <div class="rounded-button border-2 border-ink bg-surface-2 p-3">
              <p class="text-xs font-bold uppercase tracking-wide text-ink-faint">{{ t('Created') }}</p>
              <p class="mt-1 font-display text-2xl text-ink">{{ review.productivity.created }}</p>
            </div>
            <div class="rounded-button border-2 border-ink bg-surface-2 p-3">
              <p class="text-xs font-bold uppercase tracking-wide text-ink-faint">{{ t('Overdue now') }}</p>
              <p class="mt-1 font-display text-2xl" [class.text-danger]="review.productivity.overdue > 0">
                {{ review.productivity.overdue }}
              </p>
            </div>
            <div class="rounded-button border-2 border-ink bg-surface-2 p-3">
              <p class="text-xs font-bold uppercase tracking-wide text-ink-faint">{{ t('Completion') }}</p>
              <p class="mt-1 font-display text-2xl text-ink">{{ review.productivity.completionRate }}%</p>
            </div>
          </div>
          <app-progress class="mt-4" [value]="review.productivity.completionRate" />
          <div class="mt-4 grid grid-cols-2 gap-3">
            <div class="rounded-button border-2 border-ink bg-surface-2 p-3">
              <p class="text-xs font-bold uppercase tracking-wide text-ink-faint">{{ t('Focus time') }}</p>
              <p class="mt-1 font-display text-2xl text-ink">{{ formatDuration(review.focus.duration) }}</p>
            </div>
            <div class="rounded-button border-2 border-ink bg-surface-2 p-3">
              <p class="text-xs font-bold uppercase tracking-wide text-ink-faint">{{ t('Sessions') }}</p>
              <p class="mt-1 font-display text-2xl text-ink">{{ review.focus.count }}</p>
            </div>
          </div>
        </app-card>

        <!-- Habits -->
        <app-card>
          <h2 class="flex items-center gap-2 text-base font-bold text-ink">
            <app-icon name="flame" [size]="18" /> {{ t('Habits') }}
          </h2>
          <div class="mt-4 grid grid-cols-2 gap-3">
            <div class="rounded-button border-2 border-ink bg-surface-2 p-3">
              <p class="text-xs font-bold uppercase tracking-wide text-ink-faint">{{ t('Best streak') }}</p>
              <p class="mt-1 font-display text-2xl text-secondary">
                {{ review.habits.bestStreak }}<span class="text-sm">d</span>
              </p>
            </div>
            <div class="rounded-button border-2 border-ink bg-surface-2 p-3">
              <p class="text-xs font-bold uppercase tracking-wide text-ink-faint">{{ t('Avg completion') }}</p>
              <p class="mt-1 font-display text-2xl text-ink">{{ review.habits.averageCompletion }}%</p>
            </div>
          </div>
          <app-progress class="mt-4" [value]="review.habits.averageCompletion" color="var(--color-secondary)" />
          <p class="mt-2 text-xs text-ink-soft">{{ t('{n} habit(s) tracked this month.', { n: review.habits.tracked }) }}</p>
        </app-card>

        <!-- Top spending categories -->
        <app-card>
          <h2 class="flex items-center gap-2 text-base font-bold text-ink">
            <app-icon name="receipt" [size]="18" /> {{ t('Top spending') }}
          </h2>
          @if (review.topCategories.length === 0) {
            <p class="mt-4 py-4 text-center text-sm text-ink-soft">{{ t('No spending recorded this month.') }}</p>
          } @else {
            <ul class="mt-4 space-y-2.5">
              @for (cat of review.topCategories; track cat.name) {
                <li class="flex items-center gap-2 text-sm">
                  <span class="h-2.5 w-2.5 shrink-0 rounded-full" [style.background]="cat.color"></span>
                  <span class="min-w-0 flex-1 truncate font-medium text-ink">{{ cat.name }}</span>
                  <span class="shrink-0 font-semibold text-ink">{{ formatCurrency(cat.total) }}</span>
                </li>
              }
            </ul>
          }
        </app-card>

        <!-- Budget performance -->
        <app-card>
          <h2 class="flex items-center gap-2 text-base font-bold text-ink">
            <app-icon name="gauge" [size]="18" /> {{ t('Budget performance') }}
          </h2>
          @if (review.budgetPerformance.length === 0) {
            <p class="mt-4 py-4 text-center text-sm text-ink-soft">{{ t('No budgets set this month.') }}</p>
          } @else {
            <div class="mt-4 space-y-4">
              @for (b of review.budgetPerformance; track b.name) {
                <div>
                  <div class="mb-1.5 flex items-center gap-2 text-sm">
                    <span class="min-w-0 flex-1 truncate font-medium text-ink">{{ b.name }}</span>
                    @if (b.over) {
                      <app-badge tone="danger">{{ t('Over') }}</app-badge>
                    }
                    <span class="shrink-0 text-xs text-ink-soft">
                      {{ formatCurrency(b.spent) }} / {{ formatCurrency(b.amount) }}
                    </span>
                  </div>
                  <app-progress [value]="Math.round(b.pct)" [color]="b.over ? 'var(--color-danger)' : undefined" />
                </div>
              }
            </div>
          }
        </app-card>

        <!-- Goals -->
        <app-card>
          <h2 class="flex items-center gap-2 text-base font-bold text-ink">
            <app-icon name="target" [size]="18" /> {{ t('Goals') }}
          </h2>
          <div class="mt-4 grid grid-cols-2 gap-3">
            <div class="rounded-button border-2 border-ink bg-surface-2 p-3">
              <p class="text-xs font-bold uppercase tracking-wide text-ink-faint">{{ t('Progressed') }}</p>
              <p class="mt-1 font-display text-2xl text-ink">{{ review.goals.progressed }}</p>
            </div>
            <div class="rounded-button border-2 border-ink bg-surface-2 p-3">
              <p class="text-xs font-bold uppercase tracking-wide text-ink-faint">{{ t('Completed') }}</p>
              <p class="mt-1 font-display text-2xl text-success">{{ review.goals.completed }}</p>
            </div>
          </div>
        </app-card>

        <!-- AI summary -->
        <app-card>
          <div class="flex items-center justify-between gap-3">
            <h2 class="flex items-center gap-2 text-base font-bold text-ink">
              <app-icon name="sparkles" [size]="18" /> {{ t('AI monthly summary') }}
            </h2>
            <app-button
              size="sm"
              variant="secondary"
              icon="bot"
              [loading]="aiLoading()"
              [disabled]="aiLoading()"
              (click)="generateSummary()"
            >
              {{ aiReply() ? t('Regenerate') : t('Generate') }}
            </app-button>
          </div>
          @if (aiLoading()) {
            <div class="mt-4 space-y-3">
              @for (_ of [1, 2, 3]; track $index) { <app-skeleton size="field" /> }
            </div>
          } @else if (aiReply()) {
            <div class="prose-sm mt-4 rounded-card border-2 border-ink bg-surface-2/60 p-4 text-sm leading-relaxed text-ink">
              {{ aiReply() }}
            </div>
          } @else {
            <p class="mt-4 text-sm text-ink-soft">
              {{ t('Generate a concise review of what went well, what needs attention, the biggest change, and next month’s priorities — based only on your recorded data.') }}
            </p>
          }
        </app-card>
      </div>
    }
  `,
})
export class MonthlyReviewComponent implements OnInit {
  private service = inject(MonthlyReviewService);
  private toast = inject(ToastService);
  private i18n = inject(I18nService);

  protected readonly t = this.i18n.t.bind(this.i18n);

  protected readonly data = signal<MonthlyReviewData | null>(null);
  protected readonly loading = signal(true);
  protected readonly error = signal(false);
  protected readonly aiLoading = signal(false);
  protected readonly aiReply = signal('');

  protected readonly noop = (): void => {};

  protected readonly Math = Math;

  ngOnInit(): void {
    this.load();
  }

  protected load(): void {
    this.loading.set(true);
    this.error.set(false);
    this.service.get().subscribe({
      next: (res) => {
        this.data.set(res);
        this.loading.set(false);
      },
      error: () => {
        this.error.set(true);
        this.loading.set(false);
      },
    });
  }

  protected generateSummary(): void {
    const review = this.data();
    if (!review || this.aiLoading()) return;
    this.aiLoading.set(true);
    this.aiReply.set('');
    this.service.aiSummary(review.month).subscribe({
      next: (res) => {
        this.aiLoading.set(false);
        this.aiReply.set(res.reply);
      },
      error: (err: Error) => {
        this.aiLoading.set(false);
        this.toast.error(err.message);
      },
    });
  }

  protected readonly formatCurrency = formatCurrency;
  protected readonly formatDuration = formatDuration;
}
