import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { Router } from '@angular/router';
import { NgClass } from '@angular/common';
import { CardComponent } from '../../layout/components/card.component';
import { ButtonComponent } from '../../layout/components/button.component';
import { IconComponent } from '../../layout/components/icon.component';
import { BadgeComponent } from '../../layout/components/badge.component';
import { ProgressComponent } from '../../layout/components/progress.component';
import { SkeletonComponent } from '../../layout/components/skeleton.component';
import { TodayService } from '../../core/services/data.service';
import { TaskService } from '../../core/services/task.service';
import { HabitService } from '../../core/services/lifestyle.service';
import { ToastService } from '../../core/services/toast.service';
import { CommandService } from '../../core/services/command.service';
import type { TodayData, TodayHabit } from '../../core/models/misc.model';
import type { Task } from '../../core/models/task.model';
import { formatCurrency, formatDate, formatTime, percent } from '../../core/utils/format';

@Component({
  selector: 'app-today',
  standalone: true,
  imports: [
    NgClass,
    CardComponent,
    ButtonComponent,
    IconComponent,
    BadgeComponent,
    ProgressComponent,
    SkeletonComponent,
  ],
  template: `
    <div class="space-y-6">
      <!-- Header -->
      <div class="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 class="font-display text-3xl leading-tight text-ink">
            <span
              class="box-decoration-clone bg-primary px-2 py-0.5 shadow-[4px_4px_0_0_var(--color-ink)]"
              >{{ greetingText() }}</span
            >
          </h1>
          <p class="mt-2.5 text-sm font-medium text-ink-soft">{{ todayLabel() }}</p>
        </div>
        <div class="flex flex-wrap gap-2">
          <app-button size="sm" variant="secondary" icon="plus" (click)="quickAdd('task')">
            Task
          </app-button>
          <app-button size="sm" variant="secondary" icon="receipt" (click)="quickAdd('transaction')">
            Transaction
          </app-button>
          <app-button size="sm" variant="secondary" icon="sticky-note" (click)="quickAdd('note')">
            Note
          </app-button>
          <app-button size="sm" icon="timer" (click)="go('/pomodoro')"> Focus </app-button>
        </div>
      </div>

      @if (loading() && !data()) {
        <div class="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          @for (_ of [1, 2, 3, 4]; track $index) {
            <app-skeleton size="button" class="rounded-card" />
          }
        </div>
      } @else if (error() && !data()) {
        <app-card>
          <div class="flex flex-col items-center gap-3 py-8 text-center">
            <app-icon name="alert-circle" [size]="32" class="text-danger" />
            <div>
              <p class="font-display text-lg text-ink">Something went wrong</p>
              <p class="text-sm text-ink-soft">We couldn't load your day.</p>
            </div>
            <app-button variant="secondary" icon="refresh-cw" (click)="load()">Try again</app-button>
          </div>
        </app-card>
      } @else if (data(); as today) {
        <!-- Progress overview -->
        <div class="grid grid-cols-2 gap-4 xl:grid-cols-4">
          <app-card [padding]="'sm'">
            <p class="text-xs font-bold uppercase tracking-wide text-ink-faint">Tasks today</p>
            <p class="mt-1 font-display text-2xl text-ink">
              {{ today.progress.totalTasksToday }}
            </p>
            <app-progress class="mt-2" [value]="taskProgress()" />
          </app-card>
          <app-card [padding]="'sm'">
            <p class="text-xs font-bold uppercase tracking-wide text-ink-faint">Completed</p>
            <p class="mt-1 font-display text-2xl text-success">
              {{ today.progress.completedTasksToday }}
            </p>
            <app-progress class="mt-2" [value]="taskProgress()" color="var(--color-success)" />
          </app-card>
          <app-card [padding]="'sm'">
            <p class="text-xs font-bold uppercase tracking-wide text-ink-faint">Habits done</p>
            <p class="mt-1 font-display text-2xl text-secondary">
              {{ today.progress.habitsDone }}/{{ today.progress.habitsTotal }}
            </p>
            <app-progress class="mt-2" [value]="habitProgress()" color="var(--color-secondary)" />
          </app-card>
          <app-card [padding]="'sm'">
            <p class="text-xs font-bold uppercase tracking-wide text-ink-faint">Net today</p>
            <p class="mt-1 font-display text-2xl" [class.text-success]="today.finance.net >= 0">
              {{ formatCurrency(today.finance.net) }}
            </p>
            <p class="mt-1 text-xs text-ink-soft">
              +{{ formatCurrency(today.finance.income) }} / −{{ formatCurrency(today.finance.expense) }}
            </p>
          </app-card>
        </div>

        <div class="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <!-- Today's focus -->
          <app-card class="lg:col-span-2" [padding]="'none'">
            <div class="flex items-center justify-between border-b-2 border-ink px-5 py-4">
              <h2 class="flex items-center gap-2 text-base font-bold text-ink">
                <app-icon name="target" [size]="18" /> Today's focus
              </h2>
              <button (click)="go('/tasks')" class="text-xs font-medium text-primary-strong hover:underline">
                All tasks
              </button>
            </div>
            <div class="p-4">
              @if (today.overdue.length > 0) {
                <div class="mb-4 rounded-card border-2 border-danger/60 bg-danger/5 p-3">
                  <p class="mb-2 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-danger">
                    <app-icon name="alert-circle" [size]="13" />
                    {{ today.overdue.length }} overdue
                  </p>
                  <ul class="space-y-1">
                    @for (task of today.overdue; track task._id) {
                      <li class="flex items-center gap-3 rounded-button px-2 py-1.5 hover:bg-surface-2">
                        <button
                          (click)="toggleTask(task)"
                          class="flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 border-danger text-transparent transition-colors hover:text-danger"
                          [attr.aria-label]="'Complete ' + task.title"
                        >
                          <app-icon name="check" [size]="12" [strokeWidth]="3" />
                        </button>
                        <span class="min-w-0 flex-1 truncate text-sm font-medium text-ink">
                          {{ task.title }}
                        </span>
                        <span class="shrink-0 text-xs font-semibold text-danger">
                          {{ formatDate(task.dueDate, 'short') }}
                        </span>
                      </li>
                    }
                  </ul>
                </div>
              }

              @if (today.focus.length === 0) {
                <div class="px-2 py-8 text-center">
                  <app-icon name="sparkles" [size]="30" class="mx-auto text-ink-faint" />
                  <p class="mt-2 text-sm font-medium text-ink">No tasks due today 🎉</p>
                  <p class="text-xs text-ink-soft">Enjoy the calm, or add something small.</p>
                </div>
              } @else {
                <ul class="space-y-1">
                  @for (task of today.focus; track task._id) {
                    <li class="flex items-center gap-3 rounded-button px-2 py-2 hover:bg-surface-2">
                      <button
                        (click)="toggleTask(task)"
                        class="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 border-ink-faint transition-colors hover:border-primary"
                        [attr.aria-label]="'Complete ' + task.title"
                      >
                        <app-icon name="check" [size]="13" [strokeWidth]="3" class="text-transparent" />
                      </button>
                      <span class="min-w-0 flex-1 truncate text-sm font-medium text-ink">
                        {{ task.title }}
                      </span>
                      @if (task.priority === 'high') {
                        <app-badge tone="danger" icon="flag">High</app-badge>
                      }
                      @if (task.priority === 'low') {
                        <app-badge tone="neutral">Low</app-badge>
                      }
                      @if (task.reminder) {
                        <span class="hidden items-center gap-1 text-xs text-ink-faint sm:flex">
                          <app-icon name="bell" [size]="12" /> {{ formatTime(task.reminder) }}
                        </span>
                      }
                    </li>
                  }
                </ul>
              }
            </div>
          </app-card>

          <!-- Right column: money + goals -->
          <div class="space-y-6">
            <app-card [padding]="'none'">
              <div class="flex items-center justify-between border-b-2 border-ink px-5 py-4">
                <h2 class="flex items-center gap-2 text-base font-bold text-ink">
                  <app-icon name="wallet" [size]="18" /> Today's money
                </h2>
                <button (click)="go('/finance')" class="text-xs font-medium text-primary-strong hover:underline">
                  Finance
                </button>
              </div>
              <div class="grid grid-cols-3 divide-x-2 divide-ink/10 p-4">
                <div class="px-2 text-center">
                  <p class="text-[11px] font-bold uppercase tracking-wide text-ink-faint">In</p>
                  <p class="mt-1 truncate text-sm font-bold text-success">
                    {{ formatCurrency(today.finance.income) }}
                  </p>
                </div>
                <div class="px-2 text-center">
                  <p class="text-[11px] font-bold uppercase tracking-wide text-ink-faint">Out</p>
                  <p class="mt-1 truncate text-sm font-bold text-danger">
                    {{ formatCurrency(today.finance.expense) }}
                  </p>
                </div>
                <div class="px-2 text-center">
                  <p class="text-[11px] font-bold uppercase tracking-wide text-ink-faint">Net</p>
                  <p
                    class="mt-1 truncate text-sm font-bold"
                    [class.text-success]="today.finance.net >= 0"
                  >
                    {{ formatCurrency(today.finance.net) }}
                  </p>
                </div>
              </div>
            </app-card>

            <app-card [padding]="'none'">
              <div class="flex items-center justify-between border-b-2 border-ink px-5 py-4">
                <h2 class="flex items-center gap-2 text-base font-bold text-ink">
                  <app-icon name="target" [size]="18" /> Goals
                </h2>
                <button (click)="go('/goals')" class="text-xs font-medium text-primary-strong hover:underline">
                  All
                </button>
              </div>
              <div class="space-y-4 p-5">
                @if (today.goals.length === 0) {
                  <p class="py-3 text-center text-sm text-ink-soft">No active goals.</p>
                }
                @for (goal of today.goals; track goal._id) {
                  <div>
                    <div class="mb-1.5 flex items-center justify-between gap-2 text-sm">
                      <span class="truncate font-medium text-ink">{{ goal.title }}</span>
                      <span class="shrink-0 text-xs text-ink-soft">
                        {{ goalProgress(goal.progress, goal.target) }}%
                      </span>
                    </div>
                    <app-progress [value]="goalProgress(goal.progress, goal.target)" />
                  </div>
                }
              </div>
            </app-card>
          </div>

          <!-- Habits -->
          <app-card class="lg:col-span-2" [padding]="'none'">
            <div class="flex items-center justify-between border-b-2 border-ink px-5 py-4">
              <h2 class="flex items-center gap-2 text-base font-bold text-ink">
                <app-icon name="flame" [size]="18" /> Habits
              </h2>
              <button (click)="go('/habits')" class="text-xs font-medium text-primary-strong hover:underline">
                All habits
              </button>
            </div>
            <div class="p-4">
              @if (today.habits.length === 0) {
                <div class="px-2 py-8 text-center">
                  <app-icon name="flame" [size]="30" class="mx-auto text-ink-faint" />
                  <p class="mt-2 text-sm font-medium text-ink">No habits yet</p>
                  <p class="text-xs text-ink-soft">Build your first streak to see it here.</p>
                </div>
              } @else {
                <ul class="grid grid-cols-1 gap-1 sm:grid-cols-2">
                  @for (habit of today.habits; track habit._id) {
                    <li>
                      <button
                        (click)="toggleHabit(habit)"
                        class="flex w-full items-center gap-3 rounded-button border-2 px-3 py-2.5 text-left transition-all duration-150"
                        [ngClass]="
                          habit.doneToday
                            ? 'border-success bg-success/10'
                            : 'border-ink bg-surface hover:bg-surface-2'
                        "
                      >
                        <span
                          class="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2"
                          [ngClass]="
                            habit.doneToday ? 'border-success bg-success text-surface' : 'border-ink-faint'
                          "
                        >
                          @if (habit.doneToday) {
                            <app-icon name="check" [size]="13" [strokeWidth]="3" />
                          }
                        </span>
                        <span class="min-w-0 flex-1">
                          <span
                            class="block truncate text-sm font-medium"
                            [class.text-ink-faint]="habit.doneToday"
                            [class.line-through]="habit.doneToday"
                          >
                            {{ habit.name }}
                          </span>
                        </span>
                        <span
                          class="shrink-0 text-xs font-semibold"
                          [class.text-success]="habit.doneToday"
                          [class.text-ink-faint]="!habit.doneToday"
                        >
                          🔥 {{ habit.streak }}
                        </span>
                      </button>
                    </li>
                  }
                </ul>
              }
            </div>
          </app-card>

          <!-- Upcoming -->
          <app-card [padding]="'none'">
            <div class="flex items-center justify-between border-b-2 border-ink px-5 py-4">
              <h2 class="flex items-center gap-2 text-base font-bold text-ink">
                <app-icon name="clock" [size]="18" /> Upcoming
              </h2>
              <button (click)="go('/calendar')" class="text-xs font-medium text-primary-strong hover:underline">
                Calendar
              </button>
            </div>
            <div class="max-h-80 space-y-4 overflow-y-auto p-4">
              @if (today.upcomingReminders.length === 0 && today.upcomingTasks.length === 0) {
                <p class="py-6 text-center text-sm text-ink-soft">Nothing scheduled ahead.</p>
              }
              @if (today.upcomingReminders.length > 0) {
                <div>
                  <p class="mb-1.5 px-1 text-[11px] font-bold uppercase tracking-widest text-ink-faint">
                    Reminders
                  </p>
                  <ul class="space-y-1">
                    @for (reminder of today.upcomingReminders; track reminder._id) {
                      <li class="flex items-center gap-3 rounded-button px-2 py-1.5 hover:bg-surface-2">
                        <span
                          class="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border-2 border-ink bg-warning/20 text-ink"
                        >
                          <app-icon name="bell" [size]="14" />
                        </span>
                        <span class="min-w-0 flex-1 truncate text-sm font-medium text-ink">
                          {{ reminder.title }}
                        </span>
                        <span class="shrink-0 text-xs font-semibold text-ink-soft">
                          {{ formatTime(reminder.datetime) }}
                        </span>
                      </li>
                    }
                  </ul>
                </div>
              }
              @if (today.upcomingTasks.length > 0) {
                <div>
                  <p class="mb-1.5 px-1 text-[11px] font-bold uppercase tracking-widest text-ink-faint">
                    Tasks
                  </p>
                  <ul class="space-y-1">
                    @for (task of today.upcomingTasks; track task._id) {
                      <li class="flex items-center gap-3 rounded-button px-2 py-1.5 hover:bg-surface-2">
                        <span
                          class="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border-2 border-ink bg-primary/20 text-ink"
                        >
                          <app-icon name="calendar" [size]="14" />
                        </span>
                        <span class="min-w-0 flex-1 truncate text-sm font-medium text-ink">
                          {{ task.title }}
                        </span>
                        <span class="shrink-0 text-xs font-semibold text-ink-soft">
                          {{ formatDate(task.dueDate, 'short') }}
                        </span>
                      </li>
                    }
                  </ul>
                </div>
              }
            </div>
          </app-card>
        </div>
      }
    </div>
  `,
})
export class TodayComponent implements OnInit {
  private todayService = inject(TodayService);
  private taskService = inject(TaskService);
  private habitService = inject(HabitService);
  private toast = inject(ToastService);
  private command = inject(CommandService);
  private router = inject(Router);

