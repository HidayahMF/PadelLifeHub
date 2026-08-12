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
import { SelectComponent } from '../../layout/components/select.component';
import { ModalComponent } from '../../layout/components/modal.component';
import { SkeletonComponent } from '../../layout/components/skeleton.component';
import { SegmentedComponent } from '../../layout/components/segmented.component';
import { WishlistService } from '../../core/services/lifestyle.service';
import { ToastService } from '../../core/services/toast.service';
import type { WishlistItem, WishlistStatus } from '../../core/models/lifestyle.model';
import { formatCurrency, formatDate, percent } from '../../core/utils/format';

@Component({
  selector: 'app-wishlist',
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
    SelectComponent,
    ModalComponent,
    SkeletonComponent,
    SegmentedComponent,
  ],
  template: `
    <app-page-header
      title="Wishlist"
      subtitle="Dream it, save for it, buy it."
      actionLabel="Add wish"
      actionIcon="plus"
      [action]="openCreate"
    ></app-page-header>

    <div class="mb-5 flex items-center gap-3">
      <app-segmented
        [options]="statusOptions()"
        [model]="statusFilter()"
        (change)="setStatusFilter($event)"
      />
      <span class="ml-auto text-sm text-ink-soft">
        {{ savedTotal() }} saved of {{ total() }}
      </span>
    </div>

    @if (loading()) {
      <div class="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
        @for (_ of [1, 2, 3]; track $index) {
          <app-card [padding]="'none'"><div class="p-4"><app-skeleton size="button" /></div></app-card>
        }
      </div>
    } @else if (filteredItems().length === 0) {
      <app-card [padding]="'none'">
        <div class="px-6 py-16 text-center">
          <app-icon name="gift" [size]="36" [strokeWidth]="1.5" class="mx-auto text-ink-faint" />
          <p class="mt-3 text-sm font-semibold text-ink">Nothing here yet</p>
          <p class="mt-1 text-sm text-ink-soft">Add something you’re saving up for.</p>
        </div>
      </app-card>
    } @else {
      <div class="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
        @for (item of filteredItems(); track item._id) {
          <app-card>
            <div class="flex h-full flex-col">
              <div class="flex items-start justify-between gap-2">
              <span
                class="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/15 text-ink"
              >
                <app-icon name="gift" [size]="22" [strokeWidth]="1.8" />
              </span>
              <app-badge [tone]="priorityTone(item.priority)">{{ titleCase(item.priority) }}</app-badge>
            </div>
            <h3 class="mt-4 text-base font-semibold text-ink">{{ item.name }}</h3>
            <p class="mt-0.5 text-sm text-ink-soft">{{ formatCurrency(item.price) }}</p>

            <div class="mt-4">
              <div class="mb-1.5 flex items-center justify-between text-xs">
                <span class="text-ink-soft">Saved</span>
                <span class="font-medium text-ink">{{ percent(item.savingProgress, item.price) }}%</span>
              </div>
              <app-progress [value]="percent(item.savingProgress, item.price)" />
              <p class="mt-1.5 text-xs text-ink-faint">
                {{ formatCurrency(item.savingProgress) }} of {{ formatCurrency(item.price) }}
              </p>
            </div>

            @if (item.targetDate) {
              <p class="mt-3 flex items-center gap-1.5 text-xs text-ink-faint">
                <app-icon name="calendar" [size]="13" /> Target: {{ formatDate(item.targetDate, 'medium') }}
              </p>
            }

              <div class="mt-auto">
                <div class="mt-5 flex items-center gap-2 border-t border-line pt-4">
                  <app-button
                    *ngIf="item.status !== 'purchased'"
                size="sm"
                icon="check"
                (click)="markPurchased(item)"
              >
                Purchased
              </app-button>
              <app-button size="sm" variant="secondary" icon="pencil" (click)="openEdit(item)">Edit</app-button>
                  <app-button size="icon" variant="ghost" icon="trash-2"
                    [attr.aria-label]="'Delete ' + item.name"
                    (click)="remove(item)"></app-button>
                </div>
              </div>
            </div>
          </app-card>
        }
      </div>
    }

    <app-modal
      [open]="modalOpen()"
      [title]="editing() ? 'Edit wish' : 'Add a wish'"
      (closed)="modalOpen.set(false)"
    >
      <form (ngSubmit)="save()" class="space-y-4">
        <app-field label="Name" placeholder="e.g. New laptop" [required]="true"
          [(ngModel)]="form.name" name="name" />
        <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <app-field label="Price" type="number" placeholder="0" [required]="true"
            [(ngModel)]="form.price" name="price" />
          <app-field label="Saved so far" type="number" placeholder="0"
            [(ngModel)]="form.savingProgress" name="savingProgress" />
        </div>
        <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <app-select label="Priority" [options]="priorityOptions()"
            [(ngModel)]="form.priority" name="priority" />
          <app-field label="Target date" type="date" [(ngModel)]="form.targetDate" name="targetDate" />
        </div>
        <app-field label="Link" type="url" placeholder="https://…" [(ngModel)]="form.link" name="link" />
        <div class="flex justify-end gap-2 pt-2">
          <app-button type="button" variant="secondary" (click)="modalOpen.set(false)">Cancel</app-button>
          <app-button type="submit" [loading]="saving()">Save</app-button>
        </div>
      </form>
    </app-modal>
  `,
})
export class WishlistComponent implements OnInit {
  private service = inject(WishlistService);
  private toast = inject(ToastService);

