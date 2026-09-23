import { ChangeDetectionStrategy, Component, computed, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NgClass } from '@angular/common';
import { CardComponent } from '../../layout/components/card.component';
import { PageHeaderComponent } from '../../layout/components/page-header.component';
import { StatCardComponent } from './components/stat-card.component';
import { ValueChartComponent, ValuePoint } from './components/value-chart.component';
import { ButtonComponent } from '../../layout/components/button.component';
import { IconComponent } from '../../layout/components/icon.component';
import { BadgeComponent } from '../../layout/components/badge.component';
import { FieldComponent } from '../../layout/components/field.component';
import { SelectComponent } from '../../layout/components/select.component';
import { ModalComponent } from '../../layout/components/modal.component';
import { SkeletonComponent } from '../../layout/components/skeleton.component';
import { InvestmentService } from '../../core/services/investment.service';
import { ToastService } from '../../core/services/toast.service';
import { I18nService } from '../../core/services/i18n.service';
import type {
  Investment,
  InvestmentDetail,
  InvestmentOverview,
  InvestmentTransaction,
  InvestmentTransactionType,
} from '../../core/models/finance.model';
import { formatCurrency } from '../../core/utils/format';
import { getTodayLocalDate } from '../../core/utils/date';

const TYPE_META: Record<InvestmentTransactionType, { label: string; tone: 'success' | 'danger' | 'primary' | 'warning' }> = {
  deposit: { label: 'Deposit', tone: 'success' },
  withdrawal: { label: 'Withdrawal', tone: 'warning' },
  gain: { label: 'Gain', tone: 'success' },
  loss: { label: 'Loss', tone: 'danger' },
};

function signed(n: number): string {
  const s = formatCurrency(Math.abs(n || 0));
  return (n || 0) < 0 ? `−${s}` : `+${s}`;
}

const idDateFormatter = new Intl.DateTimeFormat('id-ID', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
});
const enDateFormatter = new Intl.DateTimeFormat('en-GB', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
});

