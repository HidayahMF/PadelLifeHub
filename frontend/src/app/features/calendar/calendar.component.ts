import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NgClass } from '@angular/common';
import { CardComponent } from '../../layout/components/card.component';
import { ButtonComponent } from '../../layout/components/button.component';
import { IconComponent } from '../../layout/components/icon.component';
import { SkeletonComponent } from '../../layout/components/skeleton.component';
import { FieldComponent } from '../../layout/components/field.component';
import { SelectComponent } from '../../layout/components/select.component';
import { ModalComponent } from '../../layout/components/modal.component';
import { BadgeComponent } from '../../layout/components/badge.component';
import { SegmentedComponent } from '../../layout/components/segmented.component';
import { TaskService } from '../../core/services/task.service';
import { HabitService, ReminderService, GoalService } from '../../core/services/lifestyle.service';
import { ToastService } from '../../core/services/toast.service';
import type { Task } from '../../core/models/task.model';
import type { Goal, Habit, Reminder } from '../../core/models/lifestyle.model';
import { formatDate, formatTime, toDate } from '../../core/utils/format';
import {
  formatDateToLocalYYYYMMDD,
  getTodayLocalDate,
  localDateToDate,
} from '../../core/utils/date';

type ViewMode = 'month' | 'week' | 'day' | 'agenda';

interface DayCell {
  date: Date;
  key: string;
  inMonth: boolean;
  isToday: boolean;
  tasks: Task[];
  goals: Goal[];
  reminders: Reminder[];
  habits: Habit[];
}

interface CalendarItem {
  id: string;
  kind: 'task' | 'goal' | 'reminder';
  title: string;
  subtitle: string;
  time: string;
  dateKey: string;
  status?: string;
  task?: Task;
  goal?: Goal;
  reminder?: Reminder;
}

const VIEW_OPTIONS = [
  { value: 'month', label: 'Month' },
  { value: 'week', label: 'Week' },
  { value: 'day', label: 'Day' },
  { value: 'agenda', label: 'Agenda' },
];

const REMINDER_TYPE_OPTIONS = [
  { value: 'custom', label: 'Custom' },
  { value: 'task', label: 'Task' },
  { value: 'bill', label: 'Bill' },
  { value: 'shopping', label: 'Shopping' },
  { value: 'goal', label: 'Goal' },
  { value: 'wishlist', label: 'Wishlist' },
];

const RECURRING_OPTIONS = [
  { value: 'none', label: 'Once' },
  { value: 'daily', label: 'Daily' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'monthly', label: 'Monthly' },
  { value: 'yearly', label: 'Yearly' },
];

