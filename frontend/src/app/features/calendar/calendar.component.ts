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
import { TaskService } from '../../core/services/task.service';
import { ReminderService, GoalService } from '../../core/services/lifestyle.service';
import { ToastService } from '../../core/services/toast.service';
import type { Task } from '../../core/models/task.model';
import type { Goal, Reminder } from '../../core/models/lifestyle.model';
import { formatDate, formatTime, toDate } from '../../core/utils/format';
import {
  formatDateToLocalYYYYMMDD,
  getTodayLocalDate,
  localDateToDate,
} from '../../core/utils/date';

interface DayCell {
  date: Date;
  key: string;
  inMonth: boolean;
  isToday: boolean;
  tasks: Task[];
  goals: Goal[];
  reminders: Reminder[];
}

interface DayItem {
  id: string;
  kind: 'task' | 'goal' | 'reminder';
  title: string;
  time: string;
  status?: string;
  reminder?: Reminder;
}

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
  ],
  template: `
    <div class="mb-6 flex flex-wrap items-center justify-between gap-4">
      <div>
        <h1 class="text-2xl font-bold tracking-tight text-ink">Calendar</h1>
        <p class="mt-1 text-sm text-ink-soft">Tasks, goals and reminders at a glance.</p>
      </div>
      <div class="flex flex-wrap items-center gap-2">
        <app-button icon="bell-ring" (click)="openCreate()">New reminder</app-button>
        <app-button size="icon" variant="secondary" icon="chevron-left"
          [attr.aria-label]="'Previous month'" (click)="shiftMonth(-1)"></app-button>
        <app-button variant="secondary" (click)="goToday()">Today</app-button>
        <app-button size="icon" variant="secondary" icon="chevron-right"
          [attr.aria-label]="'Next month'" (click)="shiftMonth(1)"></app-button>
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
              (click)="selectDay(cell)"
              class="flex min-h-[96px] flex-col items-start gap-1 border-b border-r border-line p-2 text-left transition-colors last:border-r-0 hover:bg-surface-2/60"
              [ngClass]="{
                'bg-surface-2/40': !cell.inMonth,
                'bg-primary/10': cell.key === selected(),
              }"
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
                @for (t of cell.tasks; track t._id) {
                  <span
                    class="max-w-full truncate rounded-md px-1.5 py-0.5 text-[11px]"
                    [ngClass]="
                      t.status === 'completed' ? 'bg-surface-2 text-ink-faint' : 'bg-primary/15 text-ink'
                    "
                  >
                    {{ t.title }}
                  </span>
                }
                @for (g of cell.goals; track g._id) {
                  <span class="max-w-full truncate rounded-md bg-secondary/20 px-1.5 py-0.5 text-[11px] text-ink">
                    🎯 {{ g.title }}
                  </span>
                }
                @for (r of cell.reminders; track r._id) {
                  <span class="max-w-full truncate rounded-md bg-danger/10 px-1.5 py-0.5 text-[11px] text-danger">
                    {{ formatTime(r.datetime) }} · {{ r.title }}
                  </span>
                }
              </span>
            </button>
          }
        </div>
      </app-card>

      @if (selected()) {
        <app-card class="mt-4">
          <div class="flex flex-wrap items-center justify-between gap-3">
            <h2 class="text-base font-semibold text-ink">
              {{ formatDate(selectedDate(), 'long') }}
            </h2>
            <app-button size="sm" variant="secondary" icon="bell-ring" (click)="openCreateForSelected()">
              Add reminder
            </app-button>
          </div>
          @if (selectedItems().length === 0) {
            <p class="mt-3 text-sm text-ink-soft">Nothing scheduled for this day.</p>
          }
          <ul class="mt-3 divide-y divide-line">
            @for (item of selectedItems(); track item.id) {
              <li class="flex items-center gap-3 py-3">
                <app-icon
                  [name]="item.kind === 'task' ? 'list-todo' : item.kind === 'goal' ? 'target' : 'bell'"
                  [size]="17" class="shrink-0 text-ink-soft" />
                <span class="min-w-0 flex-1 truncate text-sm font-medium text-ink">{{ item.title }}</span>
                @if (item.time) {
                  <span class="shrink-0 text-xs text-ink-faint">{{ item.time }}</span>
                }
                @if (item.status) {
                  <app-badge [tone]="item.status === 'sent' ? 'neutral' : 'warning'">{{ item.status }}</app-badge>
                }
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
  private toast = inject(ToastService);

  protected readonly loading = signal(true);
  protected readonly viewMonth = signal(new Date());
  protected readonly selected = signal('');

  // Signal-backed collections so stale responses can never overwrite newer ones.
  protected readonly tasks = signal<Task[]>([]);
  protected readonly reminders = signal<Reminder[]>([]);
  protected readonly goals = signal<Goal[]>([]);

  protected readonly modalOpen = signal(false);
  protected readonly editing = signal<Reminder | null>(null);
  protected readonly saving = signal(false);

  protected form: { title: string; datetime: string; type: string; frequency: string } = {
    title: '',
    datetime: '',
    type: 'custom',
    frequency: 'none',
  };

  private pendingRequests = 0;

  protected readonly reminderTypeOptions = computed(() => REMINDER_TYPE_OPTIONS);
  protected readonly recurringOptions = computed(() => RECURRING_OPTIONS);

  ngOnInit(): void {
    // All three loads must finish before clearing the skeleton, and each only
    // touches its own signal — no cross-request clobbering.
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
  }

  private beginLoad(): void {
    this.pendingRequests += 1;
    this.loading.set(true);
  }

  private finishLoad(): void {
    this.pendingRequests = Math.max(0, this.pendingRequests - 1);
    if (this.pendingRequests === 0) this.loading.set(false);
  }

  protected readonly cells = computed<DayCell[]>(() => {
    const month = this.viewMonth();
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
      const iso = formatDateToLocalYYYYMMDD(date);
      const dateTasks = this.tasks().filter((t) => t.dueDate && formatDateToLocalYYYYMMDD(toDate(t.dueDate)) === iso);
      const dateGoals = this.goals().filter((g) => g.deadline && formatDateToLocalYYYYMMDD(toDate(g.deadline)) === iso);
      const dateReminders = this.reminders().filter((r) => formatDateToLocalYYYYMMDD(toDate(r.datetime)) === iso);
      result.push({
        date,
        key: iso,
        inMonth: date.getMonth() === m,
        isToday: iso === todayKey,
        tasks: dateTasks,
        goals: dateGoals,
        reminders: dateReminders,
      });
    }
    return result;
  });

  protected readonly selectedDate = computed(() => {
    const cell = this.cells().find((c) => c.key === this.selected());
    return cell?.date ?? new Date();
  });

  protected readonly selectedItems = computed<DayItem[]>(() => {
    const cell = this.cells().find((c) => c.key === this.selected());
    if (!cell) return [];
    return [
      ...cell.tasks.map((t) => ({
        id: `task-${t._id}`,
        kind: 'task' as const,
        title: t.title,
        time: t.dueDate ? formatTime(t.dueDate) : '',
        status: t.status === 'completed' ? 'done' : undefined,
      })),
      ...cell.goals.map((g) => ({
        id: `goal-${g._id}`,
        kind: 'goal' as const,
        title: g.title,
        time: '',
        status: 'active',
      })),
      ...cell.reminders.map((r) => ({
        id: `reminder-${r._id}`,
        kind: 'reminder' as const,
        title: r.title,
        time: formatTime(r.datetime),
        status: r.sent ? 'sent' : 'upcoming',
        reminder: r,
      })),
    ];
  });

  protected shiftMonth(dir: number): void {
    const d = new Date(this.viewMonth());
    d.setMonth(d.getMonth() + dir);
    this.viewMonth.set(d);
  }

  protected goToday(): void {
    this.viewMonth.set(new Date());
    this.selected.set(getTodayLocalDate());
  }

  protected selectDay(cell: DayCell): void {
    this.selected.set(cell.key);
  }

  protected openCreate = (): void => {
    this.editing.set(null);
    this.form = {
      title: '',
      datetime: this.defaultDateTime(),
      type: 'custom',
      frequency: 'none',
    };
    this.modalOpen.set(true);
  };

  protected openCreateForSelected(): void {
    const date = this.selectedDate();
    const ymd = formatDateToLocalYYYYMMDD(date);
    this.editing.set(null);
    this.form = {
      title: '',
      datetime: `${ymd}T09:00`,
      type: 'custom',
      frequency: 'none',
    };
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
      recurring: {
        isRecurring,
        frequency: isRecurring ? this.form.frequency : 'none',
      },
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

  private defaultDateTime(): string {
    const date = localDateToDate(this.selected()) ?? new Date();
    return formatDateToLocalYYYYMMDD(date) + 'T09:00';
  }

  protected readonly formatDate = formatDate;
  protected readonly formatTime = formatTime;
  protected readonly toDate = toDate;
}
