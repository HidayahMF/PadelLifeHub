import { Component, inject, OnDestroy, OnInit, signal } from '@angular/core';
import { toObservable } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { Subscription } from 'rxjs';
import { CommandService } from '../../core/services/command.service';
import { ToastService } from '../../core/services/toast.service';
import { TaskService } from '../../core/services/task.service';
import {
  AccountService,
  TransactionService,
} from '../../core/services/finance.service';
import {
  GoalService,
  NeedService,
  ReminderService,
  WishlistService,
} from '../../core/services/lifestyle.service';
import { NoteService } from '../../core/services/data.service';
import { CategoryService } from '../../core/services/category.service';
import { I18nService } from '../../core/services/i18n.service';
import { ModalComponent } from './modal.component';
import { ButtonComponent } from './button.component';
import { FieldComponent } from './field.component';
import { SelectComponent, type SelectOption } from './select.component';
import { IconComponent } from './icon.component';
import type { Account, Category } from '../../core/models/finance.model';
import { getTodayLocalDate, wibDateTimeToUtcISO } from '../../core/utils/date';

type EntityKey = 'task' | 'transaction' | 'note' | 'goal' | 'reminder' | 'wishlist' | 'need';

interface EntityMeta {
  key: EntityKey;
  label: string;
  icon: string;
  description: string;
  color: string;
}

const ENTITIES: EntityMeta[] = [
  { key: 'task', label: 'Task', icon: 'list-todo', description: 'Something to do', color: 'bg-primary' },
  { key: 'transaction', label: 'Transaction', icon: 'receipt', description: 'Income or expense', color: 'bg-success' },
  { key: 'note', label: 'Note', icon: 'sticky-note', description: 'Capture a thought', color: 'bg-accent' },
  { key: 'goal', label: 'Goal', icon: 'target', description: 'A target to hit', color: 'bg-secondary' },
  { key: 'reminder', label: 'Reminder', icon: 'clock', description: 'Nudge yourself', color: 'bg-warning' },
  { key: 'wishlist', label: 'Wishlist', icon: 'gift', description: 'Save a wish', color: 'bg-primary-strong' },
  { key: 'need', label: 'Need', icon: 'shopping-basket', description: 'Stock up', color: 'bg-danger' },
];

const PRIORITY_OPTIONS: SelectOption[] = [
  { value: 'low', label: 'Low' },
  { value: 'medium', label: 'Medium' },
  { value: 'high', label: 'High' },
];

const REMINDER_TYPE_OPTIONS: SelectOption[] = [
  { value: 'task', label: 'Task' },
  { value: 'bill', label: 'Bill' },
  { value: 'shopping', label: 'Shopping' },
  { value: 'goal', label: 'Goal' },
  { value: 'wishlist', label: 'Wishlist' },
  { value: 'custom', label: 'Custom' },
];