@Component({
  selector: 'app-calendar',
  standalone: true,
  imports: [
    NgClass,
    FormsModule,
    CardComponent,
    ButtonComponent,
    IconComponent,
    SkeletonComponent,
    FieldComponent,
    SelectComponent,
    ModalComponent,
    BadgeComponent,
    SegmentedComponent,
  ],
  template: `
    <div class="mb-6 flex flex-wrap items-center justify-between gap-4">
      <div>
        <h1 class="text-2xl font-bold tracking-tight text-ink">Calendar</h1>
        <p class="mt-1 text-sm text-ink-soft">Tasks, goals, habits and reminders — Asia/Jakarta time.</p>
      </div>
      <div class="flex flex-wrap items-center gap-2">
        <app-segmented [options]="viewOptions()" [model]="view()" (change)="setView($event)" />
        <app-button icon="bell-ring" (click)="openCreate()">New reminder</app-button>
        <app-button size="icon" variant="secondary" icon="chevron-left"
          [attr.aria-label]="'Previous'" (click)="shift(-1)"></app-button>
        <app-button variant="secondary" (click)="goToday()">Today</app-button>
        <app-button size="icon" variant="secondary" icon="chevron-right"
          [attr.aria-label]="'Next'" (click)="shift(1)"></app-button>
      </div>
    </div>

    @if (loading()) {
      <div class="grid grid-cols-7 gap-1">
        @for (_ of [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21]; track $index) {
          <app-skeleton size="button" />
        }
      </div>
    } @else {
      <app-card [padding]="'none'">
        <!-- Month view -->
        @if (view() === 'month') {
          <div class="grid grid-cols-7 border-b border-line">
            @for (day of ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']; track day) {
              <div class="px-2 py-3 text-center text-xs font-semibold uppercase tracking-wide text-ink-faint">
                {{ day }}
              </div>
            }
          </div>
          <div class="grid grid-cols-7">
            @for (cell of cells(); track cell.key) {
              <button
                (click)="selectDay(cell.key)"
                class="flex min-h-[96px] flex-col items-start gap-1 border-b border-r border-line p-2 text-left transition-colors last:border-r-0 hover:bg-surface-2/60"
                [ngClass]="{ 'bg-surface-2/40': !cell.inMonth, 'bg-primary/10': cell.key === selected() }"
              >
                <span
                  class="flex h-7 w-7 items-center justify-center rounded-full text-sm"
                  [ngClass]="
                    cell.isToday
                      ? 'bg-primary font-bold text-ink'
                      : cell.inMonth
                        ? 'font-medium text-ink'
                        : 'text-ink-faint'
                  "
                >
                  {{ cell.date.getDate() }}
                </span>
                <span class="flex max-w-full flex-col gap-1">
                  @for (t of cell.tasks.slice(0, 3); track t._id) {
                    <span
                      class="max-w-full truncate rounded-md px-1.5 py-0.5 text-[11px]"
                      [ngClass]="
                        t.status === 'completed' ? 'bg-surface-2 text-ink-faint line-through' : 'bg-primary/15 text-ink'
                      "
                    >
                      {{ t.title }}
                    </span>
                  }
                  @if (cell.tasks.length > 3) {
                    <span class="px-1 text-[10px] font-bold text-ink-faint">+{{ cell.tasks.length - 3 }} more</span>
                  }
                  @for (r of cell.reminders.slice(0, 2); track r._id) {
                    <span class="max-w-full truncate rounded-md bg-warning/25 px-1.5 py-0.5 text-[11px] text-ink">
                      <app-icon name="bell" [size]="9" /> {{ formatTime(r.datetime) }} {{ r.title }}
                    </span>
                  }
                  @for (g of cell.goals; track g._id) {
                    <span class="max-w-full truncate rounded-md bg-secondary/20 px-1.5 py-0.5 text-[11px] text-ink">
                      🎯 {{ g.title }}
                    </span>
                  }
                  @if (cell.habits.length > 0) {
                    <span class="flex items-center gap-1 rounded-md bg-success/15 px-1.5 py-0.5 text-[11px] font-semibold text-success">
                      <app-icon name="flame" [size]="10" /> {{ cell.habits.length }} habit{{ cell.habits.length === 1 ? '' : 's' }}
                    </span>
                  }
                </span>
              </button>
            }
          </div>
        }

        <!-- Week view -->
        @if (view() === 'week') {
          <div class="grid grid-cols-7 border-b border-line">
            @for (cell of weekCells(); track cell.key) {
              <div class="border-r border-line px-2 py-2 text-center last:border-r-0">
                <p class="text-[11px] font-bold uppercase tracking-wide text-ink-faint">
                  {{ cell.date.toLocaleDateString('en-US', { weekday: 'short' }) }}
                </p>
                <span
                  class="mt-1 inline-flex h-7 w-7 items-center justify-center rounded-full text-sm"
                  [ngClass]="cell.isToday ? 'bg-primary font-bold text-ink' : 'font-medium text-ink'"
                >
                  {{ cell.date.getDate() }}
                </span>
              </div>
            }
          </div>
          <div class="grid grid-cols-7">
            @for (cell of weekCells(); track cell.key) {
              <div class="min-h-[280px] border-r border-line p-1.5 last:border-r-0">
                <button
                  (click)="selectDay(cell.key)"
                  class="w-full rounded-lg border-2 border-transparent p-1 text-left hover:border-ink"
                  [class.bg-primary/10]="cell.key === selected()"
                >
                  <span class="flex flex-col gap-1">
                    @for (t of cell.tasks; track t._id) {
                      <span
                        class="max-w-full truncate rounded-md px-1.5 py-0.5 text-[11px]"
                        [ngClass]="t.status === 'completed' ? 'bg-surface-2 text-ink-faint line-through' : 'bg-primary/15 text-ink'"
                      >
                        {{ t.title }}
                      </span>
                    }
                    @for (r of cell.reminders; track r._id) {
                      <span class="max-w-full truncate rounded-md bg-warning/25 px-1.5 py-0.5 text-[11px] text-ink">
                        {{ formatTime(r.datetime) }} {{ r.title }}
                      </span>
                    }
                    @for (g of cell.goals; track g._id) {
                      <span class="max-w-full truncate rounded-md bg-secondary/20 px-1.5 py-0.5 text-[11px] text-ink">🎯 {{ g.title }}</span>
                    }
                    @if (cell.habits.length > 0) {
                      <span class="flex items-center gap-1 rounded-md bg-success/15 px-1.5 py-0.5 text-[11px] font-semibold text-success">
                        <app-icon name="flame" [size]="10" /> {{ cell.habits.length }}
                      </span>
                    }
                  </span>
                </button>
              </div>
            }
          </div>
        }

        <!-- Day view -->
        @if (view() === 'day') {
          <div class="p-4">
            <p class="mb-3 font-display text-lg text-ink">{{ formatDate(dayDate(), 'long') }}</p>
            @if (dayItems().length === 0) {
              <p class="py-10 text-center text-sm text-ink-soft">Nothing scheduled for this day.</p>
            }
            <ul class="space-y-1.5">
              @for (item of dayItems(); track item.id) {
                <li>
                  <button
                    (click)="openDetail(item)"
                    class="flex w-full items-center gap-3 rounded-button border-2 border-ink bg-surface px-3 py-2.5 text-left shadow-soft transition-all hover:-translate-y-0.5"
                  >
                    <span class="w-14 shrink-0 text-xs font-bold text-ink-soft">{{ item.time || '—' }}</span>
                    <app-icon [name]="kindIcon(item.kind)" [size]="17" class="shrink-0 text-ink-soft" />
                    <span class="min-w-0 flex-1 truncate text-sm font-medium text-ink">{{ item.title }}</span>
                    @if (item.status) {
                      <app-badge [tone]="item.status === 'done' || item.status === 'sent' ? 'success' : 'neutral'">{{ item.status }}</app-badge>
                    }
                  </button>
                </li>
              }
            </ul>
          </div>
        }

        <!-- Agenda view -->
        @if (view() === 'agenda') {
          <div class="p-4">
            <p class="mb-3 text-sm font-medium text-ink-soft">{{ agendaRangeLabel() }}</p>
            @if (agendaItems().length === 0) {
              <p class="py-10 text-center text-sm text-ink-soft">Nothing scheduled in this period.</p>
            }
            @for (group of agendaGroups(); track group.dateKey) {
              <div class="mb-4">
                <p class="mb-1.5 text-xs font-bold uppercase tracking-widest text-ink-faint">
                  {{ formatDate(group.dateKey, 'long') }}
                  @if (group.isToday) { · today }
                </p>
                <ul class="space-y-1.5">
                  @for (item of group.items; track item.id) {
                    <li>
                      <button
                        (click)="openDetail(item)"
                        class="flex w-full items-center gap-3 rounded-button border-2 border-ink bg-surface px-3 py-2.5 text-left shadow-soft transition-all hover:-translate-y-0.5"
                      >
                        <span class="w-14 shrink-0 text-xs font-bold text-ink-soft">{{ item.time || '—' }}</span>
                        <app-icon [name]="kindIcon(item.kind)" [size]="17" class="shrink-0 text-ink-soft" />
                        <span class="min-w-0 flex-1 truncate text-sm font-medium text-ink">{{ item.title }}</span>
                        @if (item.subtitle) {
                          <span class="hidden shrink-0 text-xs text-ink-faint sm:block">{{ item.subtitle }}</span>
                        }
                        @if (item.status) {
                          <app-badge [tone]="item.status === 'done' || item.status === 'sent' ? 'success' : 'neutral'">{{ item.status }}</app-badge>
                        }
                      </button>
                    </li>
                  }
                </ul>
              </div>
            }
          </div>
        }
      </app-card>

      @if (view() !== 'day' && selected()) {
        <app-card class="mt-4">
          <div class="flex flex-wrap items-center justify-between gap-3">
            <h2 class="text-base font-semibold text-ink">{{ formatDate(selectedDate(), 'long') }}</h2>
            <div class="flex items-center gap-2">
              <app-button size="sm" variant="secondary" icon="bell-ring" (click)="openCreateForSelected()">
                Add reminder
              </app-button>
              <app-button size="sm" variant="ghost" icon="calendar-days" (click)="setView('day')">
                Day view
              </app-button>
            </div>
          </div>
          @if (dayItems().length === 0) {
            <p class="mt-3 text-sm text-ink-soft">Nothing scheduled for this day.</p>
          }
          <ul class="mt-3 divide-y divide-line">
            @for (item of dayItems(); track item.id) {
              <li class="flex items-center gap-3 py-3">
                <button class="flex min-w-0 flex-1 items-center gap-3 text-left" (click)="openDetail(item)">
                  <app-icon [name]="kindIcon(item.kind)" [size]="17" class="shrink-0 text-ink-soft" />
                  <span class="min-w-0 flex-1 truncate text-sm font-medium text-ink">{{ item.title }}</span>
                  @if (item.time) {
                    <span class="shrink-0 text-xs text-ink-faint">{{ item.time }}</span>
                  }
                  @if (item.status) {
                    <app-badge [tone]="item.status === 'done' || item.status === 'sent' ? 'success' : 'warning'">{{ item.status }}</app-badge>
                  }
                </button>
                @if (item.reminder) {
                  <div class="flex shrink-0 items-center gap-0.5">
                    <app-button size="icon" variant="ghost" icon="pencil"
                      [attr.aria-label]="'Edit reminder'" (click)="openEdit(item.reminder!)"></app-button>
                    <app-button size="icon" variant="ghost" icon="trash-2"
                      [attr.aria-label]="'Delete reminder'" (click)="removeReminder(item.reminder!)"></app-button>
                  </div>
                }
              </li>
            }
          </ul>
        </app-card>
      }
    }

    <!-- Item detail modal -->
    <app-modal [open]="detailOpen()" title="Event details" (closed)="detailOpen.set(false)">
      @if (detail(); as item) {
        <div class="space-y-4">
          <div class="flex flex-wrap items-center gap-2">
            <app-badge [tone]="detailTone(item.kind)">{{ titleCase(item.kind) }}</app-badge>
            @if (item.status) {
              <app-badge [tone]="item.status === 'done' || item.status === 'sent' ? 'success' : 'neutral'">{{ item.status }}</app-badge>
            }
          </div>
          <div>
            <p class="text-xs font-medium uppercase tracking-wide text-ink-faint">Title</p>
            <p class="mt-1 text-sm font-medium text-ink">{{ item.title }}</p>
          </div>
          <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <p class="text-xs font-medium uppercase tracking-wide text-ink-faint">Date</p>
              <p class="mt-1 text-sm text-ink">{{ formatDate(item.dateKey, 'long') }}</p>
            </div>
            <div>
              <p class="text-xs font-medium uppercase tracking-wide text-ink-faint">Time</p>
              <p class="mt-1 text-sm text-ink">{{ item.time || 'All day' }}</p>
            </div>
          </div>
          @if (item.subtitle) {
            <div>
              <p class="text-xs font-medium uppercase tracking-wide text-ink-faint">Details</p>
              <p class="mt-1 text-sm text-ink">{{ item.subtitle }}</p>
            </div>
          }
          @if (item.task) {
            <div class="flex justify-end gap-2 pt-1">
              @if (item.task.status !== 'completed') {
                <app-button icon="circle-check" (click)="completeTask(item.task!)">Mark complete</app-button>
              }
            </div>
          }
        </div>
      }
    </app-modal>

    <!-- Reminder create/edit modal -->
    <app-modal
      [open]="modalOpen()"
      [title]="editing() ? 'Edit reminder' : 'New reminder'"
      (closed)="modalOpen.set(false)"
    >
      <form (ngSubmit)="saveReminder()" class="space-y-4">
        <app-field label="Title" placeholder="e.g. Pay electricity bill" [required]="true"
          [(ngModel)]="form.title" name="title" />
        <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <app-field label="Date & time" type="datetime-local" [required]="true"
            [(ngModel)]="form.datetime" name="datetime" />
          <app-select label="Type" [options]="reminderTypeOptions()"
            [(ngModel)]="form.type" name="type" />
        </div>
        <app-select label="Repeat" [options]="recurringOptions()" [hint]="'Daily, weekly, monthly or yearly'"
          [(ngModel)]="form.frequency" name="frequency" />
        <div class="flex justify-end gap-2 pt-2">
          <app-button type="button" variant="secondary" (click)="modalOpen.set(false)">Cancel</app-button>
          <app-button type="submit" [loading]="saving()">Save reminder</app-button>
        </div>
      </form>
    </app-modal>
  `,
})
export class CalendarComponent implements OnInit {
  private taskService = inject(TaskService);
  private reminderService = inject(ReminderService);
  private goalService = inject(GoalService);
  private habitService = inject(HabitService);
  private toast = inject(ToastService);

