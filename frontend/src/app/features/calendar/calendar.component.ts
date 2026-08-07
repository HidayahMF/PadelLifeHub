import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { NgClass, NgIf } from '@angular/common';
import { CardComponent } from '../../shared/components/card/card.component';
import { ButtonComponent } from '../../shared/components/button/button.component';
import { IconComponent } from '../../shared/components/icon/icon.component';
import { SkeletonComponent } from '../../shared/components/skeleton/skeleton.component';
import { TaskService } from '../../core/services/task.service';
import { ReminderService } from '../../core/services/lifestyle.service';
import type { Task } from '../../core/models/task.model';
import type { Reminder } from '../../core/models/lifestyle.model';
import { formatDate, formatTime, toDate } from '../../core/utils/format';

interface DayCell {
  date: Date;
  key: string;
  inMonth: boolean;
  isToday: boolean;
  tasks: Task[];
  reminders: Reminder[];
}

@Component({
  selector: 'app-calendar',
  standalone: true,
  imports: [NgClass, CardComponent, ButtonComponent, IconComponent, SkeletonComponent],
  template: `
    <div class="mb-6 flex flex-wrap items-center justify-between gap-4">
      <div>
        <h1 class="text-2xl font-bold tracking-tight text-ink">Calendar</h1>
        <p class="mt-1 text-sm text-ink-soft">See everything at a glance.</p>
      </div>
      <div class="flex items-center gap-2">
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
      <app-card class="overflow-hidden">
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
              (click)="selected.set(cell.key)"
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

      @if (selectedItems().length > 0) {
        <app-card class="mt-4 p-5">
          <h2 class="text-base font-semibold text-ink">
            {{ formatDate(selectedDate(), 'long') }}
          </h2>
          <ul class="mt-3 divide-y divide-line">
            @for (item of selectedItems(); track item) {
              <li class="flex items-center gap-3 py-3">
                <app-icon [name]="item.kind === 'task' ? 'list-todo' : 'bell'"
                  [size]="17" class="text-ink-soft" />
                <span class="min-w-0 flex-1 text-sm font-medium text-ink">{{ item.title }}</span>
                @if (item.time) {
                  <span class="text-xs text-ink-faint">{{ item.time }}</span>
                }
              </li>
            }
          </ul>
        </app-card>
      }
    }
  `,
})
export class CalendarComponent implements OnInit {
  private taskService = inject(TaskService);
  private reminderService = inject(ReminderService);

  protected readonly loading = signal(true);
  protected readonly viewMonth = signal(new Date());
  protected readonly selected = signal<string>('');

  protected tasks: Task[] = [];
  protected reminders: Reminder[] = [];

  ngOnInit(): void {
    this.taskService.getAll().subscribe({
      next: (res) => {
        this.tasks = res.filter((t) => !t.archived);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
    this.reminderService.getAll().subscribe((res) => (this.reminders = res));
  }

  protected readonly cells = computed<DayCell[]>(() => {
    const month = this.viewMonth();
    const year = month.getFullYear();
    const m = month.getMonth();
    const first = new Date(year, m, 1);
    const startOffset = (first.getDay() + 6) % 7;
    const daysInMonth = new Date(year, m + 1, 0).getDate();
    const gridStart = new Date(year, m, 1 - startOffset);
    const todayKey = new Date().toDateString();
    const result: DayCell[] = [];
    for (let i = 0; i < 42; i++) {
      const date = new Date(gridStart);
      date.setDate(gridStart.getDate() + i);
      const key = date.toDateString();
      const iso = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
      const dateTasks = this.tasks.filter((t) => {
        if (!t.dueDate) return false;
        return new Date(t.dueDate).toDateString() === key;
      });
      const dateReminders = this.reminders.filter((r) => {
        return new Date(r.datetime).toDateString() === key;
      });
      result.push({
        date,
        key: iso,
        inMonth: date.getMonth() === m,
        isToday: key === todayKey,
        tasks: dateTasks,
        reminders: dateReminders,
      });
    }
    return result;
  });

  protected readonly selectedDate = computed(() => {
    const cell = this.cells().find((c) => c.key === this.selected());
    return cell?.date ?? new Date();
  });

  protected readonly selectedItems = computed(() => {
    const cell = this.cells().find((c) => c.key === this.selected());
    if (!cell) return [] as { kind: string; title: string; time: string }[];
    const items: { kind: string; title: string; time: string }[] = [
      ...cell.tasks.map((t) => ({
        kind: 'task',
        title: t.title,
        time: t.dueDate ? formatTime(t.dueDate) : '',
      })),
      ...cell.reminders.map((r) => ({
        kind: 'reminder',
        title: r.title,
        time: formatTime(r.datetime),
      })),
    ];
    return items;
  });

  protected shiftMonth(dir: number): void {
    const d = new Date(this.viewMonth());
    d.setMonth(d.getMonth() + dir);
    this.viewMonth.set(d);
  }

  protected goToday(): void {
    this.viewMonth.set(new Date());
    const todayKey = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}-${String(new Date().getDate()).padStart(2, '0')}`;
    this.selected.set(todayKey);
  }

  protected readonly formatDate = formatDate;
  protected readonly formatTime = formatTime;
  protected readonly toDate = toDate;
}
