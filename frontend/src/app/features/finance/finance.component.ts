import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CardComponent } from '../../shared/components/card/card.component';
import { PageHeaderComponent } from '../../shared/components/page-header/page-header.component';
import { StatCardComponent } from '../../shared/components/stat-card/stat-card.component';
import { ButtonComponent } from '../../shared/components/button/button.component';
import { IconComponent } from '../../shared/components/icon/icon.component';
import { BadgeComponent } from '../../shared/components/badge/badge.component';
import { ProgressComponent } from '../../shared/components/progress/progress.component';
import { FieldComponent } from '../../shared/components/field/field.component';
import { SelectComponent } from '../../shared/components/select/select.component';
import { ModalComponent } from '../../shared/components/modal/modal.component';
import { SkeletonComponent } from '../../shared/components/skeleton/skeleton.component';
import { SegmentedComponent } from '../../shared/components/segmented/segmented.component';
import { DonutChartComponent, DonutSegment } from '../../shared/components/chart/donut-chart.component';
import {
  AccountService,
  BudgetService,
  TransactionService,
} from '../../core/services/finance.service';
import { CategoryService } from '../../core/services/category.service';
import { ToastService } from '../../core/services/toast.service';
import type {
  Account,
  Budget,
  Transaction,
  TransactionPayload,
  TransactionType,
} from '../../core/models/finance.model';
import type { Category } from '../../core/models/task.model';
import {
  formatCurrency,
  formatDate,
  monthKey,
  monthLabel,
  percent,
  toDate,
} from '../../core/utils/format';