  protected readonly loading = signal(true);
  protected readonly view = signal<ViewMode>('month');
  protected readonly viewDate = signal(new Date());
  protected readonly selected = signal(getTodayLocalDate());

  protected readonly tasks = signal<Task[]>([]);
  protected readonly reminders = signal<Reminder[]>([]);
  protected readonly goals = signal<Goal[]>([]);
  protected readonly habits = signal<Habit[]>([]);

  protected readonly modalOpen = signal(false);
  protected readonly editing = signal<Reminder | null>(null);
  protected readonly saving = signal(false);
  protected readonly detailOpen = signal(false);
  protected readonly detail = signal<CalendarItem | null>(null);

  protected form: { title: string; datetime: string; type: string; frequency: string } = {
    title: '',
    datetime: '',
    type: 'custom',
    frequency: 'none',
  };

  private pendingRequests = 0;

  protected readonly viewOptions = computed(() => VIEW_OPTIONS);
  protected readonly reminderTypeOptions = computed(() => REMINDER_TYPE_OPTIONS);
  protected readonly recurringOptions = computed(() => RECURRING_OPTIONS);

  ngOnInit(): void {
    this.beginLoad();
    this.taskService.getAll().subscribe({
      next: (res) => {
        this.tasks.set(res.filter((t) => !t.archived));
        this.finishLoad();
      },
      error: () => this.finishLoad(),
    });
    this.beginLoad();
    this.reminderService.getAll().subscribe({
      next: (res) => {
        this.reminders.set(res);
        this.finishLoad();
      },
      error: () => this.finishLoad(),
    });
    this.beginLoad();
    this.goalService.getAll({ completed: 'false' }).subscribe({
      next: (res) => {
        this.goals.set(res);
        this.finishLoad();
      },
      error: () => this.finishLoad(),
    });
    this.beginLoad();
    this.habitService.getAll().subscribe({
      next: (res) => {
        this.habits.set(res.filter((h) => !h.archived));
        this.finishLoad();
      },
      error: () => this.finishLoad(),
    });
  }

