import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CardComponent } from '../../layout/components/card.component';
import { PageHeaderComponent } from '../../layout/components/page-header.component';
import { ButtonComponent } from '../../layout/components/button.component';
import { IconComponent } from '../../layout/components/icon.component';
import { BadgeComponent } from '../../layout/components/badge.component';
import { ProgressComponent } from '../../layout/components/progress.component';
import { FieldComponent } from '../../layout/components/field.component';
import { SelectComponent } from '../../layout/components/select.component';
import { TextareaComponent } from './components/textarea.component';
import { ModalComponent } from '../../layout/components/modal.component';
import { SkeletonComponent } from '../../layout/components/skeleton.component';
import { SegmentedComponent } from '../../layout/components/segmented.component';
import { GoalService } from '../../core/services/lifestyle.service';
import { ToastService } from '../../core/services/toast.service';
import { I18nService } from '../../core/services/i18n.service';
import type { Goal } from '../../core/models/lifestyle.model';
import { formatCurrency, formatDate, percent } from '../../core/utils/format';

@Component({
  selector: 'app-goals',
  standalone: true,
  imports: [
    FormsModule,
    CardComponent,
    PageHeaderComponent,
    ButtonComponent,
    IconComponent,
    BadgeComponent,
    ProgressComponent,
    FieldComponent,
    SelectComponent,
    TextareaComponent,
    ModalComponent,
    SkeletonComponent,
    SegmentedComponent,
  ],
  template: `
    <app-page-header
      [title]="t('Goals')"
      [subtitle]="t('Set targets and track your progress.')"
      [actionLabel]="t('New goal')"
      actionIcon="plus"
      [action]="openCreate"
    ></app-page-header>

    <div class="mb-5 flex flex-wrap items-center gap-3">
      <app-segmented
        [options]="lifecycleOptions()"
        [model]="lifecycle()"
        (change)="setLifecycle($event)"
      />
      @if (lifecycle() === 'active') {
        <app-segmented
          [options]="viewOptions()"
          [model]="view()"
          (change)="setView($event)"
        />
      }
      <span class="ml-auto text-sm text-ink-soft">{{ t('{n} completed', { n: completedCount() }) }}</span>
    </div>

    @if (loading()) {
      <div class="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
        @for (_ of [1, 2, 3]; track $index) { <app-card [padding]="'none'"><div class="p-4"><app-skeleton size="button" /></div></app-card> }
      </div>
    } @else if (visibleGoals().length === 0) {
      <app-card [padding]="'none'">
        <div class="px-6 py-16 text-center">
          <app-icon name="target" [size]="36" [strokeWidth]="1.5" class="mx-auto text-ink-faint" />
          <p class="mt-3 text-sm font-semibold text-ink">{{ t('No goals yet') }}</p>
          <p class="mt-1 text-sm text-ink-soft">{{ t('Define what you want to achieve.') }}</p>
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
                <app-badge tone="success" icon="circle-check">{{ t('Done') }}</app-badge>
              }
            </div>
            <h3 class="mt-4 text-base font-semibold text-ink">{{ goal.title }}</h3>
            @if (goal.description) {
              <p class="mt-1 line-clamp-2 break-words text-sm text-ink-soft">{{ goal.description }}</p>
            }
            @if (goal.tags?.length) {
              <div class="mt-2 flex flex-wrap gap-1">
                @for (tag of goal.tags; track tag) {
                  <span class="rounded-md border border-line bg-surface-2 px-1.5 py-0.5 text-[10px] font-bold text-ink-soft">#{{ tag }}</span>
                }
              </div>
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

            @if (isSavings(goal) && goal.target) {
              <div class="mt-3 space-y-1 rounded-button border-2 border-ink bg-surface-2 p-2.5 text-xs">
                <div class="flex items-center justify-between gap-2">
                  <span class="text-ink-soft">{{ t('Remaining') }}</span>
                  <span class="font-bold text-ink">{{ formatCurrency(goalRemaining(goal)) }}</span>
                </div>
                <div class="flex items-center justify-between gap-2">
                  <span class="text-ink-soft">{{ t('Needed / month') }}</span>
                  <span class="font-bold text-ink">
                    {{ goal.deadline ? formatCurrency(requiredMonthly(goal)) : '—' }}
                  </span>
                </div>
              </div>
            }

            @if (goal.deadline) {
              <p class="mt-3 flex items-center gap-1.5 text-xs text-ink-faint">
                <app-icon name="calendar" [size]="13" /> {{ t('Target {date}', { date: formatDate(goal.deadline, 'medium') }) }}
              </p>
            }

              <div class="mt-auto">
                <div class="mt-5 flex items-center gap-2 border-t border-line pt-4">
                  @if (lifecycle() === 'active') {
                    <app-button size="sm" variant="secondary" icon="pencil" (click)="openEdit(goal)">{{ t('Update') }}</app-button>
                    @if (!goal.completed) {
                      <app-button size="sm" icon="circle-check" (click)="complete(goal)">{{ t('Complete') }}</app-button>
                    }
                    <app-button size="icon" variant="ghost" icon="archive"
                      [attr.aria-label]="t('Archive {title}', { title: goal.title })"
                      (click)="setFlag(goal, { archived: true })"></app-button>
                    <app-button size="icon" variant="ghost" icon="trash-2"
                      [attr.aria-label]="t('Move to trash')"
                      (click)="setFlag(goal, { trashed: true, archived: false })"></app-button>
                  } @else if (lifecycle() === 'archived') {
                    <app-button size="sm" variant="secondary" icon="rotate-ccw" (click)="setFlag(goal, { archived: false })">{{ t('Restore') }}</app-button>
                    <app-button size="icon" variant="ghost" icon="trash-2"
                      [attr.aria-label]="t('Move to trash')"
                      (click)="setFlag(goal, { trashed: true, archived: false })"></app-button>
                  } @else {
                    <app-button size="sm" variant="secondary" icon="rotate-ccw" (click)="setFlag(goal, { trashed: false })">{{ t('Restore') }}</app-button>
                    <app-button size="icon" variant="danger" icon="trash-2"
                      [attr.aria-label]="t('Delete permanently')"
                      (click)="remove(goal)"></app-button>
                  }
                </div>
              </div>
            </div>
          </app-card>
        }
      </div>
    }

    <app-modal
      [open]="modalOpen()"
      [title]="editing() ? t('Edit goal') : t('New goal')"
      (closed)="modalOpen.set(false)"
    >
      <form (ngSubmit)="save()" class="space-y-4">
        <app-field [label]="t('Title')" [placeholder]="t('e.g. Run a marathon')" [required]="true"
          [(ngModel)]="form.title" name="title" />
        <app-textarea [label]="t('Description')" [placeholder]="t('Why does this matter?')"
          [(ngModel)]="form.description" name="description" />
        <app-select
          [label]="t('Type')"
          [options]="goalKindOptions()"
          [hint]="isSavingsForm() ? t('Financial target — progress counts in Rp.') : t('Anything you want to track.')"
          [(ngModel)]="form.kind"
          name="kind"
        />
        <div class="grid grid-cols-2 gap-4">
          <app-field
            [label]="t('Target')"
            type="number"
            [placeholder]="t('Optional')"
            [hint]="isSavingsForm() ? t('Target amount (Rp)') : ''"
            [(ngModel)]="form.target"
            name="target"
          />
          <app-field
            [label]="t('Unit')"
            [placeholder]="t('km / books / times')"
            [hint]="isSavingsForm() ? t('Fixed to Rupiah') : ''"
            [(ngModel)]="form.unit"
            [disabled]="isSavingsForm()"
            name="unit"
          />
        </div>
        <div class="grid grid-cols-2 gap-4">
          <app-field [label]="t('Progress')" type="number" placeholder="0"
            [(ngModel)]="form.progress" name="progress" />
          <app-field [label]="t('Deadline')" type="date" [(ngModel)]="form.deadline" name="deadline" />
        </div>
        <app-field
          [label]="t('Tags')"
          [placeholder]="t('health, work, finance… (comma separated)')"
          [(ngModel)]="tagsText"
          name="tags"
        />
        <div class="flex justify-end gap-2 pt-2">
          <app-button type="button" variant="secondary" (click)="modalOpen.set(false)">{{ t('Cancel') }}</app-button>
          <app-button type="submit" [loading]="saving()">{{ t('Save') }}</app-button>
        </div>
      </form>
    </app-modal>
  `,
})
export class GoalsComponent implements OnInit {
  private service = inject(GoalService);
  private toast = inject(ToastService);
  private i18n = inject(I18nService);

