import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NgIf } from '@angular/common';
import { CardComponent } from '../../layout/components/card.component';
import { PageHeaderComponent } from '../../layout/components/page-header.component';
import { ButtonComponent } from '../../layout/components/button.component';
import { IconComponent } from '../../layout/components/icon.component';
import { BadgeComponent } from '../../layout/components/badge.component';
import { ProgressComponent } from '../../layout/components/progress.component';
import { FieldComponent } from '../../layout/components/field.component';
import { TextareaComponent } from './components/textarea.component';
import { ModalComponent } from '../../layout/components/modal.component';
import { SkeletonComponent } from '../../layout/components/skeleton.component';
import { SegmentedComponent } from '../../layout/components/segmented.component';
import { GoalService } from '../../core/services/lifestyle.service';
import { ToastService } from '../../core/services/toast.service';
import type { Goal } from '../../core/models/lifestyle.model';
import { formatDate, percent } from '../../core/utils/format';

@Component({
  selector: 'app-goals',
  standalone: true,
  imports: [
    FormsModule,
    NgIf,
    CardComponent,
    PageHeaderComponent,
    ButtonComponent,
    IconComponent,
    BadgeComponent,
    ProgressComponent,
    FieldComponent,
    TextareaComponent,
    ModalComponent,
    SkeletonComponent,
    SegmentedComponent,
  ],
  template: `
    <app-page-header
      title="Goals"
      subtitle="Set targets and track your progress."
      actionLabel="New goal"
      actionIcon="plus"
      [action]="openCreate"
    ></app-page-header>

    <div class="mb-5 flex items-center gap-3">
      <app-segmented
        [options]="viewOptions()"
        [model]="view()"
        (change)="setView($event)"
      />
      <span class="ml-auto text-sm text-ink-soft">{{ completedCount() }} completed</span>
    </div>

    @if (loading()) {
      <div class="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
        @for (_ of [1, 2, 3]; track $index) { <app-card [padding]="'none'"><div class="p-4"><app-skeleton size="button" /></div></app-card> }
      </div>
    } @else if (visibleGoals().length === 0) {
      <app-card [padding]="'none'">
        <div class="px-6 py-16 text-center">
          <app-icon name="target" [size]="36" [strokeWidth]="1.5" class="mx-auto text-ink-faint" />
          <p class="mt-3 text-sm font-semibold text-ink">No goals yet</p>
          <p class="mt-1 text-sm text-ink-soft">Define what you want to achieve.</p>
        </div>
      </app-card>
    } @else {
      <div class="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
        @for (goal of visibleGoals(); track goal._id) {
          <app-card>
            <div class="flex h-full flex-col">
              <div class="flex items-start justify-between gap-2">
              <span
                class="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/15 text-ink"
              >
                <app-icon name="target" [size]="22" [strokeWidth]="1.8" />
              </span>
              @if (goal.completed) {
                <app-badge tone="success" icon="circle-check">Done</app-badge>
              }
            </div>
            <h3 class="mt-4 text-base font-semibold text-ink">{{ goal.title }}</h3>
            @if (goal.description) {
              <p class="mt-1 line-clamp-2 break-words text-sm text-ink-soft">{{ goal.description }}</p>
            }

            <div class="mt-4">
              <div class="mb-1.5 flex items-center justify-between text-xs">
                <span class="text-ink-soft">
                  {{ goalProgressText(goal) }}
                </span>
                <span class="font-medium text-ink">{{ goalPercent(goal) }}%</span>
              </div>
              <app-progress [value]="goalPercent(goal)" />
            </div>

            @if (goal.deadline) {
              <p class="mt-3 flex items-center gap-1.5 text-xs text-ink-faint">
                <app-icon name="calendar" [size]="13" /> {{ formatDate(goal.deadline, 'medium') }}
              </p>
            }

              <div class="mt-auto">
                <div class="mt-5 flex items-center gap-2 border-t border-line pt-4">
                  <app-button size="sm" variant="secondary" icon="pencil" (click)="openEdit(goal)">Update</app-button>
              <app-button *ngIf="!goal.completed" size="sm" icon="circle-check" (click)="complete(goal)">
                Complete
              </app-button>
                  <app-button size="icon" variant="ghost" icon="trash-2"
                    [attr.aria-label]="'Delete ' + goal.title"
                    (click)="remove(goal)"></app-button>
                </div>
              </div>
            </div>
          </app-card>
        }
      </div>
    }

    <app-modal
      [open]="modalOpen()"
      [title]="editing() ? 'Edit goal' : 'New goal'"
      (closed)="modalOpen.set(false)"
    >
      <form (ngSubmit)="save()" class="space-y-4">
        <app-field label="Title" placeholder="e.g. Run a marathon" [required]="true"
          [(ngModel)]="form.title" name="title" />
        <app-textarea label="Description" placeholder="Why does this matter?"
          [(ngModel)]="form.description" name="description" />
        <div class="grid grid-cols-2 gap-4">
          <app-field label="Target" type="number" placeholder="Optional"
            [(ngModel)]="form.target" name="target" />
          <app-field label="Unit" placeholder="km / books / times"
            [(ngModel)]="form.unit" name="unit" />
        </div>
        <div class="grid grid-cols-2 gap-4">
          <app-field label="Progress" type="number" placeholder="0"
            [(ngModel)]="form.progress" name="progress" />
          <app-field label="Deadline" type="date" [(ngModel)]="form.deadline" name="deadline" />
        </div>
        <div class="flex justify-end gap-2 pt-2">
          <app-button type="button" variant="secondary" (click)="modalOpen.set(false)">Cancel</app-button>
          <app-button type="submit" [loading]="saving()">Save</app-button>
        </div>
      </form>
    </app-modal>
  `,
})
export class GoalsComponent implements OnInit {
  private service = inject(GoalService);
  private toast = inject(ToastService);