  private beginLoad(): void {
    this.pendingRequests += 1;
    this.loading.set(true);
  }

  private finishLoad(): void {
    this.pendingRequests = Math.max(0, this.pendingRequests - 1);
    if (this.pendingRequests === 0) this.loading.set(false);
  }

  /** Grid cells for the current month view. */
  protected readonly cells = computed<DayCell[]>(() => {
    const month = this.viewDate();
    const year = month.getFullYear();
    const m = month.getMonth();
    const first = new Date(year, m, 1);
    const startOffset = (first.getDay() + 6) % 7;
    const gridStart = new Date(year, m, 1 - startOffset);
    const todayKey = getTodayLocalDate();
    const result: DayCell[] = [];
    for (let i = 0; i < 42; i++) {
      const date = new Date(gridStart);
      date.setDate(gridStart.getDate() + i);
      result.push({ ...this.buildCell(date), inMonth: date.getMonth() === m, isToday: false });
    }
    // Mark today (cells may span another month).
    result.forEach((c) => (c.isToday = c.key === todayKey));
    return result;
  });

  /** Monday → Sunday cells for the week view. */
  protected readonly weekCells = computed<DayCell[]>(() => {
    const anchor = this.viewDate();
    const monday = new Date(anchor);
    monday.setHours(0, 0, 0, 0);
    while (monday.getDay() !== 1) monday.setDate(monday.getDate() - 1);
    const todayKey = getTodayLocalDate();
    const out: DayCell[] = [];
    for (let i = 0; i < 7; i++) {
      const date = new Date(monday);
      date.setDate(monday.getDate() + i);
      out.push({ ...this.buildCell(date), inMonth: true, isToday: false });
    }
    out.forEach((c) => (c.isToday = c.key === todayKey));
    return out;
  });

