import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { Router } from '@angular/router';
import { DatePipe, NgClass } from '@angular/common';
import { CardComponent } from '../../shared/components/card/card.component';
import { StatCardComponent } from '../../shared/components/stat-card/stat-card.component';
import { ButtonComponent } from '../../shared/components/button/button.component';
import { IconComponent } from '../../shared/components/icon/icon.component';
import { ProgressComponent } from '../../shared/components/progress/progress.component';
import { SkeletonComponent } from '../../shared/components/skeleton/skeleton.component';
import { BarChartComponent } from '../../shared/components/chart/bar-chart.component';
import type { ChartPoint } from '../../shared/components/chart/line-chart.component';
import { DashboardService } from '../../core/services/data.service';
import { HabitService, WishlistService } from '../../core/services/lifestyle.service';
import { BudgetService, TransactionService } from '../../core/services/finance.service';
import { AuthService } from '../../core/services/auth.service';
import type { DashboardSummary, TaskSummary } from '../../core/models/misc.model';
import type { Budget } from '../../core/models/finance.model';
import type { Habit } from '../../core/models/lifestyle.model';
import {
  formatCurrency,
  formatDate,
  isOverdue,
  isToday,
  monthKey,
  percent,
  relativeDay,
  toDate,
} from '../../core/utils/format';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [
    NgClass,
    CardComponent,
    StatCardComponent,
    ButtonComponent,
    IconComponent,
    ProgressComponent,
    SkeletonComponent,
    BarChartComponent,
  ],
  template: `
    <div class="space-y-6">
      <!-- Welcome -->
      <div class="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 class="font-display text-3xl leading-tight text-ink">
            Good {{ greeting() }},
            <span class="relative inline-block">
              <span
                class="absolute -inset-x-1 -inset-y-0.5 -rotate-1 border-2 border-ink bg-primary shadow-[3px_3px_0_0_var(--color-ink)]"
              ></span>
              <span class="relative px-1">{{ name() }}</span>
            </span>
          </h1>
          <p class="mt-2.5 text-sm font-medium text-ink-soft">{{ todayLabel() }}</p>
        </div>
        <div class="flex flex-wrap gap-2">
          <app-button size="sm" variant="secondary" icon="circle-plus" (click)="go('/tasks')">
            New task
          </app-button>
          <app-button size="sm" variant="secondary" icon="wallet" (click)="go('/finance')">
            Add transaction
          </app-button>
          <app-button size="sm" variant="secondary" icon="sticky-note" (click)="go('/notes')">
            New note
          </app-button>
          <app-button size="sm" icon="timer" (click)="go('/pomodoro')"> Focus </app-button>
        </div>
      </div>

      @if (loading() && !summary()) {
        <div class="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          @for (_ of [1, 2, 3, 4]; track $index) {
            <app-skeleton size="button" class="rounded-card" />
          }
        </div>
      } @else if (summary()) {
        <!-- Task summary -->
        <div class="grid grid-cols-2 gap-4 xl:grid-cols-4">
          <app-stat-card label="Pending tasks" [value]="taskSummary().pending" icon="list-todo" />
          <app-stat-card
            label="Completed today"
            [value]="todayCompleted().length"
            icon="circle-check"
            tone="success"
          />
          <app-stat-card
            label="Income (month)"
            [value]="formatCurrency(summary()!.financeSummary.monthIncome)"
            icon="trending-up"
            tone="success"
          />
          <app-stat-card
            label="Expense (month)"
            [value]="formatCurrency(summary()!.financeSummary.monthExpense)"
            icon="trending-down"
            tone="danger"
          />
        </div>

        <div class="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <!-- Today's tasks -->
          <app-card class="lg:col-span-1">
            <div class="flex items-center justify-between px-5 pt-5">
              <h2 class="text-base font-semibold text-ink">Today’s tasks</h2>
              <button
                (click)="go('/tasks')"
                class="text-xs font-medium text-primary-strong hover:underline"
              >
                View all
              </button>
            </div>
            <div class="p-4">
              @if (todayTasks().length === 0) {
                <p class="px-2 py-6 text-center text-sm text-ink-soft">
                  Nothing due today. Enjoy the calm!
                </p>
              }
              <ul class="space-y-1">
                @for (task of todayTasks(); track task._id) {
                  <li>
                    <button
                      class="flex w-full items-start gap-3 rounded-button px-2 py-2 text-left transition-colors hover:bg-surface-2"
                      (click)="go('/tasks')"
                    >
                      <span
                        class="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2"
                        [ngClass]="
                          isOverdue(task.dueDate)
                            ? 'border-danger text-danger'
                            : 'border-ink-faint'
                        "
                      >
                        <app-icon name="check" [size]="12" [strokeWidth]="3" />
                      </span>
                      <span class="min-w-0">
                        <span class="block truncate text-sm font-medium text-ink">{{ task.title }}</span>
                        <span class="mt-0.5 flex items-center gap-1.5 text-xs text-ink-faint">
                          <app-icon name="clock" [size]="12" />
                          {{ relativeDay(task.dueDate) }}
                        </span>
                      </span>
                    </button>
                  </li>
                }
              </ul>
            </div>
          </app-card>

          <!-- Upcoming -->
          <app-card class="lg:col-span-1">
            <div class="flex items-center justify-between px-5 pt-5">
              <h2 class="text-base font-semibold text-ink">Upcoming deadlines</h2>
              <button
                (click)="go('/calendar')"
                class="text-xs font-medium text-primary-strong hover:underline"
              >
                Calendar
              </button>
            </div>
            <div class="p-4">
              @if (upcomingTasks().length === 0) {
                <p class="px-2 py-6 text-center text-sm text-ink-soft">
                  No upcoming deadlines.
                </p>
              }
              <ul class="space-y-1">
                @for (task of upcomingTasks(); track task._id) {
                  <li>
                    <button
                      class="flex w-full items-start gap-3 rounded-button px-2 py-2 text-left transition-colors hover:bg-surface-2"
                      (click)="go('/tasks')"
                    >
                      <span
                        class="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 border-ink-faint"
                      ></span>
                      <span class="min-w-0">
                        <span class="block truncate text-sm font-medium text-ink">{{ task.title }}</span>
                        <span class="mt-0.5 flex items-center gap-1.5 text-xs" [class.text-danger]="isOverdue(task.dueDate)" [class.text-ink-faint]="!isOverdue(task.dueDate)">
                          <app-icon name="calendar" [size]="12" />
                          {{ relativeDay(task.dueDate) }}
                        </span>
                      </span>
                    </button>
                  </li>
                }
              </ul>
            </div>
          </app-card>

          <!-- Habits today -->
          <app-card class="lg:col-span-1">
            <div class="flex items-center justify-between px-5 pt-5">
              <h2 class="text-base font-semibold text-ink">Habits</h2>
              <button
                (click)="go('/habits')"
                class="text-xs font-medium text-primary-strong hover:underline"
              >
                View all
              </button>
            </div>
            <div class="p-4">
              @if (habits().length === 0) {
                <p class="px-2 py-6 text-center text-sm text-ink-soft">
                  No habits yet. Build your first streak!
                </p>
              }
              <ul class="space-y-1.5">
                @for (habit of habits(); track habit._id) {
                  <li class="flex items-center gap-3 rounded-button px-2 py-2">
                    <span
                      class="flex h-7 w-7 shrink-0 items-center justify-center rounded-full"
                      [ngClass]="
                        doneToday(habit)
                          ? 'bg-success/10 text-success'
                          : 'bg-surface-2 text-ink-faint'
                      "
                    >
                      <app-icon name="flame" [size]="16" />
                    </span>
                    <span class="min-w-0 flex-1 truncate text-sm font-medium text-ink">
                      {{ habit.name }}
                    </span>
                    <span class="text-xs font-semibold text-primary-strong">
                      {{ habit.streak }} day{{ habit.streak === 1 ? '' : 's' }}
                    </span>
                  </li>
                }
              </ul>
            </div>
          </app-card>
        </div>

        <div class="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <!-- Income vs Expense -->
          <app-card>
            <div class="px-5 pt-5">
              <h2 class="text-base font-semibold text-ink">Income vs expense</h2>
              <p class="text-xs text-ink-soft">Last 6 months</p>
            </div>
            <div class="p-4">
              <app-bar-chart [data]="cashFlowData()" aria-label="Income and expenses over time" />
            </div>
          </app-card>

          <!-- Monthly budget -->
          <app-card>
            <div class="flex items-center justify-between px-5 pt-5">
              <h2 class="text-base font-semibold text-ink">Monthly budget</h2>
              <button
                (click)="go('/finance')"
                class="text-xs font-medium text-primary-strong hover:underline"
              >
                Finance
              </button>
            </div>
            <div class="space-y-4 p-5">
              @if (budgets().length === 0) {
                <p class="py-4 text-center text-sm text-ink-soft">No budgets set this month.</p>
              }
              @for (budget of budgets(); track budget._id) {
                <div>
                  <div class="mb-1.5 flex items-center justify-between text-sm">
                    <span class="font-medium text-ink">
                      {{ categoryName(budget) }}
                    </span>
                    <span class="text-xs text-ink-soft">
                      {{ formatCurrency(budget.spent) }} /
                      {{ formatCurrency(budget.amount) }}
                    </span>
                  </div>
                  <app-progress [value]="budgetPercent(budget)" />
                </div>
              }
            </div>
          </app-card>
        </div>

        <div class="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <!-- Goals progress -->
          <app-card class="lg:col-span-1">
            <div class="flex items-center justify-between px-5 pt-5">
              <h2 class="text-base font-semibold text-ink">Goals</h2>
              <button
                (click)="go('/goals')"
                class="text-xs font-medium text-primary-strong hover:underline"
              >
                View all
              </button>
            </div>
            <div class="space-y-4 p-5">
              @if (summary()!.activeGoals.length === 0) {
                <p class="py-4 text-center text-sm text-ink-soft">No active goals.</p>
              }
              @for (goal of summary()!.activeGoals; track goal._id) {
                <div>
                  <div class="mb-1.5 flex items-center justify-between text-sm">
                    <span class="truncate font-medium text-ink">{{ goal.title }}</span>
                    <span class="ml-2 shrink-0 text-xs text-ink-soft">
                      {{ goalProgress(goal.progress, goal.target) }}%
                    </span>
                  </div>
                  <app-progress [value]="goalProgress(goal.progress, goal.target)" />
                </div>
              }
            </div>
          </app-card>

          <!-- Wishlist progress -->
          <app-card class="lg:col-span-1">
            <div class="flex items-center justify-between px-5 pt-5">
              <h2 class="text-base font-semibold text-ink">Wishlist</h2>
              <button
                (click)="go('/wishlist')"
                class="text-xs font-medium text-primary-strong hover:underline"
              >
                View all
              </button>
            </div>
            <div class="space-y-4 p-5">
              @if (wishlist().length === 0) {
                <p class="py-4 text-center text-sm text-ink-soft">No saved wishes yet.</p>
              }
              @for (item of wishlist(); track item._id) {
                <div>
                  <div class="mb-1.5 flex items-center justify-between text-sm">
                    <span class="truncate font-medium text-ink">{{ item.name }}</span>
                    <span class="ml-2 shrink-0 text-xs text-ink-soft">
                      {{ formatCurrency(item.savingProgress) }} /
                      {{ formatCurrency(item.price) }}
                    </span>
                  </div>
                  <app-progress [value]="percent(item.savingProgress, item.price)" />
                </div>
              }
            </div>
          </app-card>

          <!-- Recent transactions -->
          <app-card class="lg:col-span-1">
            <div class="flex items-center justify-between px-5 pt-5">
              <h2 class="text-base font-semibold text-ink">Recent transactions</h2>
              <button
                (click)="go('/finance')"
                class="text-xs font-medium text-primary-strong hover:underline"
              >
                Finance
              </button>
            </div>
            <div class="p-4">
              @if (summary()!.recentTransactions.length === 0) {
                <p class="px-2 py-6 text-center text-sm text-ink-soft">No transactions yet.</p>
              }
              <ul class="space-y-1">
                @for (txn of summary()!.recentTransactions; track txn._id) {
                  <li class="flex items-center gap-3 rounded-button px-2 py-2">
                    <span
                      class="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg"
                      [class.bg-success/10]="txn.type === 'income'"
                      [class.bg-danger/10]="txn.type === 'expense'"
                      [class.text-success]="txn.type === 'income'"
                      [class.text-danger]="txn.type === 'expense'"
                    >
                      <app-icon
                        [name]="txn.type === 'income' ? 'arrow-down-right' : 'arrow-up-right'"
                        [size]="16"
                      />
                    </span>
                    <span class="min-w-0 flex-1">
                      <span class="block truncate text-sm font-medium text-ink">
                        {{ txn.description || 'Transaction' }}
                      </span>
                      <span class="text-xs text-ink-faint">
                        {{ categoryName(txn.category) }} · {{ formatDate(txn.date, 'short') }}
                      </span>
                    </span>
                    <span
                      class="shrink-0 text-sm font-semibold"
                      [class.text-success]="txn.type === 'income'"
                      [class.text-ink]="txn.type === 'expense'"
                    >
                      {{ txn.type === 'income' ? '+' : '−' }}{{ formatCurrency(txn.amount) }}
                    </span>
                  </li>
                }
              </ul>
            </div>
          </app-card>
        </div>
      }
    </div>
  `,
})
export class DashboardComponent implements OnInit {
  private dashboard = inject(DashboardService);
  private habitService = inject(HabitService);
  private budgetService = inject(BudgetService);
  private auth = inject(AuthService);
  private router = inject(Router);

