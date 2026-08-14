import { Component, inject } from '@angular/core';
import { PageHeaderComponent } from '../../layout/components/page-header.component';
import { CardComponent } from '../../layout/components/card.component';
import { ButtonComponent } from '../../layout/components/button.component';
import { IconComponent } from '../../layout/components/icon.component';
import { OnboardingService } from '../../core/services/onboarding.service';
import { I18nService } from '../../core/services/i18n.service';

interface HelpSection {
  id: string;
  title: string;
  icon: string;
  items: { title: string; lines: string[] }[];
}

const SECTIONS: HelpSection[] = [
  {
    id: 'getting-started',
    title: 'Getting Started',
    icon: 'sparkles',
    items: [
      {
        title: 'What is LifeHub?',
        lines: [
          'LifeHub is your personal dashboard that combines productivity, finances, and habits in one place. Organize your day, track income & savings, build habits, and chase goals — without switching between apps.',
          'It is split into three areas: Today & Dashboard (daily and overall summaries), Manage (Tasks, Finance, Wishlist, Needs, Calendar), and Grow (Goals, Habits, Notes, Pomodoro, Statistics, Weekly Review).',
        ],
      },
      {
        title: 'First setup',
        lines: [
          'Create an account on the Register page with your name, email, and a password of at least 6 characters. Your account starts with default categories for tasks and transactions, so you can start tracking right away.',
          'After signing in, set your theme and notification preferences in Settings, then add a first account in Finance so your balance is tracked.',
        ],
      },
      {
        title: 'Today',
        lines: [
          'Your landing page. It shows a greeting for the time of day, today\u2019s progress (tasks done, habits completed, net money), today\u2019s focus tasks, today\u2019s money, active goals, daily habits, and upcoming reminders & tasks.',
          'The Task / Transaction / Note buttons open Quick Add, and the Focus button opens Pomodoro.',
        ],
      },
      {
        title: 'Dashboard',
        lines: [
          'A complete overview: task summary, finance summary, today\u2019s tasks, upcoming deadlines, habits with streaks, income vs expense chart, monthly budget progress, goals, wishlist, and recent transactions.',
          'Use Customize to reorder widgets (drag & drop or up/down buttons) and show or hide each one with the eye button. Save layout persists your choice; Reset restores the default.',
        ],
      },
      {
        title: 'Navigation & shortcuts',
        lines: [
          'The sidebar groups pages into Today & Dashboard, Manage, and Grow, with Settings & Profile at the bottom. On small screens it becomes a drawer opened from the menu icon; press Esc to close it.',
          'The topbar gives you global search, the Add button, theme toggle, notifications, and your account menu.',
          'Shortcuts: Ctrl/Cmd + K or / opens global search · N opens Quick Add (task) · D goes to Dashboard · T goes to Tasks · G goes to Goals. Shortcuts are inactive while typing in a field.',
        ],
      },
    ],
  },
  {
    id: 'manage',
    title: 'Manage',
    icon: 'list-todo',
    items: [
      {
        title: 'Tasks',
        lines: [
          'Add a task with a title (required), description, category, due date, reminder, repeat rule, and tags. Choose Daily / Weekly / Monthly / Yearly to repeat; weekly lets you pick days (Su–Sa).',
          'Filter by status (All / To do / Done), lifecycle (Active / Archived / Trash), category, tag, or free text search. Pin important tasks to the top; archive to hide, trash to delete later (permanent deletion needs confirmation).',
          'The circle on the left marks a task done. Overdue tasks show red with an "overdue" label.',
        ],
      },
      {
        title: 'Finance',
        lines: [
          'One page for accounts, transactions, budgets, and charts. Add accounts as Cash, Bank, or E-wallet — bank/e-wallet logos are detected automatically from the name (BCA, Mandiri, DANA, GoPay, SeaBank, and more).',
          'Add income, expense, or transfer transactions. Transfers move money between two different accounts; expenses need a category and affect your budget progress.',
          'Budgets are set per category (or Overall) per month with a spending limit — use the ‹ › arrows to switch months. The donut chart shows spending by category for the current month.',
        ],
      },
      {
        title: 'Wishlist',
        lines: [
          'A grid of things you are saving for. Add a name and price (required), plus saved-so-far, priority, target date, link, and tags.',
          'Update "Saved so far" over time; the progress bar shows saved ÷ price. Mark items as Purchased when you buy them.',
        ],
      },
      {
        title: 'Needs',
        lines: [
          'Household shopping and supplies with quantity, unit, price, and purchase history. Add an item with a name (required), quantity, unit (kg/pcs/liter), price, and an optional "Add to shopping list" toggle.',
          'Tick the circle to mark it purchased — the row shows the total (price × quantity) and purchase history ("Purchased N× · last <date>").',
        ],
      },
      {
        title: 'Calendar & Reminders',
        lines: [
          'A combined calendar for tasks, goals, habits, and reminders in the Asia/Jakarta timezone. Switch between Month / Week / Day / Agenda views.',
          'Click a date to see that day\u2019s items below and add a reminder from there. Create reminders with a title, date & time, type (Custom/Task/Bill/Shopping/Goal/Wishlist), and repeat rule.',
        ],
      },
    ],
  },
  {
    id: 'grow',
    title: 'Grow',
    icon: 'flame',
    items: [
      {
        title: 'Goals',
        lines: [
          'Track targets with progress bars. Create a General goal or a Savings goal with a target amount in Rp, unit, progress, deadline, and tags.',
          'Savings goals show a special panel with the remaining amount and how much you need per month to hit the deadline on time. Complete marks the goal done (progress = target).',
        ],
      },
      {
        title: 'Habits',
        lines: [
          'Build habits with streaks and a 7-day check strip. Set a name (required), description, and frequency (Daily / Weekly / Monthly).',
          'Mark done today to keep the streak alive — only today can be changed; the previous 6 days are history. Cards show a flame when done today, the frequency, and the streak.',
        ],
      },
      {
        title: 'Notes',
        lines: [
          'A masonry wall (1/2/3 columns) with search and pinning. Give a note a title (optional; empty becomes "Untitled"), content, and comma-separated tags.',
          'Click a card to edit; hover to reveal edit, pin, archive, and delete actions. Pinned notes float to the top with the primary background.',
        ],
      },
      {
        title: 'Pomodoro',
        lines: [
          'A focus timer with three modes: Focus 25:00, Short break 5:00, Long break 15:00. Start to run, Pause to hold, Reset to restart.',
          'After a focus session it switches to a short break automatically; after 4 sessions you get a long break. The session counter resets when the page reloads.',
        ],
      },
      {
        title: 'Statistics',
        lines: [
          'Productivity & finance analytics for a chosen range: 7 days / 30 days / This month / Last month / This year / All time.',
          'See total & completed tasks, weekly activity, cash flow, spending by category, financial insights (weekend vs weekday spending, savings rate, top category, budget compliance, cash flow trends), and a financial summary.',
        ],
      },
      {
        title: 'Weekly Review',
        lines: [
          'A weekly summary of productivity (completed, created, overdue, completion %), habits (best streak, average completion), finance (income, expense, saved, top category), and goals progressed or completed.',
          'Write a short reflection in "What went well?" and "What should you improve next week?" and save it — it is stored per week and reloaded when you open the review again. It stays private to you.',
        ],
      },
    ],
  },
  {
    id: 'account',
    title: 'Account',
    icon: 'user-round',
    items: [
      {
        title: 'Settings',
        lines: [
          'Appearance: dark mode toggle, theme (Light / Dark / System), and language (more languages coming soon).',
          'Export data: Transactions CSV, Tasks CSV, or a full JSON export of your LifeHub data — no passwords or secrets.',
          'Notifications: task reminders, bill reminders, habit reminders, and email updates. Save changes when you are done.',
        ],
      },
      {
        title: 'Profile',
        lines: [
          'Avatar: click the camera icon, choose an image (JPG/PNG/WebP/GIF, max 3MB), preview, and save. If you already have an avatar you can remove it.',
          'Personal information: full name (required) and email (read-only).',
          'Change password with your current password and a new one of at least 6 characters. "Member since" shows your registration date.',
        ],
      },
    ],
  },
  {
    id: 'data',
    title: 'Data',
    icon: 'archive',
    items: [
      {
        title: 'Archive vs Trash',
        lines: [
          'Archiving hides an item without deleting it. Trash stores items before they are permanently deleted. Both can be restored.',
          'In Trash, deleting again removes the item permanently and asks for confirmation.',
        ],
      },
      {
        title: 'Recurring tasks & transactions',
        lines: [
          'Recurring tasks and transactions are recreated automatically according to their frequency and show a "repeat" badge in lists.',
        ],
      },
      {
        title: 'Export data',
        lines: [
          'From Settings you can download transactions as CSV, tasks as CSV, or your whole LifeHub data as JSON. Exports never include your password or secrets.',
        ],
      },
      {
        title: 'Timezone',
        lines: [
          'LifeHub runs on the Asia/Jakarta (WIB, UTC+7) timezone for dates, reminders, and statistics.',
        ],
      },
    ],
  },
];

