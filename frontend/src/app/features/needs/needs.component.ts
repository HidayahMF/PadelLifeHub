import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NgClass, NgIf } from '@angular/common';
import { CardComponent } from '../../layout/components/card.component';
import { PageHeaderComponent } from '../../layout/components/page-header.component';
import { ButtonComponent } from '../../layout/components/button.component';
import { IconComponent } from '../../layout/components/icon.component';
import { FieldComponent } from '../../layout/components/field.component';
import { ModalComponent } from '../../layout/components/modal.component';
import { SkeletonComponent } from '../../layout/components/skeleton.component';
import { SegmentedComponent } from '../../layout/components/segmented.component';
import { ToggleComponent } from './components/toggle.component';
import { NeedService } from '../../core/services/lifestyle.service';
import { ToastService } from '../../core/services/toast.service';
import { I18nService } from '../../core/services/i18n.service';
import type { Need } from '../../core/models/lifestyle.model';
import { formatCurrency, formatDate } from '../../core/utils/format';

@Component({
  selector: 'app-needs',
  standalone: true,
  imports: [
    NgClass,
    NgIf,
    FormsModule,
    CardComponent,
    PageHeaderComponent,
    ButtonComponent,
    IconComponent,
    FieldComponent,
    ModalComponent,
    SkeletonComponent,
    SegmentedComponent,
    ToggleComponent,
  ],
  template: `
    <app-page-header
      [title]="t('Needs')"
      [subtitle]="t('Household essentials and shopping lists.')"
      [actionLabel]="t('Add item')"
      actionIcon="plus"
      [action]="openCreate"
    ></app-page-header>

    <div class="mb-5 flex flex-wrap items-center gap-3">
      <app-segmented
        [options]="viewOptions()"
        [model]="view()"
        (change)="setView($event)"
      />
      <span class="ml-auto text-sm text-ink-soft">
        {{ t('{n} of {count} purchased', { n: checkedCount(), count: needs().length }) }}
      </span>
    </div>

    @if (loading()) {
      <div class="space-y-3">@for (_ of [1, 2, 3]; track $index) { <app-skeleton size="field" /> }</div>
    } @else if (visibleNeeds().length === 0) {
      <app-card [padding]="'none'">
        <div class="px-6 py-16 text-center">
          <app-icon name="shopping-basket" [size]="36" [strokeWidth]="1.5" class="mx-auto text-ink-faint" />
          <p class="mt-3 text-sm font-semibold text-ink">{{ t('No needs yet') }}</p>
          <p class="mt-1 text-sm text-ink-soft">{{ t('Keep track of what you need to buy.') }}</p>
        </div>
      </app-card>
    } @else {
      <app-card [padding]="'none'">
        <ul class="divide-y divide-line">
          @for (need of visibleNeeds(); track need._id) {
            <li class="flex items-center gap-4 px-5 py-4">
              <button
                (click)="togglePurchased(need)"
                class="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 transition-colors"
                [ngClass]="
                  need.purchased
                    ? 'border-success bg-success text-surface'
                    : 'border-ink-faint hover:border-primary'
                "
                [attr.aria-label]="need.purchased ? t('Mark as needed') : t('Mark as purchased')"
              >
                <app-icon *ngIf="need.purchased" name="check" [size]="13" [strokeWidth]="3" />
              </button>

              <div class="min-w-0 flex-1">
                <p
                  class="text-sm font-medium"
                  [ngClass]="need.purchased ? 'text-ink-faint line-through' : 'text-ink'"
                >
                  {{ need.name }}
                </p>
                <p class="mt-0.5 text-xs text-ink-faint">
                  {{ need.quantity }} {{ need.unit || t('pcs') }} · {{ need.category || t('General') }}
                </p>
                @if ((need.purchaseHistory ?? []).length > 0) {
                  <p class="mt-1 text-xs text-ink-soft">
                    🛒 {{ t('Purchased {n}× · last', { n: (need.purchaseHistory ?? []).length }) }}
                    {{ formatDate(lastPurchase(need)?.date, 'short') }}
                  </p>
                }
              </div>

              <span class="shrink-0 text-sm font-semibold text-ink">
                {{ formatCurrency(need.price * need.quantity) }}
              </span>

              <div class="flex shrink-0 items-center gap-0.5">
                <app-button size="icon" variant="ghost" icon="pencil"
                  [attr.aria-label]="t('Edit {name}', { name: need.name })"
                  (click)="openEdit(need)"></app-button>
                <app-button size="icon" variant="ghost" icon="trash-2"
                  [attr.aria-label]="t('Delete {name}', { name: need.name })"
                  (click)="remove(need)"></app-button>
              </div>
            </li>
          }
        </ul>
      </app-card>
    }

    <app-modal
      [open]="modalOpen()"
      [title]="editing() ? t('Edit item') : t('Add a need')"
      (closed)="modalOpen.set(false)"
    >
      <form (ngSubmit)="save()" class="space-y-4">
        <app-field [label]="t('Name')" [placeholder]="t('e.g. Rice')" [required]="true"
          [(ngModel)]="form.name" name="name" />
        <div class="grid grid-cols-2 gap-4">
          <app-field [label]="t('Quantity')" type="number" placeholder="1"
            [(ngModel)]="form.quantity" name="quantity" />
          <app-field [label]="t('Unit')" [placeholder]="t('kg / pcs / liter')"
            [(ngModel)]="form.unit" name="unit" />
        </div>
        <div class="grid grid-cols-2 gap-4">
          <app-field [label]="t('Price')" type="number" placeholder="0"
            [(ngModel)]="form.price" name="price" />
          <app-field [label]="t('Category')" [placeholder]="t('e.g. Kitchen')"
            [(ngModel)]="form.category" name="category" />
        </div>
        <app-toggle [label]="t('Add to shopping list')" [model]="form.onShoppingList ?? true"
          (change)="form.onShoppingList = $event" />
        <div class="flex justify-end gap-2 pt-2">
          <app-button type="button" variant="secondary" (click)="modalOpen.set(false)">{{ t('Cancel') }}</app-button>
          <app-button type="submit" [loading]="saving()">{{ t('Save') }}</app-button>
        </div>
      </form>
    </app-modal>
  `,
})
export class NeedsComponent implements OnInit {
  private service = inject(NeedService);
  private toast = inject(ToastService);
  private i18n = inject(I18nService);

