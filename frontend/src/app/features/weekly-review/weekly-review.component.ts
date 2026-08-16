import { Component, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CardComponent } from '../../layout/components/card.component';
import { PageHeaderComponent } from '../../layout/components/page-header.component';
import { ButtonComponent } from '../../layout/components/button.component';
import { IconComponent } from '../../layout/components/icon.component';
import { ProgressComponent } from '../../layout/components/progress.component';
import { SkeletonComponent } from '../../layout/components/skeleton.component';
import { WeeklyReviewService } from '../../core/services/data.service';
import { ToastService } from '../../core/services/toast.service';
import { I18nService } from '../../core/services/i18n.service';
import type { WeeklyReviewData } from '../../core/models/misc.model';
import { formatCurrency, formatDate, formatDuration } from '../../core/utils/format';

@Component({
  selector: 'app-weekly-review',
  standalone: true,
  imports: [
    FormsModule,
    CardComponent,
    PageHeaderComponent,
    ButtonComponent,
    IconComponent,
    ProgressComponent,
    SkeletonComponent,
  ],
  template: `
    <app-page-header
      [title]="t('Weekly Review')"
      [subtitle]="t('Look back at your week, celebrate wins, and plan the next one.')"
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
      <!-- Week header -->
      <div class="mb-5 inline-flex items-center gap-2 rounded-card border-2 border-ink bg-primary px-4 py-2 shadow-soft">
        <app-icon name="calendar" [size]="16" />
        <span class="text-sm font-bold text-ink">{{ review.weekLabel }}</span>
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
          <p class="mt-2 text-xs text-ink-soft">{{ t('{n} habit(s) tracked this week.', { n: review.habits.tracked }) }}</p>
        </app-card>

        <!-- Finance -->
        <app-card>
          <h2 class="flex items-center gap-2 text-base font-bold text-ink">
            <app-icon name="wallet" [size]="18" /> {{ t('Finance') }}
          </h2>
          <div class="mt-4 grid grid-cols-3 gap-3">
            <div class="rounded-button border-2 border-ink bg-surface-2 p-3">
              <p class="text-xs font-bold uppercase tracking-wide text-ink-faint">{{ t('Income') }}</p>
              <p class="mt-1 truncate text-sm font-bold text-success">{{ formatCurrency(review.finance.income) }}</p>
            </div>
            <div class="rounded-button border-2 border-ink bg-surface-2 p-3">
              <p class="text-xs font-bold uppercase tracking-wide text-ink-faint">{{ t('Expense') }}</p>
              <p class="mt-1 truncate text-sm font-bold text-danger">{{ formatCurrency(review.finance.expense) }}</p>
            </div>
            <div class="rounded-button border-2 border-ink bg-surface-2 p-3">
              <p class="text-xs font-bold uppercase tracking-wide text-ink-faint">{{ t('Saved') }}</p>
              <p class="mt-1 truncate text-sm font-bold text-ink">{{ formatCurrency(review.finance.saved) }}</p>
            </div>
          </div>
          @if (review.topCategory) {
            <p class="mt-3 text-sm text-ink-soft">
              {{ t('Top spending: {name} ({amount})', { name: review.topCategory.name, amount: formatCurrency(review.topCategory.total) }) }}
            </p>
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
              <p class="text-xs font-bold uppercase tracking-wide text-ink-faint">Completed</p>
              <p class="mt-1 font-display text-2xl text-success">{{ review.goals.completed }}</p>
            </div>
          </div>
        </app-card>
      </div>

      <!-- Reflection -->
      <app-card class="mt-6">
        <h2 class="text-base font-bold text-ink">{{ t('Reflection') }}</h2>
        <p class="mt-1 text-xs text-ink-soft">{{ t('Saved privately to your account for this week.') }}</p>
        <div class="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
          <div class="space-y-1.5">
            <label class="block text-sm font-bold text-ink">{{ t('What went well?') }}</label>
            <textarea
              [(ngModel)]="wentWell"
              name="wentWell"
              rows="5"
              [placeholder]="t('Celebrate your wins this week…')"
              class="w-full resize-y rounded-field border-2 border-ink bg-surface px-3.5 py-2.5 text-sm font-medium text-ink placeholder:text-ink-faint focus:border-primary focus:shadow-soft focus:outline-none"
            ></textarea>
          </div>
          <div class="space-y-1.5">
            <label class="block text-sm font-bold text-ink">{{ t('What should you improve next week?') }}</label>
            <textarea
              [(ngModel)]="improve"
              name="improve"
              rows="5"
              [placeholder]="t('One small thing you’ll do differently…')"
              class="w-full resize-y rounded-field border-2 border-ink bg-surface px-3.5 py-2.5 text-sm font-medium text-ink placeholder:text-ink-faint focus:border-primary focus:shadow-soft focus:outline-none"
            ></textarea>
          </div>
        </div>
        <div class="mt-4 flex justify-end">
          <app-button icon="check" [loading]="saving()" (click)="save()">{{ t('Save review') }}</app-button>
        </div>
      </app-card>
    }
  `,
})
export class WeeklyReviewComponent implements OnInit {
  private service = inject(WeeklyReviewService);
  private toast = inject(ToastService);
  private i18n = inject(I18nService);

  protected readonly t = this.i18n.t.bind(this.i18n);

  protected readonly data = signal<WeeklyReviewData | null>(null);
  protected readonly loading = signal(true);
  protected readonly error = signal(false);
  protected readonly saving = signal(false);

  protected wentWell = '';
  protected improve = '';

  protected readonly noop = (): void => {};

  ngOnInit(): void {
    this.load();
  }

  protected load(): void {
    this.loading.set(true);
    this.error.set(false);
    this.service.get().subscribe({
      next: (res) => {
        this.data.set(res);
        this.wentWell = res.reflection?.wentWell ?? '';
        this.improve = res.reflection?.improve ?? '';
        this.loading.set(false);
      },
      error: () => {
        this.error.set(true);
        this.loading.set(false);
      },
    });
  }

  protected save(): void {
    const review = this.data();
    if (!review) return;
    this.saving.set(true);
    this.service
      .save({
        weekStart: review.weekStart,
        wentWell: this.wentWell.trim(),
        improve: this.improve.trim(),
      })
      .subscribe({
        next: () => {
          this.saving.set(false);
          this.toast.success(this.t('Review saved'));
        },
        error: (err: Error) => {
          this.saving.set(false);
          this.toast.error(err.message);
        },
      });
  }

  protected readonly formatCurrency = formatCurrency;
  protected readonly formatDate = formatDate;
  protected readonly formatDuration = formatDuration;
}
