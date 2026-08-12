import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { NgClass, NgIf } from '@angular/common';
import { CardComponent } from '../../layout/components/card.component';
import { PageHeaderComponent } from '../../layout/components/page-header.component';
import { ButtonComponent } from '../../layout/components/button.component';
import { IconComponent } from '../../layout/components/icon.component';
import { BadgeComponent } from '../../layout/components/badge.component';
import { FieldComponent } from '../../layout/components/field.component';
import { SelectComponent } from '../../layout/components/select.component';
import { TextareaComponent } from './components/textarea.component';
import { ModalComponent } from '../../layout/components/modal.component';
import { SkeletonComponent } from '../../layout/components/skeleton.component';
import { EmptyStateComponent } from './components/empty-state.component';
import { SegmentedComponent } from '../../layout/components/segmented.component';
import { TaskService } from '../../core/services/task.service';
import { CategoryService } from '../../core/services/category.service';
import { ToastService } from '../../core/services/toast.service';
import type {
  Category,
  Task,
  TaskPayload,
  TaskRecurrenceFrequency,
} from '../../core/models/task.model';
import { formatDateTime, isOverdue, relativeDay } from '../../core/utils/format';

type Filter = 'all' | 'todo' | 'in-progress' | 'completed';

@Component({
  selector: 'app-tasks',
  standalone: true,
  imports: [
    NgClass,
    NgIf,
    FormsModule,
    CardComponent,
    PageHeaderComponent,
    ButtonComponent,
    IconComponent,
    BadgeComponent,
    FieldComponent,
    SelectComponent,
    TextareaComponent,
    ModalComponent,
    SkeletonComponent,
    EmptyStateComponent,
    SegmentedComponent,
  ],
  template: `
    <app-page-header
      title="Tasks"
      subtitle="Plan, organize, and get things done."
      actionLabel="Add task"
      actionIcon="plus"
      [action]="openCreate"
    ></app-page-header>

    <div class="mb-4 flex flex-wrap items-center gap-3">
      <app-segmented
        [options]="filterOptions()"
        [model]="filter()"
        (change)="setFilter($event)"
      />
      <div class="ml-auto flex flex-wrap items-center gap-2">
        <div class="relative">
          <app-icon
            name="search"
            [size]="16"
            class="pointer-events-none absolute top-1/2 -translate-y-1/2"
            [style.left.px]="10"
            [style.color]="'var(--color-ink-faint)'"
          />
          <input
            type="text"
            [value]="search()"
            (input)="setSearch($any($event.target).value)"
            placeholder="Search tasks…"
            name="search"
            class="h-10 w-56 rounded-field border border-line bg-surface pl-9 pr-3 text-sm text-ink placeholder:text-ink-faint focus:border-primary focus:outline-none"
          />
        </div>
        <app-select
          placeholder="Category"
          [options]="categoryOptions()"
          [ngModel]="categoryFilter()"
          (ngModelChange)="categoryFilter.set($event)"
        ></app-select>
        <app-segmented [options]="lifecycleOptions()" [model]="lifecycle()" (change)="setLifecycle($event)" />
      </div>
    </div>

    @if (allTags().length > 0 && lifecycle() === 'active') {
      <div class="mb-4 flex flex-wrap items-center gap-1.5">
        <button
          (click)="tagFilter.set('')"
          class="rounded-md border-2 border-ink px-2 py-0.5 text-xs font-bold transition-colors"
          [class]="tagFilter() === '' ? 'bg-primary text-ink' : 'bg-surface text-ink-soft hover:text-ink'"
        >
          All
        </button>
        @for (tag of allTags(); track tag) {
          <button
            (click)="tagFilter.set(tagFilter() === tag ? '' : tag)"
            class="rounded-md border-2 border-ink px-2 py-0.5 text-xs font-bold transition-colors"
            [class]="tagFilter() === tag ? 'bg-primary text-ink' : 'bg-surface text-ink-soft hover:text-ink'"
          >
            #{{ tag }}
          </button>
        }
      </div>
    }

    <app-card [padding]="'none'">
      @if (loading()) {
        <div class="space-y-3 p-4">
          @for (_ of [1, 2, 3, 4]; track $index) {
            <app-skeleton size="field" />
          }
        </div>
      } @else if (filteredTasks().length === 0) {
        <app-empty-state
          icon="list-todo"
          title="No tasks found"
          message="Create your first task or adjust your filters."
          actionIcon="plus"
          actionRoute="/tasks"
        />
      } @else {
        <ul class="divide-y divide-line">
          @for (task of filteredTasks(); track task._id) {
            <li
              class="flex items-center gap-4 px-5 py-4 transition-colors hover:bg-surface-2/60"
            >
              <button
                (click)="toggleComplete(task)"
                class="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 transition-colors"
                [ngClass]="
                  task.status === 'completed'
                    ? 'border-success bg-success text-surface'
                    : 'border-ink-faint hover:border-primary'
                "
                [attr.aria-label]="task.status === 'completed' ? 'Mark incomplete' : 'Mark complete'"
              >
                <app-icon *ngIf="task.status === 'completed'" name="check" [size]="13" [strokeWidth]="3" />
              </button>

              <button class="min-w-0 flex-1 text-left" (click)="openEdit(task)">
                <span
                  class="block truncate text-sm font-medium"
                  [ngClass]="
                    task.status === 'completed' ? 'text-ink-faint line-through' : 'text-ink'
                  "
                >
                  {{ task.title }}
                </span>
                <span class="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-ink-faint">
                  @if (task.dueDate) {
                    <span
                      class="flex items-center gap-1"
                      [ngClass]="
                        isOverdue(task.dueDate) && task.status !== 'completed'
                          ? 'font-medium text-danger'
                          : ''
                      "
                    >
                      <app-icon name="calendar" [size]="12" />
                      {{ relativeDay(task.dueDate) }}
                      @if (isOverdue(task.dueDate) && task.status !== 'completed') {
                        · overdue
                      }
                    </span>
                  }
                  @if (task.recurring?.isRecurring) {
                    <span class="flex items-center gap-1">
                      <app-icon name="repeat" [size]="12" />
                      {{ task.recurring?.frequency }}
                      @if (task.recurring?.frequency === 'weekly' && (task.recurring?.daysOfWeek?.length ?? 0) > 0) {
                        · {{ dayNames(task.recurring!.daysOfWeek) }}
                      }
                    </span>
                  }
                  @if ((task.tags?.length ?? 0) > 0) {
                    <span class="flex items-center gap-1">
                      @for (tag of (task.tags ?? []).slice(0, 3); track tag) {
                        <span class="rounded-md border border-line bg-surface-2 px-1 py-0.5 text-[10px] font-bold">#{{ tag }}</span>
                      }
                    </span>
                  }
                  @if (task.reminder) {
                    <span class="flex items-center gap-1">
                      <app-icon name="bell" [size]="12" />
                      {{ formatDateTime(task.reminder) }}
                    </span>
                  }
                  @if (categoryName(task.category)) {
                    <span class="flex items-center gap-1">
                      <span
                        class="inline-block h-2 w-2 rounded-full"
                        [style.background]="categoryColor(task.category)"
                      ></span>
                      {{ categoryName(task.category) }}
                    </span>
                  }
                </span>
              </button>

              <div class="flex shrink-0 items-center gap-1">
                <app-button
                  size="icon"
                  variant="ghost"
                  icon="eye"
                  [attr.aria-label]="'View details of ' + task.title"
                  (click)="openDetail(task)"
                ></app-button>
                <button
                  type="button"
                  (click)="togglePin(task)"
                  [attr.aria-label]="task.pinned ? 'Unpin ' + task.title : 'Pin ' + task.title"
                  class="flex h-10 w-10 items-center justify-center rounded-button transition-colors"
                  [ngClass]="
                    task.pinned ? 'text-primary' : 'text-ink-faint hover:text-ink'
                  "
                >
                  <app-icon name="pin" [size]="18" [strokeWidth]="2.4" />
                </button>
                <app-button
                  size="icon"
                  variant="ghost"
                  icon="pencil"
                  [attr.aria-label]="'Edit ' + task.title"
                  (click)="openEdit(task)"
                ></app-button>
                @if (lifecycle() !== 'trash') {
                  <app-button
                    size="icon"
                    variant="ghost"
                    icon="archive"
                    [attr.aria-label]="'Archive ' + task.title"
                    (click)="setFlag(task, { archived: true })"
                  ></app-button>
                }
                <app-button
                  size="icon"
                  variant="ghost"
                  icon="trash-2"
                  [attr.aria-label]="lifecycle() === 'trash' ? 'Delete permanently' : 'Move to trash'"
                  (click)="lifecycle() === 'trash' ? remove(task) : setFlag(task, { trashed: true, archived: false })"
                ></app-button>
              </div>
            </li>
          }
        </ul>
      }
    </app-card>

    <app-modal
      [open]="modalOpen()"
      [title]="editing() ? 'Edit task' : 'New task'"
      (closed)="closeModal()"
    >
      <form (ngSubmit)="save()" class="space-y-4">
        <app-field
          label="Title"
          placeholder="What needs to be done?"
          [required]="true"
          [(ngModel)]="form.title"
          name="title"
        />
        <app-textarea
          label="Description"
          placeholder="Optional details…"
          [(ngModel)]="form.description"
          name="description"
        />
        <app-select
          label="Category"
          placeholder="No category"
          [options]="categoryOptions()"
          [(ngModel)]="form.category"
          name="category"
        />
        <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <app-field
            label="Due date"
            type="date"
            [(ngModel)]="form.dueDate"
            name="dueDate"
          />
          <app-field
            label="Reminder"
            type="datetime-local"
            [(ngModel)]="form.reminder"
            name="reminder"
          />
        </div>
        <app-select
          label="Repeat"
          [options]="recurringOptions()"
          [hint]="recurringHint()"
          [(ngModel)]="formRecurring"
          name="recurring"
        />
        <app-field
          label="Tags"
          placeholder="work, urgent, school… (comma separated)"
          [(ngModel)]="tagsText"
          name="tags"
        />
        @if (formRecurring === 'weekly') {
          <div>
            <label class="mb-1.5 block text-sm font-bold text-ink">Days of the week</label>
            <div class="flex flex-wrap gap-1.5">
              @for (day of weekDays; track day.value) {
                <button
                  type="button"
                  (click)="toggleDay(day.value)"
                  class="h-9 min-w-9 rounded-button border-2 px-2 text-xs font-bold transition-all"
                  [class]="
                    formDays.includes(day.value)
                      ? 'border-ink bg-primary text-ink shadow-soft'
                      : 'border-ink bg-surface text-ink-soft hover:bg-surface-2'
                  "
                >
                  {{ day.label }}
                </button>
              }
            </div>
            @if (formDays.length > 0) {
              <p class="mt-1.5 text-xs font-medium text-ink-soft">
                Every {{ dayNames(formDays) }}
              </p>
            }
          </div>
        }
        <div class="flex justify-end gap-2 pt-2">
          <app-button type="button" variant="secondary" (click)="closeModal()">Cancel</app-button>
          <app-button type="submit" [loading]="saving()">
            {{ editing() ? 'Save changes' : 'Create task' }}
          </app-button>
        </div>
      </form>
    </app-modal>

    <app-modal
      [open]="detailOpen()"
      title="Task details"
      [width]="672"
      (closed)="closeDetail()"
    >
      @if (viewed(); as task) {
        <div class="space-y-4">
          <div class="flex flex-wrap items-center gap-2">
            <app-badge [tone]="statusTone(task.status)">
              {{ titleCase(task.status) }}
            </app-badge>
            @if (task.pinned) {
              <span
                class="inline-flex items-center gap-1 rounded-md border border-line bg-surface-2 px-2 py-0.5 text-xs font-medium text-ink"
              >
                <app-icon name="pin" [size]="12" />
                Pinned
              </span>
            }
            @if (categoryName(task.category)) {
              <span
                class="inline-flex items-center gap-1 rounded-md border border-line bg-surface-2 px-2 py-0.5 text-xs font-medium text-ink"
              >
                <span
                  class="inline-block h-2 w-2 rounded-full"
                  [style.background]="categoryColor(task.category)"
                ></span>
                {{ categoryName(task.category) }}
              </span>
            }
          </div>

          <div>
            <p class="text-xs font-medium uppercase tracking-wide text-ink-faint">Title</p>
            <p class="mt-1 text-sm font-medium text-ink">{{ task.title }}</p>
          </div>

          <div>
            <p class="text-xs font-medium uppercase tracking-wide text-ink-faint">Description</p>
            <p class="mt-1 break-words whitespace-pre-wrap text-sm text-ink">
              {{ task.description || 'No description.' }}
            </p>
          </div>

          <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <p class="text-xs font-medium uppercase tracking-wide text-ink-faint">Due date</p>
              <p
                class="mt-1 flex items-center gap-1 text-sm text-ink"
                [ngClass]="
                  task.dueDate && isOverdue(task.dueDate) && task.status !== 'completed'
                    ? 'font-medium text-danger'
                    : ''
                "
              >
                <app-icon name="calendar" [size]="14" />
                {{ task.dueDate ? relativeDay(task.dueDate) : 'No due date' }}
                @if (task.dueDate && isOverdue(task.dueDate) && task.status !== 'completed') {
                  · overdue
                }
              </p>
            </div>
            <div>
              <p class="text-xs font-medium uppercase tracking-wide text-ink-faint">Reminder</p>
              <p class="mt-1 flex items-center gap-1 text-sm text-ink">
                <app-icon name="bell" [size]="14" />
                {{ task.reminder ? formatDateTime(task.reminder) : 'No reminder' }}
              </p>
            </div>
          </div>

          @if (task.completedAt || task.createdAt) {
            <div class="border-t border-line pt-3 text-xs text-ink-faint">
              @if (task.createdAt) {
                <p>Created {{ formatDateTime(task.createdAt) }}</p>
              }
              @if (task.completedAt) {
                <p>Completed {{ formatDateTime(task.completedAt) }}</p>
              }
            </div>
          }

          <div class="flex justify-end gap-2 pt-1">
            <app-button type="button" variant="secondary" (click)="closeDetail()">Close</app-button>
            <app-button icon="pencil" (click)="editViewed()">Edit task</app-button>
          </div>
        </div>
      }
    </app-modal>
  `,
})
export class TasksComponent implements OnInit {
  private taskService = inject(TaskService);
  private categoryService = inject(CategoryService);
  private toast = inject(ToastService);
  private route = inject(ActivatedRoute);

