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
import { ModalComponent } from '../../layout/components/modal.component';
import { SkeletonComponent } from '../../layout/components/skeleton.component';
import { SegmentedComponent } from '../../layout/components/segmented.component';
import { WishlistService } from '../../core/services/lifestyle.service';
import { ToastService } from '../../core/services/toast.service';
import { I18nService } from '../../core/services/i18n.service';
import type { WishlistItem, WishlistStatus } from '../../core/models/lifestyle.model';
import { formatCurrency, formatDate, percent } from '../../core/utils/format';

@Component({
  selector: 'app-wishlist',
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
    ModalComponent,
    SkeletonComponent,
    SegmentedComponent,
  ],
  template: `
    <app-page-header
      [title]="t('Wishlist')"
      [subtitle]="t('Dream it, save for it, buy it.')"
      [actionLabel]="t('Add wish')"
      actionIcon="plus"
      [action]="openCreate"
    ></app-page-header>

    <div class="mb-5 flex flex-wrap items-center gap-3">
      <app-segmented
        [options]="viewOptions()"
        [model]="view()"
        (change)="setView($event)"
      />
      @if (view() === 'active') {
        <app-segmented
          [options]="statusOptions()"
          [model]="statusFilter()"
          (change)="setStatusFilter($event)"
        />
      }
      @if (allTags().length > 0 && view() === 'active') {
        <div class="flex flex-wrap items-center gap-1.5">
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
      <span class="ml-auto text-sm text-ink-soft">
        {{ t('{saved} saved of {total}', { saved: savedTotal(), total: total() }) }}
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
          <p class="mt-3 text-sm font-semibold text-ink">{{ t('Nothing here yet') }}</p>
          <p class="mt-1 text-sm text-ink-soft">{{ t("Add something you're saving up for.") }}</p>
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
              <app-badge [tone]="priorityTone(item.priority)">{{ t(titleCase(item.priority)) }}</app-badge>
            </div>
            <h3 class="mt-4 text-base font-semibold text-ink">{{ item.name }}</h3>
            <p class="mt-0.5 text-sm text-ink-soft">{{ formatCurrency(item.price) }}</p>
            @if (item.tags?.length) {
              <div class="mt-2 flex flex-wrap gap-1">
                @for (tag of item.tags; track tag) {
                  <span class="rounded-md border border-line bg-surface-2 px-1.5 py-0.5 text-[10px] font-bold text-ink-soft">#{{ tag }}</span>
                }
              </div>
            }

            <div class="mt-4">
              <div class="mb-1.5 flex items-center justify-between text-xs">
                <span class="text-ink-soft">{{ t('Saved') }}</span>
                <span class="font-medium text-ink">{{ percent(item.savingProgress, item.price) }}%</span>
              </div>
              <app-progress [value]="percent(item.savingProgress, item.price)" />
              <p class="mt-1.5 text-xs text-ink-faint">
                {{ formatCurrency(item.savingProgress) }} of {{ formatCurrency(item.price) }}
              </p>
            </div>

            @if (item.targetDate) {
              <p class="mt-3 flex items-center gap-1.5 text-xs text-ink-faint">
                <app-icon name="calendar" [size]="13" /> {{ t('Target: {date}', { date: formatDate(item.targetDate, 'medium') }) }}
              </p>
            }

              <div class="mt-auto">
                <div class="mt-5 flex items-center gap-2 border-t border-line pt-4">
                  @if (item.link) {
                    <a [href]="item.link" target="_blank" rel="noopener noreferrer"
                      class="inline-flex items-center gap-1.5 rounded-button border-2 border-ink bg-surface px-3 py-1.5 text-xs font-bold text-ink shadow-[2px_2px_0_0_var(--color-ink)] transition-all hover:-translate-y-0.5 hover:shadow-[3px_3px_0_0_var(--color-ink)]"
                      [attr.aria-label]="t('View link')"
                    >
                      <app-icon name="external-link" [size]="13" />
                      <span class="hidden sm:inline">{{ t('View link') }}</span>
                    </a>
                  }
                  @if (view() === 'active') {
                    @if (item.status !== 'purchased') {
                      <app-button size="sm" icon="check" (click)="markPurchased(item)">{{ t('Purchased') }}</app-button>
                    }
                    <app-button size="sm" variant="secondary" icon="pencil" (click)="openEdit(item)">{{ t('Edit') }}</app-button>
                    <app-button size="icon" variant="ghost" icon="archive"
                      [attr.aria-label]="t('Archive {name}', { name: item.name })"
                      (click)="setFlag(item, { archived: true })"></app-button>
                    <app-button size="icon" variant="ghost" icon="trash-2"
                      [attr.aria-label]="t('Move to trash')"
                      (click)="setFlag(item, { trashed: true, archived: false })"></app-button>
                  } @else if (view() === 'archived') {
                    <app-button size="sm" variant="secondary" icon="rotate-ccw" (click)="setFlag(item, { archived: false })">{{ t('Restore') }}</app-button>
                    <app-button size="icon" variant="ghost" icon="trash-2"
                      [attr.aria-label]="t('Move to trash')"
                      (click)="setFlag(item, { trashed: true, archived: false })"></app-button>
                  } @else {
                    <app-button size="sm" variant="secondary" icon="rotate-ccw" (click)="setFlag(item, { trashed: false })">{{ t('Restore') }}</app-button>
                    <app-button size="icon" variant="danger" icon="trash-2"
                      [attr.aria-label]="t('Delete permanently')"
                      (click)="remove(item)"></app-button>
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
      [title]="editing() ? t('Edit wish') : t('Add a wish')"
      (closed)="modalOpen.set(false)"
    >
      <form (ngSubmit)="save()" class="space-y-4">
        <app-field [label]="t('Name')" [placeholder]="t('e.g. New laptop')" [required]="true"
          [(ngModel)]="form.name" name="name" />
        <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <app-field [label]="t('Price')" type="number" placeholder="0" [required]="true"
            [(ngModel)]="form.price" name="price" />
          <app-field [label]="t('Saved so far')" type="number" placeholder="0"
            [(ngModel)]="form.savingProgress" name="savingProgress" />
        </div>
        <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <app-select [label]="t('Priority')" [options]="priorityOptions()"
            [(ngModel)]="form.priority" name="priority" />
          <app-field [label]="t('Target date')" type="date" [(ngModel)]="form.targetDate" name="targetDate" />
        </div>
        <app-field [label]="t('Link')" type="url" [placeholder]="t('https://…')" [(ngModel)]="form.link" name="link" />
        <app-field
          [label]="t('Tags')"
          [placeholder]="t('travel, gadgets, home… (comma separated)')"
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
export class WishlistComponent implements OnInit {
  private service = inject(WishlistService);
  private toast = inject(ToastService);
  private i18n = inject(I18nService);

  protected readonly t = this.i18n.t.bind(this.i18n);

  protected readonly items = this.service.items;
  protected readonly loading = this.service.loading;

  protected readonly statusFilter = signal<WishlistStatus | 'all'>('all');
  protected readonly tagFilter = signal('');
  protected readonly view = signal<'active' | 'archived' | 'trash'>('active');
  protected readonly modalOpen = signal(false);
  protected readonly editing = signal<WishlistItem | null>(null);
  protected readonly saving = signal(false);

  protected form: Partial<WishlistItem> = {};
  protected tagsText = '';

  protected readonly viewOptions = computed(() => [
    { value: 'active', label: this.t('Active') },
    { value: 'archived', label: this.t('Archived') },
    { value: 'trash', label: this.t('Trash') },
  ]);

  protected readonly allTags = computed(() =>
    [...new Set(this.items().flatMap((i) => i.tags ?? []))].sort()
  );

  protected readonly statusOptions = computed(() => [
    { value: 'all', label: this.t('All') },
    { value: 'saved', label: this.t('Saving') },
    { value: 'purchased', label: this.t('Purchased') },
  ]);

  protected readonly priorityOptions = computed(() => [
    { value: 'low', label: this.t('Low') },
    { value: 'medium', label: this.t('Medium') },
    { value: 'high', label: this.t('High') },
  ]);

  protected readonly filteredItems = computed(() =>
    this.items().filter((i) => {
      const tag = this.tagFilter();
      if (tag && !(i.tags ?? []).includes(tag)) return false;
      return this.statusFilter() === 'all' || i.status === this.statusFilter();
    })
  );

  protected readonly total = computed(() =>
    this.items().reduce((s, i) => s + i.price, 0)
  );

  protected readonly savedTotal = computed(() =>
    this.items().reduce((s, i) => s + i.savingProgress, 0)
  );

  ngOnInit(): void {
    this.reload();
  }

  protected setView(value: string): void {
    this.view.set(value as 'active' | 'archived' | 'trash');
    this.tagFilter.set('');
    this.reload();
  }

  private reload(): void {
    const params: Record<string, string> = {};
    if (this.view() === 'archived') params['archived'] = 'true';
    if (this.view() === 'trash') params['trashed'] = 'true';
    this.service.load(params);
  }

  protected setStatusFilter(value: string): void {
    this.statusFilter.set(value as WishlistStatus | 'all');
  }

  protected openCreate = (): void => {
    this.editing.set(null);
    this.form = { name: '', price: undefined, savingProgress: 0, priority: 'medium', status: 'saved' };
    this.tagsText = '';
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
    this.tagsText = (item.tags ?? []).join(', ');
    this.modalOpen.set(true);
  }

  protected save(): void {
    if (!this.form.name?.trim() || !Number(this.form.price)) {
      this.toast.error(this.t('Name and price are required.'));
      return;
    }
    const payload = {
      ...this.form,
      name: this.form.name.trim(),
      price: Number(this.form.price),
      savingProgress: Number(this.form.savingProgress ?? 0),
      targetDate: this.form.targetDate || null,
      status: this.form.status ?? 'saved',
      tags: this.parseTags(this.tagsText),
    };
    this.saving.set(true);
    const obs = this.editing()
      ? this.service.update(this.editing()!._id, payload)
      : this.service.create(payload);
    obs.subscribe({
      next: () => {
        this.saving.set(false);
        this.toast.success(this.editing() ? this.t('Wish updated') : this.t('Wish added'));
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
        this.toast.success(this.t('Enjoy your new purchase! 🎉'));
        this.service.load();
      },
      error: (err: Error) => this.toast.error(err.message),
    });
  }

  protected setFlag(item: WishlistItem, flags: Partial<WishlistItem>): void {
    this.service.update(item._id, flags).subscribe({
      next: () => {
        this.toast.success(flags.trashed ? this.t('Moved to trash') : flags.archived ? this.t('Item archived') : this.t('Item restored'));
        this.reload();
      },
      error: (err: Error) => this.toast.error(err.message),
    });
  }

  protected remove(item: WishlistItem): void {
    if (!confirm(this.t('Permanently delete "{name}"? This cannot be undone.', { name: item.name }))) return;
    this.service.remove(item._id).subscribe({
      next: () => {
        this.toast.success(this.t('Deleted permanently'));
        this.reload();
      },
      error: (err: Error) => this.toast.error(err.message),
    });
  }

  protected parseTags(text: string): string[] {
    return [...new Set(text.split(',').map((t) => t.trim().toLowerCase()).filter(Boolean))].slice(0, 10);
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