  protected readonly items = this.service.items;
  protected readonly loading = this.service.loading;

  protected readonly statusFilter = signal<WishlistStatus | 'all'>('all');
  protected readonly modalOpen = signal(false);
  protected readonly editing = signal<WishlistItem | null>(null);
  protected readonly saving = signal(false);

  protected form: Partial<WishlistItem> = {};

  protected readonly statusOptions = computed(() => [
    { value: 'all', label: 'All' },
    { value: 'saved', label: 'Saving' },
    { value: 'purchased', label: 'Purchased' },
  ]);

  protected readonly priorityOptions = computed(() => [
    { value: 'low', label: 'Low' },
    { value: 'medium', label: 'Medium' },
    { value: 'high', label: 'High' },
  ]);

  protected readonly filteredItems = computed(() =>
    this.items().filter((i) => this.statusFilter() === 'all' || i.status === this.statusFilter())
  );

  protected readonly total = computed(() =>
    this.items().reduce((s, i) => s + i.price, 0)
  );

  protected readonly savedTotal = computed(() =>
    this.items().reduce((s, i) => s + i.savingProgress, 0)
  );

  ngOnInit(): void {
    this.service.load();
  }

  protected setStatusFilter(value: string): void {
    this.statusFilter.set(value as WishlistStatus | 'all');
  }

  protected openCreate = (): void => {
    this.editing.set(null);
    this.form = { name: '', price: undefined, savingProgress: 0, priority: 'medium', status: 'saved' };
    this.modalOpen.set(true);
  };

  protected openEdit(item: WishlistItem): void {
    this.editing.set(item);
    this.form = {
      name: item.name,
      price: item.price,
      savingProgress: item.savingProgress,
      priority: item.priority,
      targetDate: item.targetDate ?? '',
      link: item.link,
      status: item.status,
    };
    this.modalOpen.set(true);
  }

  protected save(): void {
    if (!this.form.name?.trim() || !Number(this.form.price)) {
      this.toast.error('Name and price are required.');
      return;
    }
    const payload = {
      ...this.form,
      name: this.form.name.trim(),
      price: Number(this.form.price),
      savingProgress: Number(this.form.savingProgress ?? 0),
      targetDate: this.form.targetDate || null,
      status: this.form.status ?? 'saved',
    };
    this.saving.set(true);
    const obs = this.editing()
      ? this.service.update(this.editing()!._id, payload)
      : this.service.create(payload);
    obs.subscribe({
      next: () => {
        this.saving.set(false);
        this.toast.success(this.editing() ? 'Wish updated' : 'Wish added');
        this.modalOpen.set(false);
        this.service.load();
      },
      error: (err: Error) => {
        this.saving.set(false);
        this.toast.error(err.message);
      },
    });
  }

  protected markPurchased(item: WishlistItem): void {
    this.service.update(item._id, { status: 'purchased', savingProgress: item.price }).subscribe({
      next: () => {
        this.toast.success('Enjoy your new purchase! 🎉');
        this.service.load();
      },
      error: (err: Error) => this.toast.error(err.message),
    });
  }

  protected remove(item: WishlistItem): void {
    if (!confirm(`Remove "${item.name}" from your wishlist?`)) return;
    this.service.remove(item._id).subscribe({
      next: () => {
        this.toast.success('Removed from wishlist');
        this.service.load();
      },
      error: (err: Error) => this.toast.error(err.message),
    });
  }

  protected priorityTone(p: string): 'neutral' | 'danger' | 'warning' {
    if (p === 'high') return 'danger';
    if (p === 'medium') return 'warning';
    return 'neutral';
  }

  protected titleCase(value: string): string {
    return value.charAt(0).toUpperCase() + value.slice(1);
  }

  protected readonly formatCurrency = formatCurrency;
  protected readonly formatDate = formatDate;
  protected readonly percent = percent;
}