  private buildCell(date: Date): Omit<DayCell, 'inMonth' | 'isToday'> {
    const iso = formatDateToLocalYYYYMMDD(date);
    return {
      date,
      key: iso,
      tasks: this.tasks().filter(
        (t) => t.dueDate && formatDateToLocalYYYYMMDD(toDate(t.dueDate)) === iso
      ),
      goals: this.goals().filter(
        (g) => g.deadline && formatDateToLocalYYYYMMDD(toDate(g.deadline)) === iso
      ),
      reminders: this.reminders().filter(
        (r) => formatDateToLocalYYYYMMDD(toDate(r.datetime)) === iso
      ),
      habits: this.habits().filter((h) => (h.completedDates ?? []).includes(iso)),
    };
  }

  protected readonly dayDate = computed(() => {
    const anchor = this.viewDate();
    if (this.view() !== 'day') return anchor;
    return anchor;
  });

  private toItems(cell: Omit<DayCell, 'inMonth' | 'isToday'>): CalendarItem[] {
    const items: CalendarItem[] = [
      ...cell.tasks.map((t) => ({
        id: `task-${t._id}`,
        kind: 'task' as const,
        title: t.title,
        subtitle: t.description || '',
        time: t.dueDate ? formatTime(t.dueDate) : '',
        dateKey: cell.key,
        status: t.status === 'completed' ? 'done' : t.status === 'in-progress' ? 'in progress' : 'todo',
        task: t,
      })),
      ...cell.goals.map((g) => ({
        id: `goal-${g._id}`,
        kind: 'goal' as const,
        title: g.title,
        subtitle: g.description || '',
        time: '',
        dateKey: cell.key,
        status: 'active',
        goal: g,
      })),
      ...cell.reminders.map((r) => ({
        id: `reminder-${r._id}`,
        kind: 'reminder' as const,
        title: r.title,
        subtitle: r.sent ? 'Already notified' : 'Upcoming reminder',
        time: formatTime(r.datetime),
        dateKey: cell.key,
        status: r.sent ? 'sent' : 'upcoming',
        reminder: r,
      })),
    ];
    return items.sort((a, b) => a.time.localeCompare(b.time) || a.title.localeCompare(b.title));
  }