  protected readonly t = this.i18n.t.bind(this.i18n);

  protected readonly goals = this.service.goals;
  protected readonly loading = this.service.loading;

  protected readonly view = signal<'all' | 'active' | 'completed'>('all');
  protected readonly lifecycle = signal<'active' | 'archived' | 'trash'>('active');
  protected readonly modalOpen = signal(false);
  protected readonly editing = signal<Goal | null>(null);
  protected readonly saving = signal(false);

  protected form: Partial<Goal> = {};
  protected tagsText = '';

  protected readonly lifecycleOptions = computed(() => [
    { value: 'active', label: this.t('Active') },
    { value: 'archived', label: this.t('Archived') },
    { value: 'trash', label: this.t('Trash') },
  ]);

  protected readonly viewOptions = computed(() => [
    { value: 'all', label: this.t('All') },
    { value: 'active', label: this.t('Active') },
    { value: 'completed', label: this.t('Done') },
  ]);

  protected readonly goalKindOptions = computed(() => [
    { value: 'general', label: this.t('General goal') },
    { value: 'savings', label: this.t('Savings goal') },
  ]);

  protected readonly visibleGoals = computed(() => {
    const v = this.view();
    return this.goals().filter((g) => {
      if (v === 'active') return !g.completed;
      if (v === 'completed') return g.completed;
      return true;
    });
  });

