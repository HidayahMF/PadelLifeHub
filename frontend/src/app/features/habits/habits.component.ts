import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NgClass } from '@angular/common';
import { CardComponent } from '../../layout/components/card.component';
import { PageHeaderComponent } from '../../layout/components/page-header.component';
import { ButtonComponent } from '../../layout/components/button.component';
import { IconComponent } from '../../layout/components/icon.component';
import { BadgeComponent } from '../../layout/components/badge.component';
import { FieldComponent } from '../../layout/components/field.component';
import { SelectComponent } from '../../layout/components/select.component';
import { ModalComponent } from '../../layout/components/modal.component';
import { SkeletonComponent } from '../../layout/components/skeleton.component';
import { HabitService } from '../../core/services/lifestyle.service';
import { ToastService } from '../../core/services/toast.service';
import type { Habit } from '../../core/models/lifestyle.model';
import { addDays, startOfDay } from '../../core/utils/format';

@Component({
  selector: 'app-habits',
  standalone: true,
  imports: [
    NgClass,
    FormsModule,
    CardComponent,
    PageHeaderComponent,
    ButtonComponent,
    IconComponent,
    BadgeComponent,
    FieldComponent,
    SelectComponent,
    ModalComponent,
    SkeletonComponent,
  ],
  template: `
    <app-page-header
      title="Habits"
      subtitle="Small actions, daily. Build streaks that stick."
      actionLabel="New habit"
      actionIcon="plus"
      [action]="openCreate"
    ></app-page-header>

    @if (loading()) {
      <div class="grid grid-cols-1 gap-4 xl:grid-cols-2">
        @for (_ of [1, 2]; track $index) { <app-card [padding]="'none'"><div class="p-4"><app-skeleton size="button" /></div></app-card> }
      </div>
    } @else if (activeHabits().length === 0) {
      <app-card [padding]="'none'">
        <div class="px-6 py-16 text-center">
          <app-icon name="flame" [size]="36" [strokeWidth]="1.5" class="mx-auto text-ink-faint" />
          <p class="mt-3 text-sm font-semibold text-ink">No habits yet</p>
          <p class="mt-1 text-sm text-ink-soft">Start with one small habit today.</p>
        </div>
      </app-card>
    } @else {
      <div class="grid grid-cols-1 gap-4 xl:grid-cols-2">
        @for (habit of activeHabits(); track habit._id) {
          <app-card>
            <div class="flex h-full flex-col">
              <div class="flex flex-wrap items-start justify-between gap-3">
              <div class="flex items-center gap-3">
                <span
                  class="flex h-10 w-10 items-center justify-center rounded-xl"
                  [class.bg-primary/15]="!doneToday(habit)"
                  [class.bg-success/10]="doneToday(habit)"
                  [class.text-ink]="!doneToday(habit)"
                  [class.text-success]="doneToday(habit)"
                >
                  <app-icon name="flame" [size]="20" />
                </span>
                <div>
                  <h3 class="text-base font-semibold text-ink">{{ habit.name }}</h3>
                  <p class="text-xs text-ink-soft">
                    {{ titleCase(habit.frequency) }} · {{ habit.streak }} day streak
                  </p>
                </div>
              </div>
              <app-badge class="shrink-0" [tone]="doneToday(habit) ? 'success' : 'neutral'" [icon]="doneToday(habit) ? 'check' : ''">
                {{ doneToday(habit) ? 'Done today' : 'Not yet' }}
              </app-badge>
            </div>

            <div class="mt-5 flex items-center justify-between gap-2">
              @for (day of weekDays(); track day.label) {
                <button
                  class="flex flex-col items-center gap-1.5"
                  [attr.aria-label]="'Toggle ' + habit.name + ' on ' + day.label"
                  (click)="toggleDate(habit, day)"
                >
                  <span class="text-[10px] font-medium uppercase text-ink-faint">{{ day.label }}</span>
                  <span
                    class="flex h-8 w-8 items-center justify-center rounded-full border-2 transition-colors"
                    [ngClass]="
                      isDateDone(habit, day)
                        ? 'border-primary bg-primary text-ink'
                        : 'border-line-strong text-transparent hover:border-primary'
                    "
                  >
                    <app-icon name="check" [size]="15" [strokeWidth]="3" />
                  </span>
                </button>
              }
            </div>

              <div class="mt-auto">
                <div class="mt-5 flex items-center gap-2 border-t border-line pt-4">
                  <app-button size="sm" icon="check" (click)="toggleToday(habit)">
                {{ doneToday(habit) ? 'Undo today' : 'Mark done' }}
              </app-button>
              <app-button size="sm" variant="secondary" icon="pencil" (click)="openEdit(habit)">Edit</app-button>
              <app-button size="icon" variant="ghost" icon="archive"
                [attr.aria-label]="'Archive ' + habit.name"
                (click)="archive(habit)"></app-button>
                  <app-button size="icon" variant="ghost" icon="trash-2"
                    [attr.aria-label]="'Delete ' + habit.name"
                    (click)="remove(habit)"></app-button>
                </div>
              </div>
            </div>
          </app-card>
        }
      </div>
    }

    <app-modal
      [open]="modalOpen()"
      [title]="editing() ? 'Edit habit' : 'New habit'"
      (closed)="modalOpen.set(false)"
    >
      <form (ngSubmit)="save()" class="space-y-4">
        <app-field label="Name" placeholder="e.g. Morning walk" [required]="true"
          [(ngModel)]="form.name" name="name" />
        <app-field label="Description" placeholder="Optional details…"
          [(ngModel)]="form.description" name="description" />
        <app-select label="Frequency" [options]="frequencyOptions()"
          [(ngModel)]="form.frequency" name="frequency" />
        <div class="flex justify-end gap-2 pt-2">
          <app-button type="button" variant="secondary" (click)="modalOpen.set(false)">Cancel</app-button>
          <app-button type="submit" [loading]="saving()">Save</app-button>
        </div>
      </form>
    </app-modal>
  `,
})
export class HabitsComponent implements OnInit {
  private service = inject(HabitService);
  private toast = inject(ToastService);