  protected readonly selectedDate = computed(() => localDateToDate(this.selected()) ?? new Date());

  protected readonly dayItems = computed<CalendarItem[]>(() => {
    if (this.view() === 'day') {
      const anchor = this.viewDate();
      const key = formatDateToLocalYYYYMMDD(anchor);
      return this.toItems(this.buildCell(anchor)).map((i) => ({ ...i, dateKey: key }));
    }
    const cell = this.allCells().find((c) => c.key === this.selected());
    return cell ? this.toItems(cell) : [];
  });

  private readonly allCells = computed<DayCell[]>(() => {
    const month = this.viewDate();
    const year = month.getFullYear();
    const m = month.getMonth();
    const first = new Date(year, m, 1);
    const startOffset = (first.getDay() + 6) % 7;
    const gridStart = new Date(year, m, 1 - startOffset);
    const out: DayCell[] = [];
    for (let i = 0; i < 42; i++) {
      const date = new Date(gridStart);
      date.setDate(gridStart.getDate() + i);
      out.push({ ...this.buildCell(date), inMonth: date.getMonth() === m, isToday: false });
    }
    return out;
  });

  /** Flat chronological list for the current month (agenda view). */
  protected readonly agendaItems = computed<CalendarItem[]>(() => {
    const list: CalendarItem[] = [];
    for (const cell of this.allCells()) {
      if (cell.inMonth) list.push(...this.toItems(cell));
    }
    return list.sort((a, b) => a.dateKey.localeCompare(b.dateKey) || a.time.localeCompare(b.time));
  });

