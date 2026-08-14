import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { Router } from '@angular/router';
import { NgClass } from '@angular/common';
import { CardComponent } from '../../layout/components/card.component';
import { StatCardComponent } from './components/stat-card.component';
import { ButtonComponent } from '../../layout/components/button.component';
import { IconComponent } from '../../layout/components/icon.component';
import { ProgressComponent } from '../../layout/components/progress.component';
import { SkeletonComponent } from '../../layout/components/skeleton.component';
import { ModalComponent } from '../../layout/components/modal.component';
import { BarChartComponent } from './components/bar-chart.component';
import type { ChartPoint } from '../../core/models/chart.model';
import { DashboardService, SettingService } from '../../core/services/data.service';
import { HabitService, WishlistService } from '../../core/services/lifestyle.service';
import { BudgetService, TransactionService } from '../../core/services/finance.service';
import { AuthService } from '../../core/services/auth.service';
import { I18nService } from '../../core/services/i18n.service';
import { getLocale } from '../../core/utils/locale';
import { ToastService } from '../../core/services/toast.service';
import type { DashboardSummary, TaskSummary } from '../../core/models/misc.model';
import type { Budget } from '../../core/models/finance.model';
import type { Habit } from '../../core/models/lifestyle.model';
import {
  formatCurrency,
  formatDate,
  isOverdue,
  monthKey,
  percent,
  relativeDay,
  toDate,
} from '../../core/utils/format';
import { getTodayLocalDate } from '../../core/utils/date';

interface WidgetDef {
  key: string;
  label: string;
  icon: string;
  span: string;
}

interface WidgetListItem extends WidgetDef {
  visible: boolean;
}

const WIDGET_DEFS: WidgetDef[] = [
  { key: 'stats', label: 'Task summary', icon: 'list-todo', span: 'lg:col-span-3' },
  { key: 'finance', label: 'Finance summary', icon: 'wallet', span: 'lg:col-span-3' },
  { key: 'today', label: "Today's tasks", icon: 'calendar-check', span: 'lg:col-span-1' },
  { key: 'upcoming', label: 'Upcoming deadlines', icon: 'clock', span: 'lg:col-span-1' },
  { key: 'habits', label: 'Habits', icon: 'flame', span: 'lg:col-span-1' },
  { key: 'chart', label: 'Income vs expense', icon: 'bar-chart-3', span: 'lg:col-span-2' },
  { key: 'budget', label: 'Monthly budget', icon: 'piggy-bank', span: 'lg:col-span-1' },
  { key: 'goals', label: 'Goals', icon: 'target', span: 'lg:col-span-1' },
  { key: 'wishlist', label: 'Wishlist', icon: 'gift', span: 'lg:col-span-1' },
  { key: 'recent', label: 'Recent transactions', icon: 'receipt', span: 'lg:col-span-1' },
];