  protected readonly filter = signal<Filter>('all');
  protected readonly search = signal('');
  protected readonly categoryFilter = signal('');
  protected readonly tagFilter = signal('');
  protected readonly lifecycle = signal<'active' | 'archived' | 'trash'>('active');
  protected readonly modalOpen = signal(false);
  protected readonly editing = signal<Task | null>(null);
  protected readonly saving = signal(false);
  protected readonly detailOpen = signal(false);
  protected readonly viewed = signal<Task | null>(null);

  protected readonly tasks = this.taskService.tasks;
  protected readonly loading = this.taskService.loading;
  protected readonly categories = this.categoryService.categories;

  protected readonly filterOptions = computed(() => [
    { value: 'all', label: 'All' },
    { value: 'todo', label: 'To do' },
    { value: 'completed', label: 'Done' },
  ]);

  protected readonly categoryOptions = computed<{ value: string; label: string }[]>(() =>
    this.categories()
      .filter((c) => c.type === 'task')
      .map((c) => ({ value: c._id, label: c.name }))
  );

  protected readonly lifecycleOptions = computed(() => [
    { value: 'active', label: 'Active' },
    { value: 'archived', label: 'Archived' },
    { value: 'trash', label: 'Trash' },
  ]);

  protected readonly allTags = computed(() =>
    [...new Set(this.tasks().flatMap((t) => t.tags ?? []))].sort()
  );