@Component({
  selector: 'app-quick-add',
  standalone: true,
  imports: [
    FormsModule,
    ModalComponent,
    ButtonComponent,
    FieldComponent,
    SelectComponent,
    IconComponent,
  ],
  template: `
    <!-- Floating action button — mobile only -->
    <button
      (click)="launch()"
      class="fixed bottom-6 right-6 z-40 flex h-14 w-14 items-center justify-center rounded-full border-2 border-ink bg-primary text-ink shadow-card transition-all duration-150 hover:-translate-y-0.5 hover:bg-primary-strong active:translate-x-[2px] active:translate-y-[2px] active:shadow-none lg:hidden"
      [attr.aria-label]="t('Quick add')"
    >
      <app-icon name="plus" [size]="26" [strokeWidth]="2.8" />
    </button>

    <app-modal
      [open]="open()"
      [title]="selected() ? t('Quick add') + ' — ' + t(selected()!.label) : t('Quick add')"
      (closed)="close()"
      [width]="560"
    >
      @if (!selected()) {
        <!-- Entity picker -->
        <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
          @for (entity of entities; track entity.key) {
            <button
              (click)="pick(entity.key)"
              class="group flex items-center gap-3 rounded-card border-2 border-ink bg-surface p-3.5 text-left shadow-soft transition-all duration-150 hover:-translate-y-0.5 hover:bg-primary/10 active:translate-x-[2px] active:translate-y-[2px] active:shadow-none"
            >
              <span
                class="flex h-11 w-11 shrink-0 items-center justify-center rounded-[10px] border-2 border-ink text-ink shadow-[2px_2px_0_0_var(--color-ink)]"
                [class]="entity.color"
              >
                <app-icon [name]="entity.icon" [size]="20" [strokeWidth]="2.4" />
              </span>
              <span class="min-w-0">
                <span class="block text-sm font-bold text-ink">{{ t(entity.label) }}</span>
                <span class="block truncate text-xs font-medium text-ink-soft">
                  {{ t(entity.description) }}
                </span>
              </span>
            </button>
          }
        </div>
      } @else {
        <form (ngSubmit)="save()" class="space-y-4">
          @switch (selected()!.key) {
            @case ('task') {
              <app-field
                [label]="t('Title')"
                [placeholder]="t('What needs to be done?')"
                [required]="true"
                [(ngModel)]="taskForm.title"
                name="qa-task-title"
              />
              <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <app-select
                  [label]="t('Priority')"
                  [options]="priorityOptions()"
                  [(ngModel)]="taskForm.priority"
                  name="qa-task-priority"
                />
                <app-select
                  [label]="t('Category')"
                  [placeholder]="t('None')"
                  [options]="taskCategories()"
                  [(ngModel)]="taskForm.category"
                  name="qa-task-category"
                />
              </div>
              <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <app-field
                  [label]="t('Due date')"
                  type="date"
                  [(ngModel)]="taskForm.dueDate"
                  name="qa-task-due"
                />
                <app-field
                  [label]="t('Reminder')"
                  type="datetime-local"
                  [(ngModel)]="taskForm.reminder"
                  name="qa-task-reminder"
                />
              </div>
            }
            @case ('transaction') {
              <app-select
                [label]="t('Type')"
                [options]="transactionTypeOptions()"
                [(ngModel)]="txnForm.type"
                name="qa-txn-type"
              />
              <app-field
                [label]="t('Amount (Rp)')"
                type="number"
                placeholder="0"
                [required]="true"
                [(ngModel)]="txnForm.amount"
                name="qa-txn-amount"
              />
              <app-field
                [label]="t('Description')"
                [placeholder]="t('e.g. Lunch, salary…')"
                [(ngModel)]="txnForm.description"
                name="qa-txn-desc"
              />
              <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <app-select
                  [label]="t('Category')"
                  [placeholder]="t('None')"
                  [options]="txnCategories()"
                  [(ngModel)]="txnForm.category"
                  name="qa-txn-category"
                />
                <app-select
                  [label]="t('Account')"
                  [placeholder]="t('None')"
                  [options]="accountOptions()"
                  [(ngModel)]="txnForm.account"
                  name="qa-txn-account"
                />
              </div>
              <app-field
                [label]="t('Date')"
                type="date"
                [(ngModel)]="txnForm.date"
                name="qa-txn-date"
              />
            }
            @case ('note') {
              <app-field
                [label]="t('Title')"
                [placeholder]="t('Note title')"
                [required]="true"
                [(ngModel)]="noteForm.title"
                name="qa-note-title"
              />
              <div class="space-y-1.5">
                <label class="block text-sm font-bold text-ink">{{ t('Content') }}</label>
                <textarea
                  [(ngModel)]="noteForm.content"
                  name="qa-note-content"
                  rows="5"
                  [placeholder]="t('Write something…')"
                  class="w-full resize-y rounded-field border-2 border-ink bg-surface px-3.5 py-2.5 text-sm font-medium text-ink placeholder:text-ink-faint focus:border-primary focus:shadow-soft focus:outline-none"
                ></textarea>
              </div>
            }
            @case ('goal') {
              <app-field
                [label]="t('Title')"
                [placeholder]="t('e.g. Save for a laptop')"
                [required]="true"
                [(ngModel)]="goalForm.title"
                name="qa-goal-title"
              />
              <div class="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <app-field
                  [label]="t('Target')"
                  type="number"
                  placeholder="0"
                  [(ngModel)]="goalForm.target"
                  name="qa-goal-target"
                />
                <app-field
                  [label]="t('Unit')"
                  [placeholder]="t('Rp / reps / km')"
                  [(ngModel)]="goalForm.unit"
                  name="qa-goal-unit"
                />
                <app-field
                  [label]="t('Deadline')"
                  type="date"
                  [(ngModel)]="goalForm.deadline"
                  name="qa-goal-deadline"
                />
              </div>
            }
            @case ('reminder') {
              <app-field
                [label]="t('Title')"
                [placeholder]="t('e.g. Pay electricity bill')"
                [required]="true"
                [(ngModel)]="reminderForm.title"
                name="qa-reminder-title"
              />
              <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <app-field
                  [label]="t('When')"
                  type="datetime-local"
                  [required]="true"
                  [(ngModel)]="reminderForm.datetime"
                  name="qa-reminder-datetime"
                />
                <app-select
                  [label]="t('Type')"
                  [options]="reminderTypeOptions()"
                  [(ngModel)]="reminderForm.type"
                  name="qa-reminder-type"
                />
              </div>
            }
            @case ('wishlist') {
              <app-field
                [label]="t('Item name')"
                [placeholder]="t('e.g. New headphones')"
                [required]="true"
                [(ngModel)]="wishlistForm.name"
                name="qa-wishlist-name"
              />
              <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <app-field
                  [label]="t('Price (Rp)')"
                  type="number"
                  placeholder="0"
                  [(ngModel)]="wishlistForm.price"
                  name="qa-wishlist-price"
                />
                <app-select
                  [label]="t('Priority')"
                  [options]="priorityOptions()"
                  [(ngModel)]="wishlistForm.priority"
                  name="qa-wishlist-priority"
                />
              </div>
            }
            @case ('need') {
              <app-field
                [label]="t('Item name')"
                [placeholder]="t('e.g. Cooking oil')"
                [required]="true"
                [(ngModel)]="needForm.name"
                name="qa-need-name"
              />
              <div class="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <app-field
                  [label]="t('Quantity')"
                  type="number"
                  placeholder="1"
                  [(ngModel)]="needForm.quantity"
                  name="qa-need-qty"
                />
                <app-field
                  [label]="t('Price (Rp)')"
                  type="number"
                  placeholder="0"
                  [(ngModel)]="needForm.price"
                  name="qa-need-price"
                />
                <app-field
                  [label]="t('Category')"
                  [placeholder]="t('general')"
                  [(ngModel)]="needForm.category"
                  name="qa-need-category"
                />
              </div>
            }
          }

          <div class="flex items-center justify-between gap-2 pt-1">
            <app-button type="button" variant="ghost" icon="arrow-left" (click)="back()">
              {{ t('All types') }}
            </app-button>
            <div class="flex gap-2">
              <app-button type="button" variant="secondary" (click)="close()">{{ t('Cancel') }}</app-button>
              <app-button type="submit" [loading]="saving()">
                {{ t('Create ' + selected()!.label.toLowerCase()) }}
              </app-button>
            </div>
          </div>
        </form>
      }
    </app-modal>
  `,
})
export class QuickAddComponent implements OnInit, OnDestroy {
  private command = inject(CommandService);
  private toast = inject(ToastService);
  private taskService = inject(TaskService);
  private transactionService = inject(TransactionService);
  private noteService = inject(NoteService);
  private goalService = inject(GoalService);
  private reminderService = inject(ReminderService);
  private wishlistService = inject(WishlistService);
  private needService = inject(NeedService);
  private categoryService = inject(CategoryService);
  private accountService = inject(AccountService);
  private i18n = inject(I18nService);