const DEFAULT_WIDGETS = WIDGET_DEFS.map((w) => w.key);

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
    ModalComponent,
    BarChartComponent,
  ],
  template: `
    <div class="space-y-6">
      <!-- Welcome -->
      <div class="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 class="font-display text-3xl leading-tight text-ink">
            {{ greeting() }},
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
          <app-button size="sm" variant="secondary" icon="layout-dashboard" (click)="openCustomize()">
            {{ t('Customize') }}
          </app-button>
          <app-button size="sm" icon="timer" (click)="go('/pomodoro')"> {{ t('Focus') }} </app-button>
        </div>
      </div>

      @if (loading() && !summary()) {
        <div class="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          @for (_ of [1, 2, 3, 4]; track $index) {
            <app-skeleton size="button" class="rounded-card" />
          }
        </div>
      } @else if (summary()) {
        <div class="grid grid-cols-1 gap-6 lg:grid-cols-3">
          @for (key of widgets(); track key) {
            @switch (key) {
              @case ('stats') {
                <div class="grid grid-cols-2 gap-4 lg:col-span-3 xl:grid-cols-4">
                  <app-stat-card [label]="t('Pending tasks')" [value]="taskSummary().pending" icon="list-todo" />
                  <app-stat-card
                    [label]="t('Completed today')"
                    [value]="todayCompleted().length"
                    icon="circle-check"
                    tone="success"
                  />
                  <app-stat-card
                    [label]="t('Tasks total')"
                    [value]="taskSummary().total"
                    icon="list-todo"
                  />
                  <app-stat-card
                    [label]="t('Upcoming deadlines')"
                    [value]="taskSummary().upcoming.length"
                    icon="clock"
                  />
                </div>
              }
              @case ('finance') {
                <div class="lg:col-span-3">
                  <div class="mb-3 flex items-center justify-between">
                    <h2 class="text-sm font-bold uppercase tracking-wider text-ink-soft">{{ t('Finance summary') }}</h2>
                    <button
                      type="button"
                      class="flex items-center gap-1.5 rounded-button border-2 border-ink bg-surface px-2.5 py-1 text-xs font-semibold text-ink transition-colors hover:bg-surface-2"
                      [attr.aria-label]="hideBalance() ? t('Show balance') : t('Hide balance')"
                      (click)="toggleHideBalance()"
                    >
                      <app-icon [name]="hideBalance() ? 'eye-off' : 'eye'" [size]="14" />
                      {{ hideBalance() ? t('Show') : t('Hide') }}
                    </button>
                  </div>
                  <div class="grid grid-cols-2 gap-4 xl:grid-cols-4">
                    <app-stat-card
                      [label]="t('Balance')"
                      [value]="money(summary()!.financeSummary.balance)"
                      icon="piggy-bank"
                      tone="primary"
                    />
                    <app-stat-card
                      [label]="t('Income (month)')"
                      [value]="money(summary()!.financeSummary.monthIncome)"
                      icon="trending-up"
                      tone="success"
                    />
                    <app-stat-card
                      [label]="t('Expense (month)')"
                      [value]="money(summary()!.financeSummary.monthExpense)"
                      icon="trending-down"
                      tone="danger"
                    />
                    <app-stat-card
                      [label]="t('Net (month)')"
                      [value]="money(monthNet())"
                      icon="wallet"
                    />
                  </div>
                </div>
              }
              @case ('today') {
                <app-card class="lg:col-span-1" [padding]="'none'">
                  <div class="flex items-center justify-between px-5 pt-5">
                    <h2 class="text-base font-semibold text-ink">{{ t("Today's tasks") }}</h2>
                    <button (click)="go('/tasks')" class="text-xs font-medium text-primary-strong hover:underline">
                      {{ t('View all') }}
                    </button>
                  </div>
                  <div class="p-4">
                    @if (todayTasks().length === 0) {
                      <p class="px-2 py-6 text-center text-sm text-ink-soft">
                        {{ t('Nothing due today. Enjoy the calm!') }}
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
                              [ngClass]="isOverdue(task.dueDate) ? 'border-danger text-danger' : 'border-ink-faint'"
                            >
                              <app-icon name="check" [size]="12" [strokeWidth]="3" />
                            </span>
                            <span class="min-w-0">
                              <span class="block truncate text-sm font-medium text-ink">{{ task.title }}</span>
                              <span class="mt-0.5 flex items-center gap-1.5 text-xs text-ink-faint">
                                <app-icon name="clock" [size]="12" />
                                {{ t(relativeDay(task.dueDate)) }}
                              </span>
                            </span>
                          </button>
                        </li>
                      }
                    </ul>
                  </div>
                </app-card>
              }
              @case ('upcoming') {
                <app-card class="lg:col-span-1" [padding]="'none'">
                  <div class="flex items-center justify-between px-5 pt-5">
                    <h2 class="text-base font-semibold text-ink">{{ t('Upcoming deadlines') }}</h2>
                    <button (click)="go('/calendar')" class="text-xs font-medium text-primary-strong hover:underline">
                      {{ t('Calendar') }}
                    </button>
                  </div>
                  <div class="p-4">
                    @if (upcomingTasks().length === 0) {
                      <p class="px-2 py-6 text-center text-sm text-ink-soft">{{ t('No upcoming deadlines.') }}</p>
                    }
                    <ul class="space-y-1">
                      @for (task of upcomingTasks(); track task._id) {
                        <li>
                          <button
                            class="flex w-full items-start gap-3 rounded-button px-2 py-2 text-left transition-colors hover:bg-surface-2"
                            (click)="go('/tasks')"
                          >
                            <span class="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 border-ink-faint"></span>
                            <span class="min-w-0">
                              <span class="block truncate text-sm font-medium text-ink">{{ task.title }}</span>
                              <span
                                class="mt-0.5 flex items-center gap-1.5 text-xs"
                                [class.text-danger]="isOverdue(task.dueDate)"
                                [class.text-ink-faint]="!isOverdue(task.dueDate)"
                              >
                                <app-icon name="calendar" [size]="12" />
                                {{ t(relativeDay(task.dueDate)) }}
                              </span>
                            </span>
                          </button>
                        </li>
                      }
                    </ul>
                  </div>
                </app-card>
              }
              @case ('habits') {
                <app-card class="lg:col-span-1" [padding]="'none'">
                  <div class="flex items-center justify-between px-5 pt-5">
                    <h2 class="text-base font-semibold text-ink">{{ t('Habits') }}</h2>
                    <button (click)="go('/habits')" class="text-xs font-medium text-primary-strong hover:underline">
                      {{ t('View all') }}
                    </button>
                  </div>
                  <div class="p-4">
                    @if (habits().length === 0) {
                      <p class="px-2 py-6 text-center text-sm text-ink-soft">{{ t('No habits yet.') }}</p>
                    }
                    <ul class="space-y-1.5">
                      @for (habit of habits(); track habit._id) {
                        <li class="flex items-center gap-3 rounded-button px-2 py-2">
                          <span
                            class="flex h-7 w-7 shrink-0 items-center justify-center rounded-full"
                            [ngClass]="doneToday(habit) ? 'bg-success/10 text-success' : 'bg-surface-2 text-ink-faint'"
                          >
                            <app-icon name="flame" [size]="16" />
                          </span>
                          <span class="min-w-0 flex-1 truncate text-sm font-medium text-ink">{{ habit.name }}</span>
                          <span class="text-xs font-semibold text-primary-strong">
                            {{ t(habit.streak === 1 ? '{n} day' : '{n} days', { n: habit.streak }) }}
                          </span>
                        </li>
                      }
                    </ul>
                  </div>
                </app-card>
              }
              @case ('chart') {
                <app-card class="lg:col-span-2" [padding]="'none'">
                  <div class="px-5 pt-5">
                    <h2 class="text-base font-semibold text-ink">{{ t('Income vs expense') }}</h2>
                    <p class="text-xs text-ink-soft">{{ t('Last 6 months') }}</p>
                  </div>
                  <div class="p-4">
                    <app-bar-chart [data]="cashFlowData()" [attr.aria-label]="t('Income and expenses over time')" />
                  </div>
                </app-card>
              }
              @case ('budget') {
                <app-card class="lg:col-span-1" [padding]="'none'">
                  <div class="flex items-center justify-between px-5 pt-5">
                    <h2 class="text-base font-semibold text-ink">{{ t('Monthly budget') }}</h2>
                    <button (click)="go('/finance')" class="text-xs font-medium text-primary-strong hover:underline">
                      {{ t('Finance') }}
                    </button>
                  </div>
                  <div class="space-y-4 p-5">
                    @if (budgets().length === 0) {
                      <p class="py-4 text-center text-sm text-ink-soft">{{ t('No budgets set this month.') }}</p>
                    }
                    @for (budget of budgets(); track budget._id) {
                      <div>
                        <div class="mb-1.5 flex items-center justify-between text-sm">
                          <span class="font-medium text-ink">{{ categoryName(budget.category) }}</span>
                          <span class="text-xs text-ink-soft">
                            {{ money(budget.spent) }} / {{ money(budget.amount) }}
                          </span>
                        </div>
                        <app-progress [value]="budgetPercent(budget)" />
                      </div>
                    }
                  </div>
                </app-card>
              }
              @case ('goals') {
                <app-card class="lg:col-span-1" [padding]="'none'">
                  <div class="flex items-center justify-between px-5 pt-5">
                    <h2 class="text-base font-semibold text-ink">{{ t('Goals') }}</h2>
                    <button (click)="go('/goals')" class="text-xs font-medium text-primary-strong hover:underline">
                      {{ t('View all') }}
                    </button>
                  </div>
                  <div class="space-y-4 p-5">
                    @if (summary()!.activeGoals.length === 0) {
                      <p class="py-4 text-center text-sm text-ink-soft">{{ t('No active goals.') }}</p>
                    }
                    @for (goal of summary()!.activeGoals; track goal._id) {
                      <div>
                        <div class="mb-1.5 flex items-center justify-between text-sm">
                          <span class="truncate font-medium text-ink">{{ goal.title }}</span>
                          <span class="ml-2 shrink-0 text-xs text-ink-soft">{{ goalProgress(goal.progress, goal.target) }}%</span>
                        </div>
                        <app-progress [value]="goalProgress(goal.progress, goal.target)" />
                      </div>
                    }
                  </div>
                </app-card>
              }
              @case ('wishlist') {
                <app-card class="lg:col-span-1" [padding]="'none'">
                  <div class="flex items-center justify-between px-5 pt-5">
                    <h2 class="text-base font-semibold text-ink">{{ t('Wishlist') }}</h2>
                    <button (click)="go('/wishlist')" class="text-xs font-medium text-primary-strong hover:underline">
                      {{ t('View all') }}
                    </button>
                  </div>
                  <div class="space-y-4 p-5">
                    @if (wishlist().length === 0) {
                      <p class="py-4 text-center text-sm text-ink-soft">{{ t('No saved wishes yet.') }}</p>
                    }
                    @for (item of wishlist(); track item._id) {
                      <div>
                        <div class="mb-1.5 flex items-center justify-between text-sm">
                          <span class="truncate font-medium text-ink">{{ item.name }}</span>
                          <span class="ml-2 shrink-0 text-xs text-ink-soft">
                            {{ money(item.savingProgress) }} / {{ money(item.price) }}
                          </span>
                        </div>
                        <app-progress [value]="percent(item.savingProgress, item.price)" />
                      </div>
                    }
                  </div>
                </app-card>
              }
              @case ('recent') {
                <app-card class="lg:col-span-1" [padding]="'none'">
                  <div class="flex items-center justify-between px-5 pt-5">
                    <h2 class="text-base font-semibold text-ink">{{ t('Recent transactions') }}</h2>
                    <button (click)="go('/finance')" class="text-xs font-medium text-primary-strong hover:underline">
                      {{ t('Finance') }}
                    </button>
                  </div>
                  <div class="p-4">
                    @if (summary()!.recentTransactions.length === 0) {
                      <p class="px-2 py-6 text-center text-sm text-ink-soft">{{ t('No transactions yet.') }}</p>
                    }
                    <ul class="space-y-1">
                      @for (txn of summary()!.recentTransactions; track txn._id) {
                        <li class="flex items-center gap-3 rounded-button px-2 py-2">
                          <span
                            class="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg"
                            [class.bg-success/10]="txn.type === 'income'"
                            [class.bg-danger/10]="txn.type === 'expense'"
                            [class.bg-primary/15]="txn.type === 'transfer'"
                            [class.text-success]="txn.type === 'income'"
                            [class.text-danger]="txn.type === 'expense'"
                            [class.text-ink]="txn.type === 'transfer'"
                          >
                            <app-icon
                              [name]="txn.type === 'income' ? 'arrow-down-right' : txn.type === 'expense' ? 'arrow-up-right' : 'arrow-right'"
                              [size]="16"
                            />
                          </span>
                          <span class="min-w-0 flex-1">
                            <span class="block truncate text-sm font-medium text-ink">{{ txn.description || t('Transaction') }}</span>
                            <span class="text-xs text-ink-faint">
                              {{ categoryName(txn.category) }} · {{ formatDate(txn.date, 'short') }}
                            </span>
                          </span>
                          <span
                            class="shrink-0 text-sm font-semibold"
                            [class.text-success]="txn.type === 'income'"
                            [class.text-ink]="txn.type === 'expense' || txn.type === 'transfer'"
                          >
                            {{ txn.type === 'transfer' ? '' : txn.type === 'income' ? '+' : '−' }}{{ money(txn.amount) }}
                          </span>
                        </li>
                      }
                    </ul>
                  </div>
                </app-card>
              }
            }
          }
        </div>
      }
    </div>

    <!-- Customize modal -->
    <app-modal [open]="customizeOpen()" [title]="t('Customize dashboard')" [width]="480" (closed)="customizeOpen.set(false)">
      <p class="mb-4 text-sm text-ink-soft">
        {{ t('Toggle widgets on and off, then drag to reorder (or use ↑ ↓). Saved per user.') }}
      </p>
      <ul class="space-y-2">
        @for (widget of editList(); track widget.key; let i = $index) {
          <li
            [draggable]="widget.visible"
            (dragstart)="dragIndex = i"
            (dragover)="$event.preventDefault()"
            (drop)="dropOn(i)"
            class="flex items-center gap-3 rounded-button border-2 border-ink bg-surface p-2.5 transition-colors"
            [class.opacity-50]="!widget.visible"
            [class.cursor-grab]="widget.visible"
          >
            <app-icon name="menu" [size]="16" class="shrink-0 text-ink-faint" />
            <span
              class="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border-2 border-ink bg-surface-2"
            >
              <app-icon [name]="widget.icon" [size]="16" />
            </span>
            <span class="min-w-0 flex-1 truncate text-sm font-medium text-ink">{{ t(widget.label) }}</span>
            <div class="flex shrink-0 items-center gap-0.5">
              <app-button size="icon" variant="ghost" icon="chevron-up"
                [attr.aria-label]="t('Move up')" (click)="moveWidget(i, -1)"></app-button>
              <app-button size="icon" variant="ghost" icon="chevron-down"
                [attr.aria-label]="t('Move down')" (click)="moveWidget(i, 1)"></app-button>
              <app-button
                size="icon"
                variant="ghost"
                [icon]="widget.visible ? 'eye' : 'eye-off'"
                [attr.aria-label]="widget.visible ? t('Hide widget') : t('Show widget')"
                (click)="toggleWidget(widget.key)"
              ></app-button>
            </div>
          </li>
        }
      </ul>
      <div class="mt-5 flex justify-end gap-2">
        <app-button type="button" variant="secondary" (click)="resetWidgets()">{{ t('Reset') }}</app-button>
        <app-button type="button" [loading]="savingWidgets()" (click)="saveWidgets()">{{ t('Save layout') }}</app-button>
      </div>
    </app-modal>
  `,
})
export class DashboardComponent implements OnInit {
  private dashboard = inject(DashboardService);
  private settingService = inject(SettingService);
  private habitService = inject(HabitService);
  private budgetService = inject(BudgetService);
  private auth = inject(AuthService);
  private router = inject(Router);
  private toast = inject(ToastService);
  private i18n = inject(I18nService);