  protected readonly habits = this.service.habits;
  protected readonly loading = this.service.loading;

  protected readonly modalOpen = signal(false);
  protected readonly editing = signal<Habit | null>(null);
  protected readonly saving = signal(false);

  protected form: Partial<Habit> = {};

  protected readonly frequencyOptions = computed(() => [
    { value: 'daily', label: 'Daily' },
    { value: 'weekly', label: 'Weekly' },
    { value: 'monthly', label: 'Monthly' },
  ]);

  protected readonly activeHabits = computed(() => this.habits().filter((h) => !h.archived));

  protected readonly weekDays = computed(() => {
    const today = startOfDay();
    const days = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
    const result: { label: string; date: string; today: boolean }[] = [];
    for (let i = 6; i >= 0; i--) {
      const date = addDays(today, -i);
      const iso = date.toISOString().slice(0, 10);
      result.push({
        label: days[date.getDay()],
        date: iso,
        today: iso === new Date().toISOString().slice(0, 10),
      });
    }
    return result;
  });

  ngOnInit(): void {
    this.service.load();
  }

  protected openCreate = (): void => {
    this.editing.set(null);
    this.form = { name: '', description: '', frequency: 'daily' };
    this.modalOpen.set(true);
  };

  protected openEdit(habit: Habit): void {
    this.editing.set(habit);
    this.form = {
      name: habit.name,
      description: habit.description,
      frequency: habit.frequency,
    };
    this.modalOpen.set(true);
  }

  protected save(): void {
    if (!this.form.name?.trim()) {
      this.toast.error('Habit name is required.');
      return;
    }
    const payload = { ...this.form, name: this.form.name.trim() };
    this.saving.set(true);
    const obs = this.editing()
      ? this.service.update(this.editing()!._id, payload)
      : this.service.create(payload);
    obs.subscribe({
      next: () => {
        this.saving.set(false);
        this.toast.success(this.editing() ? 'Habit updated' : 'Habit created');
        this.modalOpen.set(false);
        this.service.load();
      },
      error: (err: Error) => {
        this.saving.set(false);
        this.toast.error(err.message);
      },
    });
  }

  protected doneToday(habit: Habit): boolean {
    return habit.completedDates.includes(new Date().toISOString().slice(0, 10));
  }

  protected isDateDone(habit: Habit, day: { date: string }): boolean {
    return habit.completedDates.includes(day.date);
  }

  protected toggleToday(habit: Habit): void {
    this.toggleDate(habit, { date: new Date().toISOString().slice(0, 10) });
  }

  protected toggleDate(habit: Habit, day: { date: string }): void {
    const dates = habit.completedDates.includes(day.date)
      ? habit.completedDates.filter((d) => d !== day.date)
      : [...habit.completedDates, day.date];
    this.service.update(habit._id, { completedDates: dates }).subscribe({
      next: () => {
        if (habit.completedDates.includes(day.date)) {
          this.toast.info('Day unmarked');
        }
        this.service.load();
      },
      error: (err: Error) => this.toast.error(err.message),
    });
  }

  protected archive(habit: Habit): void {
    this.service.update(habit._id, { archived: true }).subscribe({
      next: () => {
        this.toast.success('Habit archived');
        this.service.load();
      },
      error: (err: Error) => this.toast.error(err.message),
    });
  }

  protected remove(habit: Habit): void {
    if (!confirm(`Delete "${habit.name}"?`)) return;
    this.service.remove(habit._id).subscribe({
      next: () => {
        this.toast.success('Habit deleted');
        this.service.load();
      },
      error: (err: Error) => this.toast.error(err.message),
    });
  }

  protected titleCase(value: string): string {
    return value.charAt(0).toUpperCase() + value.slice(1);
  }
}