  protected readonly t = this.i18n.t.bind(this.i18n);

  protected readonly entities = ENTITIES;

  protected priorityOptions(): SelectOption[] {
    return PRIORITY_OPTIONS.map((o) => ({ ...o, label: this.t(o.label) }));
  }

  protected reminderTypeOptions(): SelectOption[] {
    return REMINDER_TYPE_OPTIONS.map((o) => ({ ...o, label: this.t(o.label) }));
  }

  protected transactionTypeOptions(): SelectOption[] {
    return [
      { value: 'income', label: this.t('Income') },
      { value: 'expense', label: this.t('Expense') },
    ];
  }

  protected readonly open = this.command.quickAddOpen;
  protected readonly selected = signal<EntityMeta | null>(null);
  protected readonly saving = signal(false);
  protected readonly taskCategories = signal<SelectOption[]>([]);
  protected readonly txnCategories = signal<SelectOption[]>([]);
  protected readonly accountOptions = signal<SelectOption[]>([]);

  protected taskForm: any = {};
  protected txnForm: any = {};
  protected noteForm: any = {};
  protected goalForm: any = {};
  protected reminderForm: any = {};
  protected wishlistForm: any = {};
  protected needForm: any = {};

  private readonly open$ = toObservable(this.command.quickAddOpen);
  private subs: Subscription[] = [];