  protected readonly summary = signal<DashboardSummary | null>(null);
  protected readonly loading = signal(true);
  protected readonly habits = signal<Habit[]>([]);
  protected readonly budgets = signal<Budget[]>([]);
  protected readonly wishlist = signal<
    { _id: string; name: string; price: number; savingProgress: number }[]
  >([]);

  private transactionService = inject(TransactionService);
  private wishlistService = inject(WishlistService);

  protected readonly name = computed(() => this.auth.user()?.name?.split(' ')[0] ?? 'there');

  protected readonly greeting = computed(() => {
    const h = new Date().getHours();
    if (h < 12) return 'morning';
    if (h < 18) return 'afternoon';
    return 'evening';
  });

  protected readonly todayLabel = computed(() =>
    new Intl.DateTimeFormat('en-US', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    }).format(new Date())
  );

  protected readonly taskSummary = computed(() => this.summary()?.taskSummary as TaskSummary);
  protected readonly todayTasks = computed(() => this.taskSummary()?.today ?? []);
  protected readonly upcomingTasks = computed(() => this.taskSummary()?.upcoming ?? []);
  protected readonly todayCompleted = computed(() =>
    (this.taskSummary()?.today ?? []).filter((t) => t.status === 'completed')
  );

  protected readonly cashFlowData = computed<ChartPoint[]>(() => {
    const list: ChartPoint[] = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date();
      d.setMonth(d.getMonth() - i);
      const key = monthKey(d);
      const label = new Intl.DateTimeFormat('en-US', { month: 'short' }).format(d);
      const income = this.cashFlow[key]?.income ?? 0;
      const expense = this.cashFlow[key]?.expense ?? 0;
      list.push({ label, value: income - expense });
    }
    return list;
  });

  private cashFlow: Record<string, { income: number; expense: number }> = {};

  ngOnInit(): void {
    this.loadAll();
  }

  private loadAll(): void {
    this.loading.set(true);
    this.dashboard.summary().subscribe({
      next: (res) => {
        this.summary.set(res);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
    this.habitService.getAll().subscribe((h) => this.habits.set(h));
    this.budgetService.getAll({ month: monthKey() }).subscribe((b) => this.budgets.set(b));
    this.wishlistService.getAll({ status: 'saved' }).subscribe((w) => this.wishlist.set(w));
    this.transactionService.getAll().subscribe((txns) => {
      const map: Record<string, { income: number; expense: number }> = {};
      for (const t of txns) {
        const key = monthKey(toDate(t.date));
        map[key] ??= { income: 0, expense: 0 };
        if (t.type === 'income') map[key].income += t.amount;
        else map[key].expense += t.amount;
      }
      this.cashFlow = map;
    });
  }

  protected doneToday(habit: Habit): boolean {
    const today = new Date().toISOString().slice(0, 10);
    return habit.completedDates.includes(today);
  }

  protected categoryName(value: unknown): string {
    if (value && typeof value === 'object' && 'name' in (value as object)) {
      return (value as { name: string }).name;
    }
    return '';
  }

  protected budgetPercent(budget: Budget): number {
    return percent(budget.spent, budget.amount);
  }

  protected goalProgress(progress: number, target: number | null | undefined): number {
    if (!target) return Math.min(progress, 100);
    return percent(progress, target);
  }

  protected go(route: string): void {
    this.router.navigate([route]);
  }

  protected readonly formatCurrency = formatCurrency;
  protected readonly formatDate = formatDate;
  protected readonly isOverdue = isOverdue;
  protected readonly relativeDay = relativeDay;
  protected readonly percent = percent;
}