interface RoutineStep {
  icon: string;
  when: string;
  title: string;
  description: string;
  color: string;
}

const ROUTINE: RoutineStep[] = [
  {
    icon: 'sun',
    when: 'Morning',
    title: 'Check Today',
    description: 'Open Today to see your tasks, habits, goals, and net money for the day.',
    color: 'bg-warning',
  },
  {
    icon: 'list-todo',
    when: 'During the day',
    title: 'Complete tasks & record money',
    description: 'Tick off tasks as you finish them, add transactions when you spend or earn, and use Pomodoro to focus.',
    color: 'bg-success',
  },
  {
    icon: 'refresh-cw',
    when: 'End of week',
    title: 'Weekly Review',
    description: 'Reflect on what went well and what to improve next week.',
    color: 'bg-secondary',
  },
  {
    icon: 'bar-chart-3',
    when: 'End of month',
    title: 'Statistics',
    description: 'Look at the big picture — productivity, cash flow, and spending trends.',
    color: 'bg-primary',
  },
];

const SHORTCUTS = [
  { keys: 'Ctrl K', action: 'Global search' },
  { keys: '/', action: 'Global search' },
  { keys: 'N', action: 'New task (quick add)' },
  { keys: 'D', action: 'Go to dashboard' },
  { keys: 'T', action: 'Go to tasks' },
  { keys: 'G', action: 'Go to goals' },
];