  ngOnInit(): void {
    this.subs.push(
      this.open$.subscribe((openNow) => {
        if (!openNow) return;
        const preset = this.command.quickAddEntity();
        this.selected.set(preset ? ENTITIES.find((e) => e.key === preset) ?? null : null);
        this.resetForms();
        this.loadMeta();
      })
    );
  }

  ngOnDestroy(): void {
    this.subs.forEach((s) => s.unsubscribe());
  }

  private loadMeta(): void {
    if (this.taskCategories().length === 0 || this.txnCategories().length === 0) {
      this.categoryService.getAll({ type: 'task' }).subscribe((cats: Category[]) => {
        this.taskCategories.set(cats.map((c) => ({ value: c._id, label: c.name })));
      });
      this.categoryService.getAll({ type: 'transaction' }).subscribe((cats: Category[]) => {
        this.txnCategories.set(cats.map((c) => ({ value: c._id, label: c.name })));
      });
    }
    if (this.accountOptions().length === 0) {
      this.accountService.getAll().subscribe((accs: Account[]) => {
        this.accountOptions.set(accs.map((a) => ({ value: a._id, label: a.name })));
      });
    }
  }

  private resetForms(): void {
    this.taskForm = { title: '', priority: 'medium', category: '', dueDate: '', reminder: '' };
    this.txnForm = {
      type: 'expense',
      amount: null,
      description: '',
      category: '',
      account: '',
      date: getTodayLocalDate(),
    };
    this.noteForm = { title: '', content: '' };
    this.goalForm = { title: '', target: null, unit: '', deadline: '' };
    this.reminderForm = { title: '', datetime: '', type: 'custom' };
    this.wishlistForm = { name: '', price: null, priority: 'medium' };
    this.needForm = { name: '', quantity: 1, price: null, category: '' };
    this.saving.set(false);
  }

  protected launch(): void {
    this.command.openQuickAdd();
  }

  protected pick(key: EntityKey): void {
    this.selected.set(ENTITIES.find((e) => e.key === key) ?? null);
  }

  protected back(): void {
    this.selected.set(null);
  }

  protected close(): void {
    this.command.closeQuickAdd();
  }