@Component({
  selector: 'app-investments',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    FormsModule,
    NgClass,
    CardComponent,
    PageHeaderComponent,
    StatCardComponent,
    ValueChartComponent,
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
      [title]="t('Investments')"
      [subtitle]="t('Track your investment portfolios and daily value changes.')"
      [actionLabel]="t('Add portfolio')"
      actionIcon="plus"
      [action]="openCreatePortfolio"
    ></app-page-header>

    @if (loadingOverview()) {
      <div class="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-6">
        @for (_ of [1, 2, 3, 4, 5, 6]; track $index) {
          <app-skeleton size="box" class="h-28" />
        }
      </div>
    } @else {
      <!-- Overview -->
      <div class="mb-6 grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-6">
        <app-stat-card [label]="t('Current value')" [value]="currentValueText()" icon="trending-up" tone="primary" />
        <app-stat-card [label]="t('Total invested')" [value]="totalInvestedText()" icon="coins" />
        <app-stat-card [label]="t('Profit / Loss')" [value]="profitLossText()" [tone]="profitTone()" icon="piggy-bank" />
        <app-stat-card [label]="t('Return')" [value]="returnPctText()" [tone]="returnTone()" icon="percent" />
        <app-stat-card [label]="t('Today\\'s change')" [value]="todayChangeText()" [tone]="todayChangeTone()" icon="sun" />
        <app-stat-card [label]="t('Monthly change')" [value]="monthChangeText()" [tone]="monthChangeTone()" icon="calendar" />
      </div>

      @if ((portfolios()?.length ?? 0) === 0) {
        <app-card>
          <div class="flex flex-col items-center gap-3 py-12 text-center">
            <app-icon name="trending-up" [size]="40" class="text-ink-soft" />
            <p class="text-sm text-ink-soft">{{ t('No investment portfolios yet.') }}</p>
            <app-button size="sm" (click)="openCreatePortfolio()">{{ t('Create your first portfolio') }}</app-button>
          </div>
        </app-card>
      } @else {
        <!-- Portfolio selector tabs with smooth touch horizontal scroll on mobile -->
        <div class="mb-4 flex flex-nowrap gap-2 overflow-x-auto pb-1 sm:flex-wrap">
          @for (p of portfolios(); track p._id) {
            <button
              (click)="selectPortfolio(p._id)"
              type="button"
              class="shrink-0 rounded-button border-2 px-3.5 py-2 text-sm font-bold transition-all active:translate-x-[1px] active:translate-y-[1px]"
              [ngClass]="selectedId() === p._id
                ? 'border-ink bg-primary text-ink shadow-[3px_3px_0_0_var(--color-ink)]'
                : 'border-line bg-surface text-ink-soft hover:text-ink'"
            >{{ p.name }}</button>
          }
        </div>

        @if (detail(); as d) {
          <div class="space-y-6">
            <!-- Detail card -->
            <app-card [padding]="'none'">
              <div class="flex flex-wrap items-start justify-between gap-3 px-5 pt-5">
                <div class="min-w-0">
                  <h2 class="font-display text-lg text-ink">{{ d.name }}</h2>
                  @if (d.description) {
                    <p class="text-xs text-ink-soft">{{ d.description }}</p>
                  }
                </div>
                 <div class="flex gap-2">
                   <app-button size="sm" icon="refresh-cw" (click)="openSyncValue(d)">{{ t('Update value') }}</app-button>
                   <app-button size="sm" variant="secondary" icon="pencil" (click)="openEditPortfolio(d)">{{ t('Edit') }}</app-button>
                  <app-button size="sm" variant="danger" icon="trash-2" (click)="deletePortfolio(d)">{{ t('Delete') }}</app-button>
                </div>
              </div>
              <div class="mt-4 grid grid-cols-2 gap-3 px-5 py-4 sm:grid-cols-4">
                <div>
                  <p class="text-[11px] font-medium uppercase tracking-wide text-ink-soft">{{ t('Current value') }}</p>
                  <p class="mt-0.5 text-base font-bold text-ink">{{ money(d.currentValue ?? 0) }}</p>
                </div>
                <div>
                  <p class="text-[11px] font-medium uppercase tracking-wide text-ink-soft">{{ t('Net invested') }}</p>
                  <p class="mt-0.5 text-base font-bold text-ink">{{ money(d.netCapitalInvested ?? 0) }}</p>
                </div>
                <div>
                  <p class="text-[11px] font-medium uppercase tracking-wide text-ink-soft">{{ t('Profit / Loss') }}</p>
                  <p class="mt-0.5 text-base font-bold" [ngClass]="(d.profitLoss ?? 0) >= 0 ? 'text-success' : 'text-danger'">{{ signed(d.profitLoss ?? 0) }} ({{ d.returnPct }}%)</p>
                </div>
                <div>
                  <p class="text-[11px] font-medium uppercase tracking-wide text-ink-soft">{{ t("Today's change") }}</p>
                  <p class="mt-0.5 text-base font-bold" [ngClass]="d.todayChange >= 0 ? 'text-success' : 'text-danger'">{{ signed(d.todayChange) }}</p>
                </div>
              </div>
            </app-card>

            <!-- Value chart -->
            <app-card [padding]="'none'">
              <div class="flex flex-wrap items-center justify-between gap-2 px-5 pt-5">
                <div>
                  <h2 class="text-base font-semibold text-ink">{{ t('Value over time') }}</h2>
                  <p class="text-xs text-ink-soft">{{ t('Portfolio value after each change') }}</p>
                </div>
                <app-button size="sm" icon="plus" (click)="openCreateTxn(d)">{{ t('Add change') }}</app-button>
              </div>
              <div class="p-4">
                <app-value-chart
                  [data]="chartPoints()"
                  [attr.aria-label]="t('Investment value over time')"
                />
              </div>
            </app-card>

            <!-- History -->
            <app-card [padding]="'none'">
              <div class="px-5 pt-5">
                <h2 class="text-base font-semibold text-ink">{{ t('History') }}</h2>
              </div>
              @if (d.transactions.length === 0) {
                <p class="px-5 py-8 text-center text-sm text-ink-soft">{{ t('No transactions yet.') }}</p>
              } @else {
                <ul class="divide-y divide-line">
                  @for (tx of d.transactions; track tx._id) {
                    <li class="flex items-center gap-3 px-5 py-3">
                      <div class="min-w-0 flex-1">
                        <div class="flex items-center gap-2">
                          <span class="font-semibold text-ink">{{ txnLabel(tx.type) }}</span>
                          <app-badge [tone]="txnTone(tx.type)">{{ txnLabel(tx.type) }}</app-badge>
                        </div>
                        <p class="truncate text-xs text-ink-soft">{{ tx.note || t('No note') }} · {{ txnDate(tx.transaction_date) }}</p>
                      </div>
                      <span
                        class="text-sm font-bold tabular-nums"
                        [ngClass]="amountClass(tx.type)"
                      >{{ amountFor(tx) }}</span>
                      <div class="flex gap-1">
                        <app-button size="icon" variant="ghost" icon="pencil" aria-label="Edit" (click)="openEditTxn(d, tx)"></app-button>
                        <app-button size="icon" variant="ghost" icon="trash-2" aria-label="Delete" (click)="deleteTxn(tx)"></app-button>
                      </div>
                    </li>
                  }
                </ul>
              }
            </app-card>
          </div>
        }
      }
    }

    <!-- Portfolio modal -->
    <app-modal [open]="portfolioModalOpen()" [title]="portfolioModalTitle()" (closed)="closePortfolioModal()">
      <div class="space-y-4">
        <app-field label="Name" [(ngModel)]="portfolioForm.name" [required]="true" placeholder="e.g. Stocks / Crypto" />
        <app-field label="Description" [(ngModel)]="portfolioForm.description" placeholder="Optional note" />
        <div class="flex justify-end gap-2 pt-2">
          <app-button variant="secondary" (click)="closePortfolioModal()">{{ t('Cancel') }}</app-button>
          <app-button [loading]="savingPortfolio()" (click)="savePortfolio()">{{ t('Save') }}</app-button>
        </div>
      </div>
    </app-modal>

    <!-- Transaction modal -->
    <app-modal [open]="txnModalOpen()" [title]="txnModalTitle()" (closed)="closeTxnModal()">
      <div class="space-y-4">
        <app-select
          label="Transaction type"
          [options]="txnTypeOptions()"
          [(ngModel)]="txnForm.type"
          [required]="true"
        />
        <app-field
          label="Amount (Rp)"
          type="number"
          [(ngModel)]="txnForm.amount"
          [required]="true"
          placeholder="0"
        />
        <app-field
          label="Date"
          type="date"
          [(ngModel)]="txnForm.transaction_date"
          [required]="true"
        />
        <app-field label="Note" [(ngModel)]="txnForm.note" placeholder="Optional note" />
        <div class="flex justify-end gap-2 pt-2">
          <app-button variant="secondary" (click)="closeTxnModal()">{{ t('Cancel') }}</app-button>
          <app-button [loading]="savingTxn()" (click)="saveTxn()">{{ t('Save') }}</app-button>
        </div>
      </div>
    </app-modal>

    <!-- Broker value sync modal -->
    <app-modal [open]="syncModalOpen()" [title]="t('Update value')" (closed)="closeSyncValue()">
      <div class="space-y-4">
        <div class="rounded-field border-2 border-line bg-surface-2 p-3">
          <p class="text-xs font-bold uppercase tracking-wide text-ink-soft">{{ t('Portfolio') }}</p>
          <p class="mt-1 font-display text-lg text-ink">{{ syncForm.name }}</p>
        </div>
        <div class="grid gap-3 sm:grid-cols-2">
          <div class="rounded-field border-2 border-line bg-surface-2 p-3">
            <p class="text-xs font-bold uppercase tracking-wide text-ink-soft">{{ t('Previous value') }}</p>
            <p class="mt-1 text-lg font-bold text-ink">{{ money(syncForm.previousValue) }}</p>
          </div>
          <div class="rounded-field border-2 border-line bg-surface-2 p-3">
            <p class="text-xs font-bold uppercase tracking-wide text-ink-soft">{{ t('Change') }}</p>
            <p class="mt-1 text-lg font-bold" [ngClass]="syncDifference() >= 0 ? 'text-success' : 'text-danger'">{{ signed(syncDifference()) }}</p>
          </div>
        </div>
        <app-field
          label="Latest value (Rp)"
          [(ngModel)]="syncForm.latestValue"
          [required]="true"
          inputmode="numeric"
          placeholder="e.g. 59.500.000"
          hint="Paste a Rupiah amount. Thousand separators are accepted."
        />
        <app-field label="Date" type="date" [(ngModel)]="syncForm.date" [required]="true" />
        <app-field label="Note" [(ngModel)]="syncForm.note" placeholder="Optional note" />
        <div class="flex justify-end gap-2 pt-2">
          <app-button variant="secondary" (click)="closeSyncValue()">{{ t('Cancel') }}</app-button>
          <app-button [loading]="savingSync()" (click)="saveSyncValue()">{{ t('Save') }}</app-button>
        </div>
      </div>
    </app-modal>
  `,
})
export class InvestmentsComponent implements OnInit {
  private investments = inject(InvestmentService);
  private toast = inject(ToastService);
  private i18n = inject(I18nService);

  protected readonly loadingOverview = signal(true);
  protected readonly overview = signal<InvestmentOverview | null>(null);
  protected readonly portfolios = signal<Investment[] | null>(null);
  protected readonly detail = signal<InvestmentDetail | null>(null);
  protected readonly selectedId = signal<string | null>(null);

  protected readonly portfolioModalOpen = signal(false);
  protected readonly savingPortfolio = signal(false);
  protected portfolioForm = { name: '', description: '' };
  protected readonly portfolioModalTitle = signal('');

  protected readonly txnModalOpen = signal(false);
  protected readonly savingTxn = signal(false);
  protected txnForm = {
    _id: null as string | null,
    investment: '',
    type: 'gain' as InvestmentTransactionType,
    amount: 0,
    transaction_date: '',
    note: '',
  };
  protected readonly txnModalTitle = signal('');

  protected readonly syncModalOpen = signal(false);
  protected readonly savingSync = signal(false);
  protected syncForm = { id: '', name: '', previousValue: 0, latestValue: '', date: '', note: '' };

  protected readonly t = (k: string) => this.i18n.t(k);
  protected readonly money = (n: number) => formatCurrency(n || 0);
  protected readonly signed = (n: number) => signed(n);
  protected readonly TYPE_META = TYPE_META;

  protected readonly currentValueText = computed(() => this.money(this.overview()?.currentValue ?? 0));
  protected readonly totalInvestedText = computed(() => this.money(this.overview()?.totalInvested ?? 0));
  protected readonly profitLossText = computed(() => signed(this.overview()?.profitLoss ?? 0));
  protected readonly returnPctText = computed(() => (this.overview()?.returnPct ?? 0) + '%');
  protected readonly todayChangeText = computed(() => signed(this.overview()?.todayChange ?? 0));
  protected readonly monthChangeText = computed(() => signed(this.overview()?.monthChange ?? 0));

  protected readonly profitTone = computed<'success' | 'danger'>(() =>
    (this.overview()?.profitLoss ?? 0) >= 0 ? 'success' : 'danger'
  );
  protected readonly returnTone = computed<'success' | 'danger'>(() =>
    (this.overview()?.returnPct ?? 0) >= 0 ? 'success' : 'danger'
  );
  protected readonly todayChangeTone = computed<'success' | 'danger'>(() =>
    (this.overview()?.todayChange ?? 0) >= 0 ? 'success' : 'danger'
  );
  protected readonly monthChangeTone = computed<'success' | 'danger'>(() =>
    (this.overview()?.monthChange ?? 0) >= 0 ? 'success' : 'danger'
  );

  protected readonly txnTypeOptions = computed(() =>
    (['deposit', 'withdrawal', 'gain', 'loss'] as InvestmentTransactionType[]).map((v) => ({
      value: v,
      label: this.t(TYPE_META[v].label),
    }))
  );

  protected readonly chartPoints = computed<ValuePoint[]>(() => {
    const d = this.detail();
    if (!d || !d.history || !d.history.length) return [];
    return d.history.map((h) => ({
      label: h.date.slice(5),
      value: h.value,
      date: h.date,
    }));
  });

  protected syncDifference(): number {
    const normalized = this.parseRupiah(this.syncForm.latestValue);
    return normalized === null ? 0 : normalized - this.syncForm.previousValue;
  }

  ngOnInit(): void {
    this.loadAll();
  }

  private loadAll(): void {
    this.loadingOverview.set(true);
    this.investments.overview().subscribe({
      next: (ov) => {
        this.overview.set(ov);
        this.loadingOverview.set(false);
        if (ov.portfolios?.length) {
          this.portfolios.set(ov.portfolios);
          const activeId = this.selectedId() || ov.portfolios[0]._id;
          this.selectedId.set(activeId);
          this.loadDetail(activeId, false);
        } else {
          this.portfolios.set([]);
        }
      },
      error: () => {
        this.loadingOverview.set(false);
        this.toast.error('Failed to load investments');
      },
    });
  }

  private reloadOverview(): void {
    this.investments.overview().subscribe({
      next: (ov) => {
        this.overview.set(ov);
        this.portfolios.set(ov.portfolios ?? []);
        if (this.selectedId() && !(ov.portfolios ?? []).some((p) => p._id === this.selectedId())) {
          this.selectedId.set(null);
          this.detail.set(null);
        }
      },
      error: () => undefined,
    });
  }

  protected selectPortfolio = (id: string): void => {
    if (this.selectedId() === id) return;
    this.selectedId.set(id);
    this.loadDetail(id, true);
  };

  private loadDetail(id: string, preserve = true): void {
    if (!preserve) {
      this.detail.set(null);
    }
    this.investments.getDetail(id).subscribe({
      next: (d) => this.detail.set(d),
      error: () => this.toast.error('Failed to load portfolio'),
    });
  }

  protected openCreatePortfolio = (): void => {
    this.portfolioForm = { name: '', description: '' };
    this.portfolioModalTitle.set(this.t('New portfolio'));
    this.portfolioModalOpen.set(true);
  };

  protected openEditPortfolio = (p: Investment): void => {
    this.portfolioForm = { name: p.name, description: p.description ?? '' };
    this.portfolioModalTitle.set(this.t('Edit portfolio'));
    this.portfolioModalOpen.set(true);
  };

  protected closePortfolioModal = (): void => {
    this.portfolioModalOpen.set(false);
  };

  protected savePortfolio(): void {
    const form = this.portfolioForm;
    if (!form.name.trim()) {
      this.toast.error('Portfolio name is required');
      return;
    }
    const editing = this.portfolioModalTitle().includes(this.t('Edit'));
    this.savingPortfolio.set(true);
    const req = editing && this.selectedId()
      ? this.investments.updatePortfolio(this.selectedId()!, {
          name: form.name.trim(),
          description: form.description.trim(),
        })
      : this.investments.createPortfolio({
          name: form.name.trim(),
          description: form.description.trim(),
        });
    req.subscribe({
      next: (saved) => {
        this.savingPortfolio.set(false);
        this.portfolioModalOpen.set(false);
        if (!editing && saved && saved._id) {
          this.selectedId.set(saved._id);
        }
        this.reloadOverview();
        if (this.selectedId()) this.loadDetail(this.selectedId()!, true);
        this.toast.success('Portfolio saved');
      },
      error: () => {
        this.savingPortfolio.set(false);
        this.toast.error('Failed to save portfolio');
      },
    });
  }

  protected deletePortfolio(p: Investment): void {
    if (!confirm(`Delete portfolio "${p.name}" and all its transactions?`)) return;
    this.investments.deletePortfolio(p._id).subscribe({
      next: () => {
        if (this.selectedId() === p._id) {
          this.selectedId.set(null);
          this.detail.set(null);
        }
        this.reloadOverview();
        this.toast.success('Portfolio deleted');
      },
      error: () => this.toast.error('Failed to delete portfolio'),
    });
  }

  protected openCreateTxn = (d: InvestmentDetail): void => {
    this.txnForm = {
      _id: null,
      investment: d._id,
      type: 'gain',
      amount: 0,
      transaction_date: getTodayLocalDate(),
      note: '',
    };
    this.txnModalTitle.set(this.t('Add change'));
    this.txnModalOpen.set(true);
  };

  protected openSyncValue = (d: InvestmentDetail): void => {
    this.syncForm = {
      id: d._id,
      name: d.name,
      previousValue: d.currentValue ?? 0,
      latestValue: this.formatInputValue(d.currentValue ?? 0),
      date: getTodayLocalDate(),
      note: '',
    };
    this.syncModalOpen.set(true);
  };

  protected closeSyncValue = (): void => this.syncModalOpen.set(false);

  protected saveSyncValue(): void {
    const value = this.parseRupiah(this.syncForm.latestValue);
    if (value === null || value < 0) {
      this.toast.error('Enter a valid non-negative value');
      return;
    }
    if (!this.syncForm.date) {
      this.toast.error('Date is required');
      return;
    }
    const key = typeof crypto !== 'undefined' && crypto.randomUUID
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    this.savingSync.set(true);
    this.investments.syncValue(this.syncForm.id, { currentValue: value, date: this.syncForm.date, note: this.syncForm.note }, key).subscribe({
      next: () => {
        this.savingSync.set(false);
        this.syncModalOpen.set(false);
        this.loadDetail(this.syncForm.id, true);
        this.reloadOverview();
        this.toast.success('Investment value updated');
      },
      error: () => {
        this.savingSync.set(false);
        this.toast.error('Failed to update investment value');
      },
    });
  }

  protected parseRupiah(value: string): number | null {
    const raw = String(value ?? '').replace(/[^0-9]/g, '');
    if (!raw) return null;
    const n = Number(raw);
    return Number.isSafeInteger(n) ? n : null;
  }

  private formatInputValue(value: number): string {
    return new Intl.NumberFormat('id-ID').format(value || 0);
  }

  protected openEditTxn = (d: InvestmentDetail, tx: InvestmentTransaction): void => {
    this.txnForm = {
      _id: tx._id,
      investment: d._id,
      type: tx.type,
      amount: tx.amount,
      transaction_date: tx.transaction_date.slice(0, 10),
      note: tx.note ?? '',
    };
    this.txnModalTitle.set(this.t('Edit change'));
    this.txnModalOpen.set(true);
  };

  protected closeTxnModal = (): void => {
    this.txnModalOpen.set(false);
  };

  protected saveTxn(): void {
    const form = this.txnForm;
    if (!form.amount || form.amount <= 0) {
      this.toast.error('Amount must be greater than zero');
      return;
    }
    if (!form.transaction_date) {
      this.toast.error('Date is required');
      return;
    }
    const payload = {
      investment: form.investment,
      type: form.type,
      amount: Number(form.amount),
      transaction_date: form.transaction_date,
      note: form.note,
    };
    this.savingTxn.set(true);
    const req = form._id
      ? this.investments.updateTransaction(form._id, payload)
      : this.investments.createTransaction(payload);
    req.subscribe({
      next: () => {
        this.savingTxn.set(false);
        this.txnModalOpen.set(false);
        if (this.selectedId()) this.loadDetail(this.selectedId()!, true);
        this.reloadOverview();
        this.toast.success('Saved');
      },
      error: () => {
        this.savingTxn.set(false);
        this.toast.error('Failed to save');
      },
    });
  }

  protected deleteTxn(tx: InvestmentTransaction): void {
    if (!confirm('Delete this change?')) return;
    this.investments.deleteTransaction(tx._id).subscribe({
      next: () => {
        if (this.selectedId()) this.loadDetail(this.selectedId()!, true);
        this.reloadOverview();
        this.toast.success('Deleted');
      },
      error: () => this.toast.error('Failed to delete'),
    });
  }

  protected txnDate(v: string | null | undefined): string {
    if (!v) return '';
    const d = new Date(v);
    if (Number.isNaN(d.getTime())) return String(v).slice(0, 10);
    try {
      return (this.i18n.lang() === 'id' ? idDateFormatter : enDateFormatter).format(d);
    } catch {
      return String(v).slice(0, 10);
    }
  }

  protected txnLabel(type: InvestmentTransactionType): string {
    return this.t(TYPE_META[type]?.label ?? type);
  }

  protected txnTone(type: InvestmentTransactionType): 'success' | 'danger' | 'warning' | 'primary' | 'neutral' {
    return TYPE_META[type]?.tone ?? 'neutral';
  }

  protected amountFor(tx: InvestmentTransaction): string {
    const abs = formatCurrency(tx.amount);
    if (tx.type === 'deposit' || tx.type === 'gain') return `+${abs}`;
    return `−${abs}`;
  }

  protected amountClass(type: InvestmentTransactionType): string {
    if (type === 'deposit' || type === 'gain') return 'text-success';
    return 'text-danger';
  }
}