@Component({
  selector: 'app-finance',
  standalone: true,
  imports: [
    FormsModule,
    CardComponent,
    PageHeaderComponent,
    StatCardComponent,
    ButtonComponent,
    IconComponent,
    BadgeComponent,
    ProgressComponent,
    FieldComponent,
    SelectComponent,
    ModalComponent,
    SkeletonComponent,
    SegmentedComponent,
    DonutChartComponent,
  ],
  template: `
    <app-page-header
      title="Finance"
      subtitle="Track your money and stay on budget."
      actionLabel="Add transaction"
      actionIcon="plus"
      [action]="openCreate"
    ></app-page-header>

    <!-- Summary -->
    <div class="mb-6 grid grid-cols-2 gap-4 xl:grid-cols-4">
      <app-stat-card label="Balance" [value]="formatCurrency(balance())" icon="piggy-bank" tone="primary" />
      <app-stat-card label="Income (month)" [value]="formatCurrency(monthIncome())" icon="trending-up" tone="success" />
      <app-stat-card label="Expenses (month)" [value]="formatCurrency(monthExpense())" icon="trending-down" tone="danger" />
      <app-stat-card label="Transactions" [value]="transactions().length" icon="receipt" />
    </div>

    <!-- Accounts -->
    <div class="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <app-card class="flex items-center gap-4 p-5">
        <span class="flex h-10 w-10 items-center justify-center rounded-xl bg-surface-2 text-ink">
          <app-icon name="circle-plus" [size]="20" />
        </span>
        <button
          (click)="openAccount()"
          class="text-sm font-semibold text-ink hover:underline"
        >
          Add account
        </button>
      </app-card>
      @for (account of accounts(); track account._id) {
        <app-card class="flex items-center gap-4 p-5">
          <span class="flex h-10 w-10 items-center justify-center rounded-xl bg-surface-2 text-ink">
            <app-icon [name]="accountIcon(account.type)" [size]="20" />
          </span>
          <div class="min-w-0">
            <p class="truncate text-sm font-semibold text-ink">{{ account.name }}</p>
            <p class="text-sm text-ink-soft">{{ formatCurrency(account.balance) }}</p>
          </div>
        </app-card>
      }
    </div>

    <div class="grid grid-cols-1 gap-6 lg:grid-cols-3">
      <!-- Transactions -->
      <div class="lg:col-span-2">
        <div class="mb-4 flex flex-wrap items-center gap-3">
          <app-segmented
            [options]="typeOptions()"
            [model]="typeFilter()"
            (change)="setTypeFilter($event)"
          />
          <div class="ml-auto flex flex-wrap items-center gap-2">
            <app-select
              placeholder="Account"
              [options]="accountOptions()"
              [(ngModel)]="accountFilter"
            ></app-select>
            <app-select
              placeholder="Category"
              [options]="categoryOptions()"
              [(ngModel)]="categoryFilter"
            ></app-select>
          </div>
        </div>

        <app-card>
          @if (transactionsLoading()) {
            <div class="space-y-3 p-4">
              @for (_ of [1, 2, 3, 4, 5]; track $index) {
                <app-skeleton size="field" />
              }
            </div>
          } @else if (filteredTransactions().length === 0) {
            <div class="px-6 py-14 text-center">
              <app-icon name="wallet" [size]="36" [strokeWidth]="1.5" class="mx-auto text-ink-faint" />
              <p class="mt-3 text-sm font-semibold text-ink">No transactions</p>
              <p class="mt-1 text-sm text-ink-soft">Add your first income or expense.</p>
            </div>
          } @else {
            <ul class="divide-y divide-line">
              @for (txn of filteredTransactions(); track txn._id) {
                <li class="flex items-center gap-4 px-5 py-3.5 transition-colors hover:bg-surface-2/60">
                  <span
                    class="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg"
                    [class.bg-success/10]="txn.type === 'income'"
                    [class.bg-danger/10]="txn.type === 'expense'"
                    [class.text-success]="txn.type === 'income'"
                    [class.text-danger]="txn.type === 'expense'"
                  >
                    <app-icon
                      [name]="txn.type === 'income' ? 'arrow-down-right' : 'arrow-up-right'"
                      [size]="17"
                    />
                  </span>
                  <div class="min-w-0 flex-1">
                    <p class="truncate text-sm font-medium text-ink">
                      {{ txn.description || 'Transaction' }}
                    </p>
                    <p class="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-ink-faint">
                      <span class="flex items-center gap-1">
                        <span class="inline-block h-2 w-2 rounded-full" [style.background]="categoryColor(txn.category)"></span>
                        {{ categoryName(txn.category) || 'Uncategorized' }}
                      </span>
                      <span class="flex items-center gap-1">
                        <app-icon name="calendar" [size]="12" />
                        {{ formatDate(txn.date, 'short') }}
                      </span>
                      @if (txn.recurring?.isRecurring) {
                        <app-badge tone="info" icon="repeat">{{ txn.recurring?.frequency }}</app-badge>
                      }
                    </p>
                  </div>
                  <span
                    class="shrink-0 text-sm font-semibold"
                    [class.text-success]="txn.type === 'income'"
                    [class.text-ink]="txn.type === 'expense'"
                  >
                    {{ txn.type === 'income' ? '+' : '−' }}{{ formatCurrency(txn.amount) }}
                  </span>
                  <div class="flex shrink-0 items-center gap-0.5">
                    <app-button size="icon" variant="ghost" icon="pencil"
                      [attr.aria-label]="'Edit transaction'"
                      (click)="openEdit(txn)"></app-button>
                    <app-button size="icon" variant="ghost" icon="trash-2"
                      [attr.aria-label]="'Delete transaction'"
                      (click)="remove(txn)"></app-button>
                  </div>
                </li>
              }
            </ul>
          }
        </app-card>
      </div>

      <!-- Sidebar: budgets + spending -->
      <div class="space-y-6">
        <app-card>
          <div class="flex items-center justify-between px-5 pt-5">
            <h2 class="text-base font-semibold text-ink">Budgets</h2>
            <app-button size="sm" variant="secondary" icon="plus" (click)="openBudget()"></app-button>
          </div>
          <div class="p-5">
            <div class="mb-4 flex items-center gap-2">
              <app-button size="icon" variant="ghost" icon="chevron-left"
                [attr.aria-label]="'Previous month'"
                (click)="shiftMonth(-1)"></app-button>
              <span class="flex-1 text-center text-sm font-medium text-ink">{{ monthLabel(budgetMonth()) }}</span>
              <app-button size="icon" variant="ghost" icon="chevron-right"
                [attr.aria-label]="'Next month'"
                (click)="shiftMonth(1)"></app-button>
            </div>
            @if (budgetsLoading()) {
              <div class="space-y-3">@for (_ of [1, 2]; track $index) { <app-skeleton size="field" /> }</div>
            } @else if (budgets().length === 0) {
              <p class="py-6 text-center text-sm text-ink-soft">No budgets for this month.</p>
            } @else {
              <div class="space-y-4">
                @for (budget of budgets(); track budget._id) {
                  <div>
                    <div class="mb-1.5 flex items-center justify-between text-sm">
                      <span class="font-medium text-ink">{{ categoryName(budget.category) || 'Overall' }}</span>
                      <span class="text-xs text-ink-soft">{{ formatCurrency(budget.spent) }} / {{ formatCurrency(budget.amount) }}</span>
                    </div>
                    <app-progress [value]="percent(budget.spent, budget.amount)" />
                  </div>
                }
              </div>
            }
          </div>
        </app-card>

        <app-card>
          <div class="px-5 pt-5">
            <h2 class="text-base font-semibold text-ink">Spending by category</h2>
            <p class="text-xs text-ink-soft">This month</p>
          </div>
          <div class="p-5">
            <app-donut-chart [segments]="spendingSegments()" [totalLabel]="'spent'" />
          </div>
        </app-card>
      </div>
    </div>

    <!-- Transaction modal -->
    <app-modal
      [open]="txnModalOpen()"
      [title]="editingTxn() ? 'Edit transaction' : 'New transaction'"
      (closed)="txnModalOpen.set(false)"
    >
      <form (ngSubmit)="saveTxn()" class="space-y-4">
        <app-segmented
          [options]="typeOptions()"
          [model]="txnForm.type ?? 'expense'"
          (change)="setTxnType($event)"
        />
        <app-field
          label="Amount"
          type="number"
          placeholder="0"
          [required]="true"
          [(ngModel)]="txnForm.amount"
          name="amount"
        />
        <app-field
          label="Description"
          placeholder="e.g. Groceries"
          [(ngModel)]="txnForm.description"
          name="description"
        />
        <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <app-select
            label="Category"
            placeholder="Select category"
            [options]="categoryOptions()"
            [(ngModel)]="txnForm.category"
            name="category"
          />
          <app-select
            label="Account"
            placeholder="Select account"
            [options]="accountOptions()"
            [(ngModel)]="txnForm.account"
            name="account"
          />
        </div>
        <app-field
          label="Date"
          type="date"
          [required]="true"
          [(ngModel)]="txnForm.date"
          name="date"
        />
        <div class="flex justify-end gap-2 pt-2">
          <app-button type="button" variant="secondary" (click)="txnModalOpen.set(false)">Cancel</app-button>
          <app-button type="submit" [loading]="savingTxn()">Save</app-button>
        </div>
      </form>
    </app-modal>

    <!-- Account modal -->
    <app-modal
      [open]="accountModalOpen()"
      title="New account"
      (closed)="accountModalOpen.set(false)"
    >
      <form (ngSubmit)="saveAccount()" class="space-y-4">
        <app-field label="Name" placeholder="e.g. Main bank" [required]="true"
          [(ngModel)]="accountForm.name" name="name" />
        <app-select label="Type" [options]="accountTypeOptions()"
          [(ngModel)]="accountForm.type" name="type" />
        <app-field label="Balance" type="number" placeholder="0"
          [(ngModel)]="accountForm.balance" name="balance" />
        <div class="flex justify-end gap-2 pt-2">
          <app-button type="button" variant="secondary" (click)="accountModalOpen.set(false)">Cancel</app-button>
          <app-button type="submit" [loading]="savingAccount()">Save</app-button>
        </div>
      </form>
    </app-modal>

    <!-- Budget modal -->
    <app-modal
      [open]="budgetModalOpen()"
      title="New budget"
      (closed)="budgetModalOpen.set(false)"
    >
      <form (ngSubmit)="saveBudget()" class="space-y-4">
        <app-select label="Category" placeholder="Overall (all categories)"
          [options]="categoryOptions()" [(ngModel)]="budgetForm.category" name="category" />
        <app-field label="Amount" type="number" placeholder="0" [required]="true"
          [(ngModel)]="budgetForm.amount" name="amount" />
        <p class="text-xs text-ink-soft">Budget for {{ monthLabel(budgetMonth()) }}.</p>
        <div class="flex justify-end gap-2 pt-2">
          <app-button type="button" variant="secondary" (click)="budgetModalOpen.set(false)">Cancel</app-button>
          <app-button type="submit" [loading]="savingBudget()">Save</app-button>
        </div>
      </form>
    </app-modal>
  `,
})
export class FinanceComponent implements OnInit {
  private txnService = inject(TransactionService);
  private accountService = inject(AccountService);
  private budgetService = inject(BudgetService);
  private categoryService = inject(CategoryService);
  private toast = inject(ToastService);