  protected readonly recurringOptions = computed(() => [
    { value: 'none', label: 'No repeat' },
    { value: 'daily', label: 'Daily' },
    { value: 'weekly', label: 'Weekly' },
    { value: 'monthly', label: 'Monthly' },
    { value: 'yearly', label: 'Yearly' },
  ]);

  protected readonly recurringHint = computed(() =>
    this.formRecurring === 'none'
      ? ''
      : this.formRecurring === 'weekly' && this.formDays.length === 0
        ? 'Pick days below, or leave empty for every week.'
        : 'Repeats automatically after the due date.'
  );

  protected readonly weekDays = [
    { value: 0, label: 'Su' },
    { value: 1, label: 'Mo' },
    { value: 2, label: 'Tu' },
    { value: 3, label: 'We' },
    { value: 4, label: 'Th' },
    { value: 5, label: 'Fr' },
    { value: 6, label: 'Sa' },
  ];

  protected formRecurring: TaskRecurrenceFrequency = 'none';
  protected formDays: number[] = [];

  protected readonly filteredTasks = computed(() => {
    const q = this.search().toLowerCase().trim();
    const tag = this.tagFilter();
    return this.tasks()
      .filter((t) => {
        if (this.lifecycle() === 'trash') return !!t.trashed;
        if (t.trashed) return false;
        if (this.lifecycle() === 'archived') return !!t.archived;
        if (t.archived) return false;
        if (this.filter() !== 'all' && t.status !== this.filter()) return false;
        const selectedCategory = this.categoryFilter();
        if (selectedCategory) {
          const cid =
            t.category && typeof t.category === 'object'
              ? (t.category as { _id: string })._id
              : t.category;
          if (cid !== selectedCategory) return false;
        }
        if (tag && !(t.tags ?? []).includes(tag)) return false;
        if (q && !t.title.toLowerCase().includes(q)) return false;
        return true;
      })
      .sort((a, b) => Number(b.pinned) - Number(a.pinned));
  });