  protected setLifecycle(value: string): void {
    this.lifecycle.set(value as 'active' | 'archived' | 'trash');
    this.reload();
  }

  private reload(): void {
    const params: Record<string, string> = {};
    if (this.lifecycle() === 'archived') params['archived'] = 'true';
    if (this.lifecycle() === 'trash') params['trashed'] = 'true';
    this.service.load(params);
  }

  protected readonly completedCount = computed(() =>
    this.goals().filter((g) => g.completed).length
  );

  ngOnInit(): void {
    this.reload();
  }

  protected setView(value: string): void {
    this.view.set(value as 'all' | 'active' | 'completed');
  }

  protected openCreate = (): void => {
    this.editing.set(null);
    this.form = { title: '', description: '', kind: 'general', target: null, progress: 0 };
    this.tagsText = '';
    this.modalOpen.set(true);
  };

  protected openEdit(goal: Goal): void {
    this.editing.set(goal);
    this.form = {
      title: goal.title,
      description: goal.description,
      kind: goal.kind ?? 'general',
      target: goal.target,
      unit: goal.unit,
      progress: goal.progress,
      deadline: goal.deadline ?? '',
      completed: goal.completed,
    };
    this.tagsText = (goal.tags ?? []).join(', ');
    this.modalOpen.set(true);
  }

  protected save(): void {
    if (!this.form.title?.trim()) {
      this.toast.error(this.t('Goal title is required.'));
      return;
    }
    const payload = {
      ...this.form,
      title: this.form.title.trim(),
      kind: this.form.kind ?? 'general',
      target: this.form.target != null ? Number(this.form.target) : null,
      unit: this.isSavingsForm() ? 'Rp' : this.form.unit || '',
      progress: Number(this.form.progress ?? 0),
      deadline: this.form.deadline || null,
      tags: this.parseTags(this.tagsText),
    };
    this.saving.set(true);
    const obs = this.editing()
      ? this.service.update(this.editing()!._id, payload)
      : this.service.create(payload);
    obs.subscribe({
      next: () => {
        this.saving.set(false);
        this.toast.success(this.editing() ? this.t('Goal updated') : this.t('Goal created'));
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
        this.toast.success(this.t('Goal completed — congrats! 🎉'));
        this.service.load();
      },
      error: (err: Error) => this.toast.error(err.message),
    });
  }

  protected setFlag(goal: Goal, flags: Partial<Goal>): void {
    this.service.update(goal._id, flags).subscribe({
      next: () => {
        this.toast.success(flags.trashed ? this.t('Moved to trash') : flags.archived ? this.t('Goal archived') : this.t('Goal restored'));
        this.reload();
      },
      error: (err: Error) => this.toast.error(err.message),
    });
  }

  protected remove(goal: Goal): void {
    if (!confirm(this.t('Permanently delete "{title}"? This cannot be undone.', { title: goal.title }))) return;
    this.service.remove(goal._id).subscribe({
      next: () => {
        this.toast.success(this.t('Goal deleted permanently'));
        this.reload();
      },
      error: (err: Error) => this.toast.error(err.message),
    });
  }

  protected parseTags(text: string): string[] {
    return [...new Set(text.split(',').map((t) => t.trim().toLowerCase()).filter(Boolean))].slice(0, 10);
  }

  protected goalPercent(goal: Goal): number {
    if (goal.target) return percent(goal.progress, goal.target);
    return Math.min(goal.progress, 100);
  }

  protected goalProgressText(goal: Goal): string {
    if (goal.target != null) {
      if (this.isSavings(goal)) {
        return `${formatCurrency(goal.progress)} / ${formatCurrency(goal.target)}`;
      }
      return `${goal.progress} / ${goal.target} ${goal.unit || ''}`.trim();
    }
    return `${goal.progress} ${goal.unit || ''}`.trim();
  }

  protected isSavings(goal: Goal): boolean {
    return goal.kind === 'savings';
  }

  protected isSavingsForm(): boolean {
    return this.form.kind === 'savings';
  }

  protected goalRemaining(goal: Goal): number {
    return Math.max(0, (goal.target ?? 0) - (goal.progress ?? 0));
  }

  /** Required monthly saving to hit the target by the deadline (1 month floor). */
  protected requiredMonthly(goal: Goal): number {
    const remaining = this.goalRemaining(goal);
    if (remaining <= 0 || !goal.deadline) return 0;
    const months = Math.max(
      1,
      (new Date(goal.deadline).getTime() - Date.now()) / (30.44 * 86_400_000)
    );
    return Math.ceil(remaining / months);
  }

  protected readonly formatDate = formatDate;
  protected readonly formatCurrency = formatCurrency;
}