  protected readonly transactions = this.txnService.transactions;
  protected readonly transactionsLoading = this.txnService.loading;
  protected readonly accounts = this.accountService.accounts;
  protected readonly budgets = this.budgetService.budgets;
  protected readonly budgetsLoading = this.budgetService.loading;
  protected readonly categories = this.categoryService.categories;

  protected readonly typeFilter = signal<TransactionType | 'all'>('all');
  protected accountFilter = '';
  protected categoryFilter = '';

  protected readonly txnModalOpen = signal(false);
  protected readonly accountModalOpen = signal(false);
  protected readonly budgetModalOpen = signal(false);
  protected readonly editingTxn = signal<Transaction | null>(null);
  protected readonly savingTxn = signal(false);
  protected readonly savingAccount = signal(false);
  protected readonly savingBudget = signal(false);

  protected readonly budgetMonth = signal(monthKey());
  protected txnForm: TransactionPayload = {};
  protected accountForm: Partial<Account> = {};
  protected budgetForm: Partial<Budget> = {};

  protected readonly typeOptions = computed(() => [
    { value: 'all', label: 'All' },
    { value: 'income', label: 'Income' },
    { value: 'expense', label: 'Expense' },
  ]);

  protected readonly accountOptions = computed<{ value: string; label: string }[]>(() =>
    this.accounts().map((a) => ({ value: a._id, label: a.name }))
  );