  protected form: TaskPayload = {};
  protected tagsText = '';

  ngOnInit(): void {
    this.categoryService.load({ type: 'task' });
    this.route.queryParams.subscribe((params) => {
      if (params['search']) this.search.set(params['search']);
    });
    this.reload();
  }

  protected reload(): void {
    const params: Record<string, string> = {};
    if (this.lifecycle() === 'archived') params['archived'] = 'true';
    else if (this.lifecycle() === 'trash') params['trashed'] = 'true';
    else params['archived'] = 'false';
    this.taskService.load(params);
  }

  protected setLifecycle(value: string): void {
    this.lifecycle.set(value as 'active' | 'archived' | 'trash');
    this.tagFilter.set('');
    this.reload();
  }

  protected setFilter(f: string): void {
    this.filter.set(f as Filter);
  }
  protected setSearch(q: string): void {
    this.search.set(q);
  }
  protected openCreate = (): void => {
    this.editing.set(null);
    this.form = { title: '', description: '', status: 'todo' };
    this.formRecurring = 'none';
    this.formDays = [];
    this.tagsText = '';
    this.modalOpen.set(true);
  };

  protected openEdit(task: Task): void {
    this.editing.set(task);
    this.form = {
      title: task.title,
      description: task.description,
      category: typeof task.category === 'string' ? task.category : task.category?._id,
      status: task.status,
      dueDate: task.dueDate ?? '',
      reminder: task.reminder ?? '',
    };
    this.formRecurring = task.recurring?.isRecurring ? task.recurring.frequency : 'none';
    this.formDays = [...(task.recurring?.daysOfWeek ?? [])];
    this.tagsText = (task.tags ?? []).join(', ');
    this.modalOpen.set(true);
  }