  protected readonly t = this.i18n.t.bind(this.i18n);

  protected readonly summary = signal<DashboardSummary | null>(null);
  protected readonly loading = signal(true);
  protected readonly habits = signal<Habit[]>([]);
  protected readonly budgets = signal<Budget[]>([]);
  protected readonly wishlist = signal<
    { _id: string; name: string; price: number; savingProgress: number }[]
  >([]);

  protected readonly widgets = signal<string[]>([...DEFAULT_WIDGETS]);
  protected readonly hideBalance = signal(false);
  protected readonly customizeOpen = signal(false);
  protected readonly savingWidgets = signal(false);
  protected dragIndex: number | null = null;

  protected readonly editList = computed<WidgetListItem[]>(() => {
    const order = this.widgets();
    const visible = new Set(order);
    return WIDGET_DEFS.map((w) => ({
      ...w,
      span: w.span,
      visible: visible.has(w.key),
    })).sort((a, b) => order.indexOf(a.key) - order.indexOf(b.key));
  });

  private transactionService = inject(TransactionService);
  private wishlistService = inject(WishlistService);

  protected readonly name = computed(() => this.auth.user()?.name?.split(' ')[0] ?? this.t('there'));

  protected readonly greeting = computed(() => {
    const h = new Date().getHours();
    if (h < 12) return this.t('Good morning');
    if (h < 18) return this.t('Good afternoon');
    return this.t('Good evening');
  });

