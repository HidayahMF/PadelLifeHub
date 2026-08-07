import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { NgClass, NgIf } from '@angular/common';
import { CardComponent } from '../../shared/components/card/card.component';
import { PageHeaderComponent } from '../../shared/components/page-header/page-header.component';
import { ButtonComponent } from '../../shared/components/button/button.component';
import { IconComponent } from '../../shared/components/icon/icon.component';
import { BadgeComponent } from '../../shared/components/badge/badge.component';
import { FieldComponent } from '../../shared/components/field/field.component';
import { SelectComponent } from '../../shared/components/select/select.component';
import { TextareaComponent } from '../../shared/components/textarea/textarea.component';
import { ModalComponent } from '../../shared/components/modal/modal.component';
import { SkeletonComponent } from '../../shared/components/skeleton/skeleton.component';
import { EmptyStateComponent } from '../../shared/components/empty-state/empty-state.component';
import { SegmentedComponent } from '../../shared/components/segmented/segmented.component';
import { TaskService } from '../../core/services/task.service';
import { CategoryService } from '../../core/services/category.service';
import { ToastService } from '../../core/services/toast.service';
import type { Category, Task, TaskPayload } from '../../core/models/task.model';
import { isOverdue, relativeDay } from '../../core/utils/format';

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
            class="h-10 w-56 rounded-field border border-line bg-surface pl-9 pr-3 text-sm text-ink placeholder:text-ink-faint focus:border-primary focus:outline-none"
          />
        </div>
        <app-select
          placeholder="Priority"
          [options]="priorityOptions()"
          [(ngModel)]="priorityFilter"
        ></app-select>
        <app-button size="sm" variant="ghost" icon="archive" (click)="toggleArchive()">
          {{ archived() ? 'Active' : 'Archived' }}
        </app-button>
      </div>
    </div>

    <app-card>
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
          actionLabel="Add task"
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

              <app-badge [tone]="priorityTone(task.priority)">
                {{ titleCase(task.priority) }}
              </app-badge>

              <div class="flex items-center gap-1">
                <app-button
                  size="icon"
                  variant="ghost"
                  icon="pencil"
                  [attr.aria-label]="'Edit ' + task.title"
                  (click)="openEdit(task)"
                ></app-button>
                <app-button
                  size="icon"
                  variant="ghost"
                  icon="trash-2"
                  [attr.aria-label]="'Delete ' + task.title"
                  (click)="remove(task)"
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
        <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <app-select
            label="Category"
            placeholder="No category"
            [options]="categoryOptions()"
            [(ngModel)]="form.category"
            name="category"
          />
          <app-select
            label="Priority"
            [options]="priorityOptions()"
            [(ngModel)]="form.priority"
            name="priority"
          />
        </div>
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
        <div class="flex justify-end gap-2 pt-2">
          <app-button type="button" variant="secondary" (click)="closeModal()">Cancel</app-button>
          <app-button type="submit" [loading]="saving()">
            {{ editing() ? 'Save changes' : 'Create task' }}
          </app-button>
        </div>
      </form>
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
  protected priorityFilter = '';
  protected readonly archived = signal(false);
  protected readonly modalOpen = signal(false);
  protected readonly editing = signal<Task | null>(null);
  protected readonly saving = signal(false);

  protected readonly tasks = this.taskService.tasks;
  protected readonly loading = this.taskService.loading;
  protected readonly categories = this.categoryService.categories;

  protected readonly filterOptions = computed(() => [
    { value: 'all', label: 'All' },
    { value: 'todo', label: 'To do' },
    { value: 'in-progress', label: 'In progress' },
    { value: 'completed', label: 'Done' },
  ]);

  protected readonly priorityOptions = computed(() => [
    { value: 'low', label: 'Low' },
    { value: 'medium', label: 'Medium' },
    { value: 'high', label: 'High' },
  ]);

  protected readonly categoryOptions = computed<{ value: string; label: string }[]>(() =>
    this.categories()
      .filter((c) => c.type === 'task')
      .map((c) => ({ value: c._id, label: c.name }))
  );

  protected readonly filteredTasks = computed(() => {
    const q = this.search().toLowerCase().trim();
    return this.tasks().filter((t) => {
      if (t.archived !== this.archived()) return false;
      if (this.filter() !== 'all' && t.status !== this.filter()) return false;
      if (this.priorityFilter && t.priority !== this.priorityFilter) return false;
      if (q && !t.title.toLowerCase().includes(q)) return false;
      return true;
    });
  });

  protected form: TaskPayload = {};

  ngOnInit(): void {
    this.categoryService.load({ type: 'task' });
    this.route.queryParams.subscribe((params) => {
      if (params['search']) this.search.set(params['search']);
    });
    this.reload();
  }

  protected reload(): void {
    this.taskService.load({ includeArchived: this.archived() ? 'true' : undefined });
  }

  protected setFilter(f: string): void {
    this.filter.set(f as Filter);
  }
  protected setSearch(q: string): void {
    this.search.set(q);
  }
  protected toggleArchive(): void {
    this.archived.set(!this.archived());
    this.reload();
  }

  protected openCreate = (): void => {
    this.editing.set(null);
    this.form = { title: '', description: '', priority: 'medium', status: 'todo' };
    this.modalOpen.set(true);
  };

  protected openEdit(task: Task): void {
    this.editing.set(task);
    this.form = {
      title: task.title,
      description: task.description,
      category: typeof task.category === 'string' ? task.category : task.category?._id,
      priority: task.priority,
      status: task.status,
      dueDate: task.dueDate ?? '',
      reminder: task.reminder ?? '',
    };
    this.modalOpen.set(true);
  }

  protected closeModal(): void {
    this.modalOpen.set(false);
  }

  protected save(): void {
    const title = this.form.title?.trim();
    if (!title) {
      this.toast.error('Task title is required.');
      return;
    }
    const payload: TaskPayload = {
      ...this.form,
      title,
      category: this.form.category || null,
      dueDate: this.form.dueDate || null,
      reminder: this.form.reminder || null,
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

  protected remove(task: Task): void {
    if (!confirm(`Delete "${task.title}"? This cannot be undone.`)) return;
    this.taskService.remove(task._id).subscribe({
      next: () => {
        this.toast.success('Task deleted');
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

  protected priorityTone(p: string): 'neutral' | 'danger' | 'warning' {
    if (p === 'high') return 'danger';
    if (p === 'medium') return 'warning';
    return 'neutral';
  }

  protected titleCase(value: string): string {
    return value.charAt(0).toUpperCase() + value.slice(1);
  }

  protected readonly isOverdue = isOverdue;
  protected readonly relativeDay = relativeDay;
}