  protected closeModal(): void {
    this.modalOpen.set(false);
  }

  protected openDetail(task: Task): void {
    this.viewed.set(task);
    this.detailOpen.set(true);
  }

  protected closeDetail(): void {
    this.detailOpen.set(false);
  }

  protected editViewed(): void {
    const task = this.viewed();
    if (!task) return;
    this.detailOpen.set(false);
    this.openEdit(task);
  }

  protected save(): void {
    const title = this.form.title?.trim();
    if (!title) {
      this.toast.error('Task title is required.');
      return;
    }
    const isRecurring = this.formRecurring !== 'none';
    const payload: TaskPayload = {
      ...this.form,
      title,
      category: this.form.category || null,
      dueDate: this.form.dueDate || null,
      reminder: this.form.reminder || null,
      tags: this.parseTags(this.tagsText),
      recurring: {
        isRecurring,
        frequency: isRecurring ? this.formRecurring : 'none',
        daysOfWeek: isRecurring && this.formRecurring === 'weekly' ? this.formDays : [],
      },
    };
    this.saving.set(true);
    const obs = this.editing()
      ? this.taskService.update(this.editing()!._id, payload)
      : this.taskService.create(payload);
    obs.subscribe({
      next: () => {
        this.saving.set(false);
        this.toast.success(this.editing() ? 'Task updated' : 'Task created');
        this.modalOpen.set(false);
        this.reload();
      },
      error: (err: Error) => {
        this.saving.set(false);
        this.toast.error(err.message);
      },
    });
  }