  protected readonly agendaGroups = computed<
    { dateKey: string; isToday: boolean; items: CalendarItem[] }[]
  >(() => {
    const today = getTodayLocalDate();
    const map = new Map<string, CalendarItem[]>();
    for (const item of this.agendaItems()) {
      const list = map.get(item.dateKey) ?? [];
      list.push(item);
      map.set(item.dateKey, list);
    }
    return [...map.entries()].map(([dateKey, items]) => ({
      dateKey,
      isToday: dateKey === today,
      items,
    }));
  });

  protected readonly agendaRangeLabel = computed(() => {
    const month = this.viewDate();
    return month.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  });

  protected setView(value: string): void {
    this.view.set(value as ViewMode);
    if (value === 'day') {
      const d = localDateToDate(this.selected()) ?? new Date();
      this.viewDate.set(d);
    }
  }

  protected shift(dir: number): void {
    const d = new Date(this.viewDate());
    switch (this.view()) {
      case 'month':
      case 'agenda':
        d.setMonth(d.getMonth() + dir);
        break;
      case 'week':
        d.setDate(d.getDate() + 7 * dir);
        break;
      case 'day':
        d.setDate(d.getDate() + dir);
        break;
    }
    this.viewDate.set(d);
    if (this.view() !== 'day') {
      this.selected.set(formatDateToLocalYYYYMMDD(d));
    }
  }

  protected goToday(): void {
    this.viewDate.set(new Date());
    this.selected.set(getTodayLocalDate());
  }

  protected selectDay(key: string): void {
    this.selected.set(key);
    // Keep the visible month in sync when picking a day from an overflow cell.
    const d = localDateToDate(key);
    if (d) {
      const anchor = this.viewDate();
      if (d.getFullYear() !== anchor.getFullYear() || d.getMonth() !== anchor.getMonth()) {
        this.viewDate.set(d);
      }
    }
  }

  protected openDetail(item: CalendarItem): void {
    this.detail.set(item);
    this.detailOpen.set(true);
  }