@Component({
  selector: 'app-help',
  standalone: true,
  imports: [PageHeaderComponent, CardComponent, ButtonComponent, IconComponent],
  template: `
    <app-page-header
      [title]="t('Help & Guide')"
      [subtitle]="t('Everything you need to get the most out of LifeHub.')"
      actionLabel=""
      [action]="noop"
    ></app-page-header>

    <div class="space-y-6">

    <!-- Replay the tour -->
    <app-card>
      <div class="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div class="min-w-0">
          <h2 class="flex items-center gap-2 text-base font-bold text-ink">
            <app-icon name="play" [size]="18" /> {{ t('Take a Tour Again') }}
          </h2>
          <p class="mt-1 text-sm text-ink-soft">
            {{ t('Replay the short interactive tour that walks you through the core screens of LifeHub. Your data is never touched.') }}
          </p>
        </div>
        <app-button icon="play" (click)="replay()" class="shrink-0">{{ t('Start Tour') }}</app-button>
      </div>
    </app-card>

    <!-- Guide sections -->
    @for (section of sections; track section.id) {
      <app-card>
        <h2 class="flex items-center gap-2 text-base font-bold text-ink">
          <app-icon [name]="section.icon" [size]="18" /> {{ t(section.title) }}
        </h2>
        <div class="mt-2 divide-y-2 divide-ink/10">
          @for (item of section.items; track item.title) {
            <details class="group">
              <summary
                class="flex cursor-pointer list-none items-center justify-between gap-3 py-3 text-sm font-semibold text-ink [&::-webkit-details-marker]:hidden"
              >
                {{ t(item.title) }}
                <span
                  class="flex h-6 w-6 shrink-0 items-center justify-center rounded-md border-2 border-ink bg-surface-2 text-ink-soft transition-transform duration-150 group-open:rotate-180"
                >
                  <app-icon name="chevron-down" [size]="13" [strokeWidth]="2.6" />
                </span>
              </summary>
              <div class="pb-4">
                @for (line of item.lines; track line) {
                  <p class="mb-1.5 text-sm leading-relaxed text-ink-soft">{{ t(line) }}</p>
                }
              </div>
            </details>
          }
        </div>
      </app-card>
    }

    <!-- Recommended daily routine -->
    <app-card>
      <h2 class="flex items-center gap-2 text-base font-bold text-ink">
        <app-icon name="calendar-check" [size]="18" /> {{ t('Recommended LifeHub Routine') }}
      </h2>
      <p class="mt-1 text-sm text-ink-soft">
        {{ t('A simple rhythm to keep everything in sync.') }}
      </p>
      <div class="mt-5 space-y-4">
        @for (step of routine; track step.title) {
          <div class="flex items-start gap-4">
            <div class="flex flex-col items-center">
              <span
                class="flex h-11 w-11 shrink-0 items-center justify-center rounded-[12px] border-2 border-ink text-ink shadow-[2px_2px_0_0_var(--color-ink)]"
                [class]="step.color"
              >
                <app-icon [name]="step.icon" [size]="19" />
              </span>
              @if (!$last) {
                <span class="mt-1 w-0.5 flex-1 bg-ink/20"></span>
              }
            </div>
            <div class="min-w-0 pb-1 pt-0.5">
              <p class="text-[11px] font-bold uppercase tracking-widest text-ink-faint">
                {{ t(step.when) }}
              </p>
              <p class="text-sm font-bold text-ink">{{ t(step.title) }}</p>
              <p class="mt-0.5 text-sm text-ink-soft">{{ t(step.description) }}</p>
            </div>
          </div>
        }
      </div>
    </app-card>

    <!-- Keyboard shortcuts reference -->
    <app-card>
      <h2 class="flex items-center gap-2 text-base font-bold text-ink">
        <app-icon name="key-round" [size]="18" /> {{ t('Keyboard shortcuts') }}
      </h2>
      <div class="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2">
        @for (sc of shortcuts; track sc.keys) {
          <div class="flex items-center justify-between rounded-button border-2 border-ink bg-surface-2 px-3 py-2">
            <span class="text-sm font-medium text-ink">{{ t(sc.action) }}</span>
            <kbd
              class="rounded-md border-2 border-ink bg-surface px-2 py-0.5 font-display text-[11px] text-ink"
            >
              {{ sc.keys }}
            </kbd>
          </div>
        }
      </div>
    </app-card>

    </div>
  `,
})
export class HelpComponent {
  private onboarding = inject(OnboardingService);
  private i18n = inject(I18nService);

  protected readonly t = this.i18n.t.bind(this.i18n);

  protected readonly sections = SECTIONS;
  protected readonly routine = ROUTINE;
  protected readonly shortcuts = SHORTCUTS;

  protected readonly noop = (): void => {};

  protected replay(): void {
    this.onboarding.startTour();
  }
}