  protected save(): void {
    const entity = this.selected()?.key;
    if (!entity) return;
    this.saving.set(true);
    const finish = (label: string) => ({
      next: () => {
        this.saving.set(false);
        this.toast.success(label);
        this.command.closeQuickAdd();
        this.refresh(entity);
      },
      error: (err: Error) => {
        this.saving.set(false);
        this.toast.error(err.message);
      },
    });

    switch (entity) {
      case 'task': {
        const title = this.taskForm.title?.trim();
        if (!title) {
          this.saving.set(false);
          this.toast.error(this.t('Task title is required.'));
          return;
        }
        this.taskService
          .create({
            title,
            priority: this.taskForm.priority || 'medium',
            category: this.taskForm.category || null,
            dueDate: this.taskForm.dueDate || null,
            reminder: this.taskForm.reminder ? wibDateTimeToUtcISO(this.taskForm.reminder) : null,
          })
          .subscribe(finish(this.t('Task created')));
        break;
      }
      case 'transaction': {
        const amount = Number(this.txnForm.amount);
        if (!amount || amount <= 0) {
          this.saving.set(false);
          this.toast.error(this.t('Amount must be greater than zero.'));
          return;
        }
        this.transactionService
          .create({
            type: this.txnForm.type,
            amount,
            description: this.txnForm.description || '',
            category: this.txnForm.category || null,
            account: this.txnForm.account || null,
            date: this.txnForm.date || getTodayLocalDate(),
          })
          .subscribe(finish(this.t('Transaction added')));
        break;
      }
      case 'note': {
        const title = this.noteForm.title?.trim();
        if (!title) {
          this.saving.set(false);
          this.toast.error(this.t('Note title is required.'));
          return;
        }
        this.noteService
          .create({ title, content: this.noteForm.content || '' })
          .subscribe(finish(this.t('Note created')));
        break;
      }
      case 'goal': {
        const title = this.goalForm.title?.trim();
        if (!title) {
          this.saving.set(false);
          this.toast.error(this.t('Goal title is required.'));
          return;
        }
        this.goalService
          .create({
            title,
            target: this.goalForm.target ? Number(this.goalForm.target) : null,
            unit: this.goalForm.unit || '',
            deadline: this.goalForm.deadline || null,
            progress: 0,
          })
          .subscribe(finish(this.t('Goal created')));
        break;
      }
      case 'reminder': {
        const title = this.reminderForm.title?.trim();
        if (!title || !this.reminderForm.datetime) {
          this.saving.set(false);
          this.toast.error(this.t('Title and date/time are required.'));
          return;
        }
        this.reminderService
          .create({
            title,
            datetime: wibDateTimeToUtcISO(this.reminderForm.datetime) ?? '',
            type: this.reminderForm.type || 'custom',
          })
          .subscribe(finish(this.t('Reminder created')));
        break;
      }
      case 'wishlist': {
        const name = this.wishlistForm.name?.trim();
        if (!name) {
          this.saving.set(false);
          this.toast.error(this.t('Item name is required.'));
          return;
        }
        this.wishlistService
          .create({
            name,
            price: this.wishlistForm.price ? Number(this.wishlistForm.price) : 0,
            priority: this.wishlistForm.priority || 'medium',
          })
          .subscribe(finish(this.t('Wishlist item added')));
        break;
      }
      case 'need': {
        const name = this.needForm.name?.trim();
        if (!name) {
          this.saving.set(false);
          this.toast.error(this.t('Item name is required.'));
          return;
        }
        this.needService
          .create({
            name,
            quantity: Number(this.needForm.quantity) || 1,
            price: this.needForm.price ? Number(this.needForm.price) : 0,
            category: this.needForm.category || 'general',
          })
          .subscribe(finish(this.t('Need added')));
        break;
      }
    }
  }

  /** Refresh the in-memory data of the touched module without a page reload. */
  private refresh(entity: EntityKey): void {
    switch (entity) {
      case 'task':
        this.taskService.load();
        break;
      case 'transaction':
        this.transactionService.load();
        break;
      case 'note':
        this.noteService.load();
        break;
      case 'goal':
        this.goalService.load();
        break;
      case 'reminder':
        this.reminderService.load();
        break;
      case 'wishlist':
        this.wishlistService.load();
        break;
      case 'need':
        this.needService.load();
        break;
    }
  }
}