  protected readonly goals = this.service.goals;
  protected readonly loading = this.service.loading;

  protected readonly view = signal<'all' | 'active' | 'completed'>('all');
  protected readonly modalOpen = signal(false);
  protected readonly editing = signal<Goal | null>(null);
  protected readonly saving = signal(false);

  protected form: Partial<Goal> = {};

  protected readonly viewOptions = computed(() => [
    { value: 'all', label: 'All' },
    { value: 'active', label: 'Active' },
    { value: 'completed', label: 'Done' },
  ]);

  protected readonly visibleGoals = computed(() => {
    const v = this.view();
    return this.goals().filter((g) => {
      if (v === 'active') return !g.completed;
      if (v === 'completed') return g.completed;
      return true;
    });
  });

  protected readonly completedCount = computed(() =>
    this.goals().filter((g) => g.completed).length
  );

  ngOnInit(): void {
    this.service.load();
  }

  protected setView(value: string): void {
    this.view.set(value as 'all' | 'active' | 'completed');
  }

  protected openCreate = (): void => {
    this.editing.set(null);
    this.form = { title: '', description: '', target: null, progress: 0 };
    this.modalOpen.set(true);
  };

  protected openEdit(goal: Goal): void {
    this.editing.set(goal);
    this.form = {
      title: goal.title,
      description: goal.description,
      target: goal.target,
      unit: goal.unit,
      progress: goal.progress,
      deadline: goal.deadline ?? '',
      completed: goal.completed,
    };
    this.modalOpen.set(true);
  }

  protected save(): void {
    if (!this.form.title?.trim()) {
      this.toast.error('Goal title is required.');
      return;
    }
    const payload = {
      ...this.form,
      title: this.form.title.trim(),
      target: this.form.target != null ? Number(this.form.target) : null,
      progress: Number(this.form.progress ?? 0),
      deadline: this.form.deadline || null,
    };
    this.saving.set(true);
    const obs = this.editing()
      ? this.service.update(this.editing()!._id, payload)
      : this.service.create(payload);
    obs.subscribe({
      next: () => {
        this.saving.set(false);
        this.toast.success(this.editing() ? 'Goal updated' : 'Goal created');
        this.modalOpen.set(false);
        this.service.load();
      },
      error: (err: Error) => {
        this.saving.set(false);
        this.toast.error(err.message);
      },
    });
  }

  protected complete(goal: Goal): void {
    this.service.update(goal._id, { completed: true, progress: goal.target ?? goal.progress }).subscribe({
      next: () => {
        this.toast.success('Goal completed — congrats! 🎉');
        this.service.load();
      },
      error: (err: Error) => this.toast.error(err.message),
    });
  }

  protected remove(goal: Goal): void {
    if (!confirm(`Delete "${goal.title}"?`)) return;
    this.service.remove(goal._id).subscribe({
      next: () => {
        this.toast.success('Goal deleted');
        this.service.load();
      },
      error: (err: Error) => this.toast.error(err.message),
    });
  }

  protected goalPercent(goal: Goal): number {
    if (goal.target) return percent(goal.progress, goal.target);
    return Math.min(goal.progress, 100);
  }

  protected goalProgressText(goal: Goal): string {
    if (goal.target != null) {
      return `${goal.progress} / ${goal.target} ${goal.unit || ''}`.trim();
    }
    return `${goal.progress} ${goal.unit || ''}`.trim();
  }

  protected readonly formatDate = formatDate;
}