  protected readonly categoryOptions = computed<{ value: string; label: string }[]>(() =>
    this.categories()
      .filter((c) => c.type === 'transaction')
      .map((c) => ({ value: c._id, label: c.name }))
  );

  protected readonly accountTypeOptions = computed(() => [
    { value: 'cash', label: 'Cash' },
    { value: 'bank', label: 'Bank' },
    { value: 'ewallet', label: 'E-wallet' },
  ]);

  protected readonly filteredTransactions = computed(() =>
    this.transactions().filter((t) => {
      if (this.typeFilter() !== 'all' && t.type !== this.typeFilter()) return false;
      if (this.accountFilter && String(t.account) !== this.accountFilter) return false;
      if (this.categoryFilter && String(t.category) !== this.categoryFilter) return false;
      return true;
    })
  );

  protected readonly balance = computed(() =>
    this.transactions().reduce((sum, t) => sum + (t.type === 'income' ? t.amount : -t.amount), 0)
  );

  protected readonly monthIncome = computed(() =>
    this.transactions()
      .filter((t) => t.type === 'income' && monthKey(toDate(t.date)) === this.budgetMonth())
      .reduce((s, t) => s + t.amount, 0)
  );

  protected readonly monthExpense = computed(() =>
    this.transactions()
      .filter((t) => t.type === 'expense' && monthKey(toDate(t.date)) === this.budgetMonth())
      .reduce((s, t) => s + t.amount, 0)
  );

  protected readonly spendingSegments = computed<DonutSegment[]>(() => {
    const spent = new Map<string, number>();
    for (const t of this.transactions()) {
      if (t.type !== 'expense') continue;
      if (monthKey(toDate(t.date)) !== this.budgetMonth()) continue;
      const name = this.categoryName(t.category) || 'Other';
      spent.set(name, (spent.get(name) ?? 0) + t.amount);
    }
    const palette = [
      'var(--color-primary)',
      'var(--color-success)',
      'var(--color-warning)',
      'var(--color-danger)',
      'var(--color-ink)',
      'var(--color-ink-soft)',
    ];
    return [...spent.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([label, value], i) => ({ label, value, color: palette[i % palette.length] }));
  });

  ngOnInit(): void {
    this.categoryService.load({ type: 'transaction' });
    this.reload();
  }

  private reload(): void {
    this.txnService.load();
    this.accountService.load();
    this.budgetService.load({ month: this.budgetMonth() });
  }

  protected shiftMonth(dir: number): void {
    const [y, m] = this.budgetMonth().split('-').map(Number);
    const d = new Date(y, m - 1 + dir, 1);
    this.budgetMonth.set(monthKey(d));
    this.budgetService.load({ month: this.budgetMonth() });
  }