  protected readonly data = signal<TodayData | null>(null);
  protected readonly loading = signal(true);
  protected readonly error = signal(false);

  protected readonly todayLabel = computed(() =>
    new Intl.DateTimeFormat('en-US', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
    }).format(new Date())
  );

  protected readonly greetingText = computed(() => {
    const h = new Date().getHours();
    if (h >= 5 && h < 12) return 'Good morning ☀️';
    if (h >= 12 && h < 17) return 'Good afternoon 🌤️';
    if (h >= 17 && h < 21) return 'Good evening 🌆';
    return 'Good night 🌙';
  });

  protected readonly taskProgress = computed(() => {
    const p = this.data()?.progress;
    return p ? percent(p.completedTasksToday, p.totalTasksToday) : 0;
  });

  protected readonly habitProgress = computed(() => {
    const p = this.data()?.progress;
    return p ? percent(p.habitsDone, p.habitsTotal) : 0;
  });

  ngOnInit(): void {
    this.load();
  }

  protected load(): void {
    this.loading.set(true);
    this.error.set(false);
    this.todayService.get().subscribe({
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

  protected toggleTask(task: Task): void {
    const completed = task.status === 'completed';
    this.taskService
      .update(task._id, { status: completed ? 'todo' : 'completed' })
      .subscribe({
        next: () => {
          this.toast.success(completed ? 'Task reopened' : 'Task completed 🎉');
          this.load();
        },
        error: (err: Error) => this.toast.error(err.message),
      });
  }

  protected toggleHabit(habit: TodayHabit): void {
    this.habitService.toggle(habit._id).subscribe({
      next: () => {
        this.toast.success(habit.doneToday ? 'Habit unchecked' : 'Habit done 🔥');
        this.load();
      },
      error: (err: Error) => this.toast.error(err.message),
    });
  }

  protected goalProgress(progress: number, target: number | null | undefined): number {
    if (!target) return Math.min(progress, 100);
    return percent(progress, target);
  }

  protected quickAdd(entity: string): void {
    this.command.openQuickAdd(entity);
  }

  protected go(route: string): void {
    this.router.navigate([route]);
  }

  protected readonly formatCurrency = formatCurrency;
  protected readonly formatDate = formatDate;
  protected readonly formatTime = formatTime;
}