  protected readonly todayLabel = computed(() =>
    new Intl.DateTimeFormat(getLocale(), {
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

  protected readonly monthNet = computed(
    () =>
      (this.summary()?.financeSummary.monthIncome ?? 0) -
      (this.summary()?.financeSummary.monthExpense ?? 0)
  );

  protected readonly cashFlowData = computed<ChartPoint[]>(() => {
    const list: ChartPoint[] = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date();
      d.setMonth(d.getMonth() - i);
      const key = monthKey(d);
      const label = new Intl.DateTimeFormat(getLocale(), { month: 'short' }).format(d);
      const income = this.cashFlow()[key]?.income ?? 0;
      const expense = this.cashFlow()[key]?.expense ?? 0;
      list.push({ label, value: income - expense });
    }
    return list;
  });

  private readonly cashFlow = signal<Record<string, { income: number; expense: number }>>({});

  ngOnInit(): void {
    this.loadAll();
    this.settingService.get().subscribe({
      next: (s) => {
        if (s.dashboardWidgets?.length) {
          this.widgets.set(this.normalizeWidgets(s.dashboardWidgets));
        }
        this.hideBalance.set(!!s.hideBalance);
      },
      error: () => undefined,
    });
  }

  /** Merge stored order with current definitions (keeps user order, adds new keys). */
  private normalizeWidgets(stored: string[]): string[] {
    const known = new Set(WIDGET_DEFS.map((w) => w.key));
    const ordered = stored.filter((k) => known.has(k));
    const missing = DEFAULT_WIDGETS.filter((k) => !ordered.includes(k));
    return [...ordered, ...missing];
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
        else if (t.type === 'expense') map[key].expense += t.amount;
      }
      this.cashFlow.set(map);
    });
  }

  protected openCustomize(): void {
    this.customizeOpen.set(true);
  }

  protected toggleHideBalance(): void {
    const next = !this.hideBalance();
    this.hideBalance.set(next);
    this.settingService.update({ hideBalance: next }).subscribe({
      next: () => this.toast.success(next ? this.t('Balance hidden') : this.t('Balance visible')),
      error: () => this.toast.error(this.t('Failed to save preference')),
    });
  }

  protected money(value: number): string {
    return this.hideBalance() ? '••••••' : formatCurrency(value);
  }

  protected toggleWidget(key: string): void {
    this.widgets.update((list) =>
      list.includes(key) ? list.filter((k) => k !== key) : [...list, key]
    );
  }

  protected moveWidget(index: number, dir: number): void {
    this.widgets.update((list) => {
      const next = [...list];
      const target = index + dir;
      if (target < 0 || target >= next.length) return next;
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  }

  protected dropOn(target: number): void {
    if (this.dragIndex === null || this.dragIndex === target) return;
    this.widgets.update((list) => {
      const next = [...list];
      const [moved] = next.splice(this.dragIndex!, 1);
      next.splice(target, 0, moved);
      return next;
    });
    this.dragIndex = null;
  }

  protected resetWidgets(): void {
    this.widgets.set([...DEFAULT_WIDGETS]);
  }

  protected saveWidgets(): void {
    this.savingWidgets.set(true);
    this.settingService.update({ dashboardWidgets: this.widgets() }).subscribe({
      next: () => {
        this.savingWidgets.set(false);
        this.customizeOpen.set(false);
        this.toast.success(this.t('Dashboard layout saved'));
      },
      error: (err: Error) => {
        this.savingWidgets.set(false);
        this.toast.error(err.message);
      },
    });
  }

  protected doneToday(habit: Habit): boolean {
    return habit.completedDates.includes(getTodayLocalDate());
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
