import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CardComponent } from '../../layout/components/card.component';
import { PageHeaderComponent } from '../../layout/components/page-header.component';
import { StatCardComponent } from './components/stat-card.component';
import { ButtonComponent } from '../../layout/components/button.component';
import { IconComponent } from '../../layout/components/icon.component';
import { BadgeComponent } from '../../layout/components/badge.component';
import { ProgressComponent } from '../../layout/components/progress.component';
import { FieldComponent } from '../../layout/components/field.component';
import { SelectComponent } from '../../layout/components/select.component';
import { ModalComponent } from '../../layout/components/modal.component';
import { SkeletonComponent } from '../../layout/components/skeleton.component';
import { SegmentedComponent } from '../../layout/components/segmented.component';
import { DonutChartComponent, DonutSegment } from './components/donut-chart.component';
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
  RecurringFrequency,
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
import { formatDateToLocalYYYYMMDD, getTodayLocalDate } from '../../core/utils/date';

const HIDE_BALANCE_KEY = 'lifehub_hide_balance';

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
    <div class="mb-3 flex items-center justify-between">
      <p class="text-xs font-bold uppercase tracking-wider text-ink-soft">Summary</p>
      <app-button
        size="icon"
        variant="ghost"
        [icon]="hideBalance() ? 'eye-off' : 'eye'"
        [attr.aria-label]="hideBalance() ? 'Show balances' : 'Hide balances'"
        [attr.title]="hideBalance() ? 'Show balances' : 'Hide balances'"
        (click)="toggleHideBalance()"
      ></app-button>
    </div>
    <div class="mb-6 grid grid-cols-2 gap-4 xl:grid-cols-4">
      <app-stat-card label="Balance" [value]="displayBalance(balance())" icon="piggy-bank" tone="primary" />
      <app-stat-card label="Income (month)" [value]="displayAmount(monthIncome())" icon="trending-up" tone="success" />
      <app-stat-card label="Expenses (month)" [value]="displayAmount(monthExpense())" icon="trending-down" tone="danger" />
      <app-stat-card label="Transactions" [value]="transactions().length" icon="receipt" />
    </div>

    <!-- Accounts -->
    <div class="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <app-card class="h-full">
        <div class="flex h-full items-center gap-4">
          <span class="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-surface-2 text-ink">
            <app-icon name="circle-plus" [size]="20" />
          </span>
          <button
            (click)="openAccount()"
            class="min-w-0 text-left text-sm font-semibold text-ink hover:underline"
          >
            Add account
          </button>
        </div>
      </app-card>
      @for (account of accounts(); track account._id) {
        @let logo = accountLogo(account.name);
        <app-card class="h-full">
          <div class="flex h-full items-center gap-3">
            @if (logo && !failedLogos().includes(account._id)) {
              <span class="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-white p-1.5 ring-1 ring-line">
                <img
                  [src]="logo"
                  [alt]="account.name"
                  loading="lazy"
                  class="h-full w-full object-contain"
                  (error)="onLogoError(account)"
                />
              </span>
            } @else {
              <span class="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-surface-2 text-ink">
                <app-icon [name]="accountIcon(account.type)" [size]="20" />
              </span>
            }
            <div class="min-w-0 flex-1">
              <p class="truncate text-sm font-semibold text-ink">{{ account.name }}</p>
              <p class="truncate text-sm text-ink-soft">{{ displayBalance(account.balance) }}</p>
            </div>
            <div class="flex shrink-0 items-center gap-0.5">
              <app-button size="icon" variant="ghost" icon="pencil"
                [attr.aria-label]="'Edit ' + account.name"
                (click)="openEditAccount(account)"></app-button>
              <app-button size="icon" variant="ghost" icon="trash-2"
                [attr.aria-label]="'Delete ' + account.name"
                (click)="removeAccount(account)"></app-button>
            </div>
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
              [ngModel]="accountFilter()"
              (ngModelChange)="accountFilter.set($event)"
            ></app-select>
            <app-select
              placeholder="Category"
              [options]="categoryOptions()"
              [ngModel]="categoryFilter()"
              (ngModelChange)="categoryFilter.set($event)"
            ></app-select>
          </div>
        </div>

        <app-card [padding]="'none'">
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
                    [class.bg-primary/15]="txn.type === 'transfer'"
                    [class.text-success]="txn.type === 'income'"
                    [class.text-danger]="txn.type === 'expense'"
                    [class.text-ink]="txn.type === 'transfer'"
                  >
                    <app-icon
                      [name]="txn.type === 'income' ? 'arrow-down-right' : txn.type === 'expense' ? 'arrow-up-right' : 'arrow-right'"
                      [size]="17"
                    />
                  </span>
                  <div class="min-w-0 flex-1">
                    <p class="truncate text-sm font-medium text-ink">
                      {{ txn.description || (txn.type === 'transfer' ? 'Transfer' : 'Transaction') }}
                    </p>
                    <p class="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-ink-faint">
                      @if (txn.type === 'transfer') {
                        <span class="flex items-center gap-1 font-medium text-ink-soft">
                          {{ accountName(txn.fromAccount) }} → {{ accountName(txn.toAccount) }}
                        </span>
                      } @else {
                        <span class="flex items-center gap-1">
                          <span class="inline-block h-2 w-2 rounded-full" [style.background]="categoryColor(txn.category)"></span>
                          {{ categoryName(txn.category) || 'Uncategorized' }}
                        </span>
                      }
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
                    [class.text-ink]="txn.type === 'expense' || txn.type === 'transfer'"
                  >
                    {{ txn.type === 'transfer' ? '' : txn.type === 'income' ? '+' : '−' }}{{ formatCurrency(txn.amount) }}
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
        <app-card [padding]="'none'">
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
                    <div class="mb-1.5 flex items-center gap-2 text-sm">
                      <span class="min-w-0 flex-1 truncate font-medium text-ink">{{ categoryName(budget.category) || 'Overall' }}</span>
                      <span class="shrink-0 text-xs text-ink-soft">{{ formatCurrency(budget.spent) }} / {{ formatCurrency(budget.amount) }}</span>
                      <app-button size="icon" variant="ghost" icon="pencil"
                        [attr.aria-label]="'Edit budget'"
                        (click)="openEditBudget(budget)"></app-button>
                      <app-button size="icon" variant="ghost" icon="trash-2"
                        [attr.aria-label]="'Delete budget'"
                        (click)="removeBudget(budget)"></app-button>
                    </div>
                    <app-progress [value]="percent(budget.spent, budget.amount)" />
                  </div>
                }
              </div>
            }
          </div>
        </app-card>

        <app-card [padding]="'none'">
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
        @if (txnForm.type === 'transfer') {
          <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <app-select
              label="From account"
              placeholder="Select account"
              [options]="accountOptions()"
              [required]="true"
              [(ngModel)]="txnForm.fromAccount"
              name="fromAccount"
            />
            <app-select
              label="To account"
              placeholder="Select account"
              [options]="accountOptions()"
              [required]="true"
              [(ngModel)]="txnForm.toAccount"
              name="toAccount"
            />
          </div>
        } @else {
          <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <app-select
              label="Category"
              placeholder="Select category"
              [options]="categoryOptions()"
              [required]="isExpense()"
              [hint]="isExpense() ? 'Updates your budget progress.' : ''"
              [(ngModel)]="txnForm.category"
              name="category"
            />
            <app-select
              label="Account"
              placeholder="Select account"
              [options]="accountOptions()"
              [required]="true"
              [hint]="'Updates the balance of this bank or e-wallet.'"
              [(ngModel)]="txnForm.account"
              name="account"
            />
          </div>
        }
        <app-field
          label="Date"
          type="date"
          [required]="true"
          [(ngModel)]="txnForm.date"
          name="date"
        />
        @if (txnForm.type !== 'transfer') {
          <app-select
            label="Repeat"
            [options]="recurringOptions()"
            [hint]="'Generates a new transaction on schedule.'"
            [(ngModel)]="txnRecurring"
            name="recurring"
          />
        }
        <div class="flex justify-end gap-2 pt-2">
          <app-button type="button" variant="secondary" (click)="txnModalOpen.set(false)">Cancel</app-button>
          <app-button type="submit" [loading]="savingTxn()">Save</app-button>
        </div>
      </form>
    </app-modal>

    <!-- Account modal -->
    <app-modal
      [open]="accountModalOpen()"
      [title]="editingAccount() ? 'Edit account' : 'New account'"
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
      [title]="editingBudget() ? 'Edit budget' : 'New budget'"
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
  protected readonly failedLogos = signal<string[]>([]);
  protected readonly hideBalance = signal<boolean>(localStorage.getItem(HIDE_BALANCE_KEY) === '1');

  protected readonly typeFilter = signal<TransactionType | 'all'>('all');
  protected readonly accountFilter = signal('');
  protected readonly categoryFilter = signal('');

  protected readonly txnModalOpen = signal(false);
  protected readonly accountModalOpen = signal(false);
  protected readonly budgetModalOpen = signal(false);
  protected readonly editingTxn = signal<Transaction | null>(null);
  protected readonly editingAccount = signal<Account | null>(null);
  protected readonly editingBudget = signal<Budget | null>(null);
  protected readonly savingTxn = signal(false);
  protected readonly savingAccount = signal(false);
  protected readonly savingBudget = signal(false);

  protected readonly budgetMonth = signal(monthKey());
  protected txnForm: TransactionPayload = {};
  protected txnRecurring: RecurringFrequency = 'none';
  protected accountForm: Partial<Account> = {};
  protected budgetForm: Partial<Budget> = {};

  protected readonly typeOptions = computed(() => [
    { value: 'all', label: 'All' },
    { value: 'income', label: 'Income' },
    { value: 'expense', label: 'Expense' },
    { value: 'transfer', label: 'Transfer' },
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

  protected readonly recurringOptions = computed(() => [
    { value: 'none', label: 'No repeat' },
    { value: 'daily', label: 'Daily' },
    { value: 'weekly', label: 'Weekly' },
    { value: 'monthly', label: 'Monthly' },
  ]);

  protected readonly filteredTransactions = computed(() =>
    this.transactions().filter((t) => {
      if (this.typeFilter() !== 'all' && t.type !== this.typeFilter()) return false;
      const selectedAccount = this.accountFilter();
      if (
        selectedAccount &&
        ![t.account, t.fromAccount, t.toAccount].some((a) => this.idOf(a) === selectedAccount)
      ) {
        return false;
      }
      const selectedCategory = this.categoryFilter();
      if (selectedCategory && this.idOf(t.category) !== selectedCategory) return false;
      return true;
    })
  );

  protected toggleHideBalance(): void {
    const value = !this.hideBalance();
    this.hideBalance.set(value);
    localStorage.setItem(HIDE_BALANCE_KEY, value ? '1' : '0');
  }

  protected displayBalance(value: number): string {
    return this.hideBalance() ? this.maskedAmount() : formatCurrency(value);
  }

  protected displayAmount(value: number): string {
    return this.hideBalance() ? this.maskedAmount() : formatCurrency(value);
  }

  private maskedAmount(): string {
    const symbol = formatCurrency(0).replace(/[\d.,\s]/g, '').trim() || 'Rp';
    return `${symbol} ••••••`;
  }

  protected readonly balance = computed(() =>
    this.accounts().reduce((sum, a) => sum + (Number(a.balance) || 0), 0)
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

  protected isExpense(): boolean {
    return (this.txnForm.type ?? 'expense') === 'expense';
  }

  protected openCreate = (): void => {
    this.editingTxn.set(null);
    this.txnForm = {
      type: 'expense',
      amount: undefined,
      description: '',
      date: getTodayLocalDate(),
      fromAccount: '',
      toAccount: '',
    };
    this.txnRecurring = this.txnForm.recurring?.isRecurring
      ? (this.txnForm.recurring.frequency ?? 'monthly')
      : 'none';
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
      fromAccount: typeof txn.fromAccount === 'string' ? txn.fromAccount : txn.fromAccount?._id ?? '',
      toAccount: typeof txn.toAccount === 'string' ? txn.toAccount : txn.toAccount?._id ?? '',
      date: formatDateToLocalYYYYMMDD(toDate(txn.date)),
    };
    this.txnRecurring = txn.recurring?.isRecurring
      ? (txn.recurring.frequency ?? 'monthly')
      : 'none';
    this.txnModalOpen.set(true);
  }

  protected saveTxn(): void {
    const amount = Number(this.txnForm.amount);
    if (!this.txnForm.type || !amount || amount <= 0) {
      this.toast.error('Please enter a valid amount.');
      return;
    }
    if (this.txnForm.type === 'transfer') {
      if (!this.txnForm.fromAccount || !this.txnForm.toAccount) {
        this.toast.error('Select both accounts for the transfer.');
        return;
      }
      if (this.txnForm.fromAccount === this.txnForm.toAccount) {
        this.toast.error('Pick two different accounts.');
        return;
      }
      this.savingTxn.set(true);
      const transferPayload: TransactionPayload = {
        type: 'transfer',
        amount,
        description: this.txnForm.description || '',
        fromAccount: this.txnForm.fromAccount,
        toAccount: this.txnForm.toAccount,
        date: this.txnForm.date || getTodayLocalDate(),
      };
      const obs = this.editingTxn()
        ? this.txnService.update(this.editingTxn()!._id, transferPayload)
        : this.txnService.create(transferPayload);
      obs.subscribe({
        next: () => {
          this.savingTxn.set(false);
          this.toast.success(this.editingTxn() ? 'Transfer updated' : 'Transfer added');
          this.txnModalOpen.set(false);
          this.reload();
        },
        error: (err: Error) => {
          this.savingTxn.set(false);
          this.toast.error(err.message);
        },
      });
      return;
    }
    if (!this.txnForm.account) {
      this.toast.error('Select an account so the balance is updated.');
      return;
    }
    if (this.isExpense() && !this.txnForm.category) {
      this.toast.error('Select a category so your budget is updated.');
      return;
    }
    const isRecurring = this.txnRecurring !== 'none';
    const payload: TransactionPayload = {
      type: this.txnForm.type,
      amount,
      description: this.txnForm.description || '',
      category: this.txnForm.category || null,
      account: this.txnForm.account || null,
      date: this.txnForm.date || getTodayLocalDate(),
      recurring: {
        isRecurring,
        frequency: isRecurring ? this.txnRecurring : 'none',
      },
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
    this.editingAccount.set(null);
    this.accountForm = { name: '', type: 'bank', balance: 0 };
    this.accountModalOpen.set(true);
  }

  protected openEditAccount(account: Account): void {
    this.editingAccount.set(account);
    this.accountForm = {
      name: account.name,
      type: account.type,
      balance: account.balance,
    };
    this.accountModalOpen.set(true);
  }

  protected saveAccount(): void {
    if (!this.accountForm.name?.trim()) {
      this.toast.error('Account name is required.');
      return;
    }
    const balance = Number(this.accountForm.balance ?? 0);
    if (!Number.isFinite(balance)) {
      this.toast.error('Please enter a valid balance.');
      return;
    }
    this.savingAccount.set(true);
    const payload = {
      name: this.accountForm.name.trim(),
      type: this.accountForm.type ?? 'bank',
      balance,
    };
    const obs = this.editingAccount()
      ? this.accountService.update(this.editingAccount()!._id, payload)
      : this.accountService.create(payload);
    obs.subscribe({
      next: () => {
        this.savingAccount.set(false);
        this.toast.success(this.editingAccount() ? 'Account updated' : 'Account added');
        this.editingAccount.set(null);
        this.accountModalOpen.set(false);
        this.accountService.load();
      },
      error: (err: Error) => {
        this.savingAccount.set(false);
        this.toast.error(err.message);
      },
    });
  }

  protected removeAccount(account: Account): void {
    if (!confirm(`Delete account "${account.name}"? This cannot be undone.`)) return;
    this.accountService.remove(account._id).subscribe({
      next: () => {
        this.toast.success('Account deleted');
        this.failedLogos.set(this.failedLogos().filter((id) => id !== account._id));
        this.accountService.load();
      },
      error: (err: Error) => this.toast.error(err.message),
    });
  }

  protected openBudget(): void {
    this.editingBudget.set(null);
    this.budgetForm = { amount: undefined, month: this.budgetMonth() };
    this.budgetModalOpen.set(true);
  }

  protected openEditBudget(budget: Budget): void {
    this.editingBudget.set(budget);
    this.budgetForm = {
      category: typeof budget.category === 'string' ? budget.category : budget.category?._id,
      amount: budget.amount,
      month: budget.month,
    };
    this.budgetModalOpen.set(true);
  }

  protected saveBudget(): void {
    const amount = Number(this.budgetForm.amount);
    if (!amount || amount <= 0) {
      this.toast.error('Please enter a valid budget amount.');
      return;
    }
    this.savingBudget.set(true);
    const payload = {
      category: this.budgetForm.category || null,
      amount,
      month: this.budgetMonth(),
    };
    const obs = this.editingBudget()
      ? this.budgetService.update(this.editingBudget()!._id, payload)
      : this.budgetService.create(payload);
    obs.subscribe({
      next: () => {
        this.savingBudget.set(false);
        this.toast.success(this.editingBudget() ? 'Budget updated' : 'Budget created');
        this.editingBudget.set(null);
        this.budgetModalOpen.set(false);
        this.budgetService.load({ month: this.budgetMonth() });
      },
      error: (err: Error) => {
        this.savingBudget.set(false);
        this.toast.error(
          /duplicate/i.test(err.message)
            ? 'A budget for this category already exists this month.'
            : err.message
        );
      },
    });
  }

  protected removeBudget(budget: Budget): void {
    const label = this.categoryName(budget.category) || 'Overall';
    if (!confirm(`Delete budget for ${label}?`)) return;
    this.budgetService.remove(budget._id).subscribe({
      next: () => {
        this.toast.success('Budget deleted');
        this.budgetService.load({ month: this.budgetMonth() });
      },
      error: (err: Error) => this.toast.error(err.message),
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

  protected accountLogo(name: string): string | null {
    const n = name.toLowerCase();
    if (n.includes('bca')) return 'assets/bcamobile.png';
    if (n.includes('livin') || n.includes('mandiri')) return 'assets/livinmandiri.png';
    if (n.includes('bni')) return 'assets/woderbni.png';
    if (n.includes('dana')) return 'assets/dana.png';
    if (/gopay|go[\s-]*pay/.test(n)) return 'assets/gopay.png';
    if (n.includes('sea')) return 'assets/seabank.png';
    return null;
  }

  protected onLogoError(account: Account): void {
    if (!this.failedLogos().includes(account._id)) {
      this.failedLogos.set([...this.failedLogos(), account._id]);
    }
  }

  protected accountName(value: unknown): string {
    if (value && typeof value === 'object' && 'name' in (value as object)) {
      return (value as { name: string }).name;
    }
    return '';
  }

  protected idOf(value: unknown): string {
    if (value && typeof value === 'object') {
      return String((value as { _id?: unknown })._id ?? '');
    }
    return String(value ?? '');
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