  protected toggleComplete(task: Task): void {
    const completed = task.status === 'completed';
    this.taskService
      .update(task._id, { status: completed ? 'todo' : 'completed' })
      .subscribe({
        next: () => {
          this.toast.success(completed ? 'Task reopened' : 'Task completed 🎉');
          this.reload();
        },
        error: (err: Error) => this.toast.error(err.message),
      });
  }

  protected toggleDay(day: number): void {
    this.formDays = this.formDays.includes(day)
      ? this.formDays.filter((d) => d !== day)
      : [...this.formDays, day].sort((a, b) => a - b);
  }

  protected parseTags(text: string): string[] {
    return [...new Set(text.split(',').map((t) => t.trim().toLowerCase()).filter(Boolean))].slice(0, 10);
  }

  protected dayNames(days: number[]): string {
    const names = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    return days.map((d) => names[d]?.slice(0, 3)).join(', ');
  }

  protected togglePin(task: Task): void {
    this.taskService
      .update(task._id, { pinned: !task.pinned })
      .subscribe({
        next: () => {
          this.toast.success(task.pinned ? 'Task unpinned' : 'Task pinned');
          this.reload();
        },
        error: (err: Error) => this.toast.error(err.message),
      });
  }

  protected setFlag(task: Task, flags: TaskPayload): void {
    this.taskService.update(task._id, flags).subscribe({
      next: () => {
        this.toast.success(flags.trashed ? 'Moved to trash' : flags.archived ? 'Task archived' : 'Task restored');
        this.reload();
      },
      error: (err: Error) => this.toast.error(err.message),
    });
  }

  protected remove(task: Task): void {
    if (!confirm(`Permanently delete "${task.title}"? This cannot be undone.`)) return;
    this.taskService.remove(task._id).subscribe({
      next: () => {
        this.toast.success('Task deleted permanently');
        this.reload();
      },
      error: (err: Error) => this.toast.error(err.message),
    });
  }

  protected categoryName(value: unknown): string {
    if (value && typeof value === 'object' && 'name' in (value as object)) {
      return (value as { name: string }).name;
    }
    return '';
  }

  protected categoryColor(value: unknown): string {
    if (value && typeof value === 'object' && 'color' in (value as object)) {
      return (value as { color: string }).color;
    }
    return 'var(--color-ink-faint)';
  }

  protected statusTone(s: string): 'neutral' | 'success' | 'info' {
    if (s === 'completed') return 'success';
    if (s === 'in-progress') return 'info';
    return 'neutral';
  }

  protected titleCase(value: string): string {
    return value
      .split('-')
      .map((w) => (w ? w[0].toUpperCase() + w.slice(1) : w))
      .join(' ');
  }

  protected readonly isOverdue = isOverdue;
  protected readonly relativeDay = relativeDay;
  protected readonly formatDateTime = formatDateTime;
}