  protected readonly t = this.i18n.t.bind(this.i18n);

  protected readonly needs = this.service.needs;
  protected readonly loading = this.service.loading;

  protected readonly view = signal<'all' | 'shopping' | 'purchased'>('all');
  protected readonly modalOpen = signal(false);
  protected readonly editing = signal<Need | null>(null);
  protected readonly saving = signal(false);

  protected form: Partial<Need> = {};

  protected readonly viewOptions = computed(() => [
    { value: 'all', label: this.t('All') },
    { value: 'shopping', label: this.t('Shopping list') },
    { value: 'purchased', label: this.t('Purchased') },
  ]);

  protected readonly visibleNeeds = computed(() => {
    const v = this.view();
    return this.needs().filter((n) => {
      if (v === 'shopping') return n.onShoppingList;
      if (v === 'purchased') return n.purchased;
      return true;
    });
  });

  protected readonly checkedCount = computed(() =>
    this.needs().filter((n) => n.purchased).length
  );

  ngOnInit(): void {
    this.service.load();
  }

  protected setView(value: string): void {
    this.view.set(value as 'all' | 'shopping' | 'purchased');
  }

  protected openCreate = (): void => {
    this.editing.set(null);
    this.form = { name: '', quantity: 1, unit: 'pcs', price: 0, onShoppingList: true, purchased: false };
    this.modalOpen.set(true);
  };

  protected openEdit(need: Need): void {
    this.editing.set(need);
    this.form = {
      name: need.name,
      quantity: need.quantity,
      unit: need.unit,
      price: need.price,
      category: need.category,
      onShoppingList: need.onShoppingList,
      purchased: need.purchased,
    };
    this.modalOpen.set(true);
  }

  protected save(): void {
    if (!this.form.name?.trim()) {
      this.toast.error(this.t('Name is required.'));
      return;
    }
    const payload = {
      ...this.form,
      name: this.form.name.trim(),
      quantity: Number(this.form.quantity ?? 1),
      price: Number(this.form.price ?? 0),
    };
    this.saving.set(true);
    const obs = this.editing()
      ? this.service.update(this.editing()!._id, payload)
      : this.service.create(payload);
    obs.subscribe({
      next: () => {
        this.saving.set(false);
        this.toast.success(this.editing() ? this.t('Item updated') : this.t('Item added'));
        this.modalOpen.set(false);
        this.service.load();
      },
      error: (err: Error) => {
        this.saving.set(false);
        this.toast.error(err.message);
      },
    });
  }

  protected togglePurchased(need: Need): void {
    this.service.update(need._id, { purchased: !need.purchased }).subscribe({
      next: () => {
        this.toast.success(need.purchased ? this.t('Back on the list') : this.t('Purchased'));
        this.service.load();
      },
      error: (err: Error) => this.toast.error(err.message),
    });
  }

  protected lastPurchase(need: Need): { date: string; quantity: number; price: number } | null {
    const history = need.purchaseHistory ?? [];
    return history.length > 0 ? history[history.length - 1] : null;
  }

  protected remove(need: Need): void {
    if (!confirm(this.t('Delete "{name}"?', { name: need.name }))) return;
    this.service.remove(need._id).subscribe({
      next: () => {
        this.toast.success(this.t('Item deleted'));
        this.service.load();
      },
      error: (err: Error) => this.toast.error(err.message),
    });
  }

  protected readonly formatCurrency = formatCurrency;
  protected readonly formatDate = formatDate;
}