  protected setTypeFilter(value: string): void {
    this.typeFilter.set(value as TransactionType | 'all');
  }

  protected setTxnType(t: string): void {
    this.txnForm = { ...this.txnForm, type: t as TransactionType };
  }

  protected openCreate = (): void => {
    this.editingTxn.set(null);
    this.txnForm = {
      type: 'expense',
      amount: undefined,
      description: '',
      date: new Date().toISOString().slice(0, 10),
    };
    this.txnModalOpen.set(true);
  };

  protected openEdit(txn: Transaction): void {
    this.editingTxn.set(txn);
    this.txnForm = {
      type: txn.type,
      amount: txn.amount,
      description: txn.description,
      category: typeof txn.category === 'string' ? txn.category : txn.category?._id,
      account: typeof txn.account === 'string' ? txn.account : txn.account?._id,
      date: String(txn.date).slice(0, 10),
    };
    this.txnModalOpen.set(true);
  }

  protected saveTxn(): void {
    const amount = Number(this.txnForm.amount);
    if (!this.txnForm.type || !amount || amount <= 0) {
      this.toast.error('Please enter a valid amount.');
      return;
    }
    const payload: TransactionPayload = {
      ...this.txnForm,
      amount,
      category: this.txnForm.category || null,
      account: this.txnForm.account || null,
    };
    this.savingTxn.set(true);
    const obs = this.editingTxn()
      ? this.txnService.update(this.editingTxn()!._id, payload)
      : this.txnService.create(payload);
    obs.subscribe({
      next: () => {
        this.savingTxn.set(false);
        this.toast.success(this.editingTxn() ? 'Transaction updated' : 'Transaction added');
        this.txnModalOpen.set(false);
        this.reload();
      },
      error: (err: Error) => {
        this.savingTxn.set(false);
        this.toast.error(err.message);
      },
    });
  }

  protected openAccount(): void {
    this.accountForm = { name: '', type: 'bank', balance: 0 };
    this.accountModalOpen.set(true);
  }

  protected saveAccount(): void {
    if (!this.accountForm.name?.trim()) {
      this.toast.error('Account name is required.');
      return;
    }
    this.savingAccount.set(true);
    this.accountService
      .create({
        name: this.accountForm.name.trim(),
        type: this.accountForm.type ?? 'bank',
        balance: Number(this.accountForm.balance ?? 0),
      })
      .subscribe({
        next: () => {
          this.savingAccount.set(false);
          this.toast.success('Account added');
          this.accountModalOpen.set(false);
          this.accountService.load();
        },
        error: (err: Error) => {
          this.savingAccount.set(false);
          this.toast.error(err.message);
        },
      });
  }

  protected openBudget(): void {
    this.budgetForm = { amount: undefined, month: this.budgetMonth() };
    this.budgetModalOpen.set(true);
  }

  protected saveBudget(): void {
    const amount = Number(this.budgetForm.amount);
    if (!amount || amount <= 0) {
      this.toast.error('Please enter a valid budget amount.');
      return;
    }
    this.savingBudget.set(true);
    this.budgetService
      .create({
        category: this.budgetForm.category || null,
        amount,
        month: this.budgetMonth(),
      })
      .subscribe({
        next: () => {
          this.savingBudget.set(false);
          this.toast.success('Budget created');
          this.budgetModalOpen.set(false);
          this.budgetService.load({ month: this.budgetMonth() });
        },
        error: (err: Error) => {
          this.savingBudget.set(false);
          this.toast.error(err.message);
        },
      });
  }

  protected remove(txn: Transaction): void {
    if (!confirm('Delete this transaction?')) return;
    this.txnService.remove(txn._id).subscribe({
      next: () => {
        this.toast.success('Transaction deleted');
        this.reload();
      },
      error: (err: Error) => this.toast.error(err.message),
    });
  }

  protected accountIcon(type: string): string {
    if (type === 'cash') return 'banknote';
    if (type === 'ewallet') return 'smartphone';
    return 'credit-card';
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

  protected readonly formatCurrency = formatCurrency;
  protected readonly formatDate = formatDate;
  protected readonly percent = percent;
  protected readonly monthLabel = monthLabel;
}