  protected completeTask(task: Task): void {
    this.taskService.update(task._id, { status: 'completed' }).subscribe({
      next: () => {
        this.toast.success('Task completed 🎉');
        this.detailOpen.set(false);
        this.taskService.getAll().subscribe((res) => {
          this.tasks.set(res.filter((t) => !t.archived));
        });
      },
      error: (err: Error) => this.toast.error(err.message),
    });
  }

  protected openCreate = (): void => {
    this.editing.set(null);
    this.form = { title: '', datetime: this.defaultDateTime(), type: 'custom', frequency: 'none' };
    this.modalOpen.set(true);
  };

  protected openCreateForSelected(): void {
    const date = localDateToDate(this.selected()) ?? new Date();
    const ymd = formatDateToLocalYYYYMMDD(date);
    this.editing.set(null);
    this.form = { title: '', datetime: `${ymd}T09:00`, type: 'custom', frequency: 'none' };
    this.modalOpen.set(true);
  }

  protected openEdit(reminder: Reminder): void {
    this.editing.set(reminder);
    const d = toDate(reminder.datetime);
    const ymd = formatDateToLocalYYYYMMDD(d);
    const hh = String(d.getHours()).padStart(2, '0');
    const mm = String(d.getMinutes()).padStart(2, '0');
    this.form = {
      title: reminder.title,
      datetime: `${ymd}T${hh}:${mm}`,
      type: reminder.type,
      frequency: reminder.recurring?.isRecurring ? (reminder.recurring.frequency ?? 'monthly') : 'none',
    };
    this.modalOpen.set(true);
  }

  protected saveReminder(): void {
    if (!this.form.title?.trim() || !this.form.datetime) {
      this.toast.error('Title and date/time are required.');
      return;
    }
    const isRecurring = this.form.frequency !== 'none';
    const payload: Partial<Reminder> = {
      title: this.form.title.trim(),
      datetime: new Date(this.form.datetime).toISOString(),
      type: this.form.type as Reminder['type'],
      recurring: { isRecurring, frequency: isRecurring ? this.form.frequency : 'none' },
    };
    this.saving.set(true);
    const obs = this.editing()
      ? this.reminderService.update(this.editing()!._id, payload)
      : this.reminderService.create(payload);
    obs.subscribe({
      next: () => {
        this.saving.set(false);
        this.toast.success(this.editing() ? 'Reminder updated' : 'Reminder created');
        this.modalOpen.set(false);
        this.reminderService.getAll().subscribe((res) => this.reminders.set(res));
      },
      error: (err: Error) => {
        this.saving.set(false);
        this.toast.error(err.message);
      },
    });
  }

  protected removeReminder(reminder: Reminder): void {
    if (!confirm(`Delete reminder "${reminder.title}"?`)) return;
    this.reminderService.remove(reminder._id).subscribe({
      next: () => {
        this.toast.success('Reminder deleted');
        this.reminders.update((list) => list.filter((r) => r._id !== reminder._id));
      },
      error: (err: Error) => this.toast.error(err.message),
    });
  }

  protected kindIcon(kind: CalendarItem['kind']): string {
    if (kind === 'task') return 'list-todo';
    if (kind === 'goal') return 'target';
    return 'bell';
  }

  protected detailTone(kind: CalendarItem['kind']): 'neutral' | 'info' | 'warning' {
    if (kind === 'task') return 'neutral';
    if (kind === 'goal') return 'info';
    return 'warning';
  }

  protected titleCase(value: string): string {
    return value
      .split('-')
      .map((w) => (w ? w[0].toUpperCase() + w.slice(1) : w))
      .join(' ');
  }

  private defaultDateTime(): string {
    const date = localDateToDate(this.selected()) ?? new Date();
    return formatDateToLocalYYYYMMDD(date) + 'T09:00';
  }

  protected readonly formatDate = formatDate;
  protected readonly formatTime = formatTime;
}
