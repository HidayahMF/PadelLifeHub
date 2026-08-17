import { Component, effect, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { IconComponent } from '../../../layout/components/icon.component';
import { SeoService } from '../../../core/services/seo.service';
import { I18nService } from '../../../core/services/i18n.service';
import { PublicNavbarComponent } from '../shared/public-navbar.component';
import { PublicFooterComponent } from '../shared/public-footer.component';

interface FeatureItem {
  icon: string;
  title: string;
  description: string;
}

interface FeatureGroup {
  label: string;
  description: string;
  items: FeatureItem[];
}

const GROUPS: FeatureGroup[] = [
  {
    label: 'Finance',
    description: 'The full picture of your money — accounts, net worth, budgets, and financial health.',
    items: [
      {
        icon: 'wallet',
        title: 'Accounts',
        description:
          'Cash, bank, e-wallet, and investment accounts — with balances, account types, and per-account transaction history.',
      },
      {
        icon: 'receipt',
        title: 'Income & Expenses',
        description: 'Record income and expenses with categories, notes, and recurring schedules.',
      },
      {
        icon: 'repeat',
        title: 'Transfers',
        description: 'Move money between accounts — transfers never count as income or expense.',
      },
      {
        icon: 'piggy-bank',
        title: 'Budgets',
        description: 'Monthly spending limits per category with live progress and over-budget warnings.',
      },
      {
        icon: 'banknote',
        title: 'Net Worth',
        description:
          'Total net worth across liquid assets (cash, bank, e-wallets) and investment assets.',
      },
      {
        icon: 'gauge',
        title: 'Financial Health',
        description:
          'A transparent, explainable 0–100 score based on cash flow, savings, budget, liquidity, and consistency.',
      },
      {
        icon: 'bar-chart-3',
        title: 'Statistics',
        description: 'Income vs expense trends, spending by category and account, and monthly summaries.',
      },
    ],
  },
  {
    label: 'AI',
    description: 'Understand your life through your own data.',
    items: [
      {
        icon: 'bot',
        title: 'AI Chat',
        description: 'Ask questions about your own data and get practical, personalized answers.',
      },
      {
        icon: 'trending-up',
        title: 'Financial Insights',
        description:
          'LifeHub AI analyzes your recorded income, expenses, budgets, accounts, investments, and spending patterns.',
      },
      {
        icon: 'target',
        title: 'Habit & Goal Insights',
        description: 'See which habits are sticking, which goals are at risk, and what to adjust.',
      },
      {
        icon: 'sparkles',
        title: 'AI Monthly Summary',
        description:
          'A generated recap of what went well, what needs attention, and next month’s priorities.',
      },
      {
        icon: 'zap',
        title: 'Quick Add',
        description:
          'Log transactions in plain language — “jajan 15k bca” becomes an expense on the right account.',
      },
    ],
  },
  {
    label: 'Productivity',
    description: 'Plan your time, protect your focus, and get things done.',
    items: [
      {
        icon: 'list-todo',
        title: 'Tasks',
        description:
          'Priorities, deadlines, reminders, recurring tasks, categories, and tags — with archive and trash.',
      },
      {
        icon: 'calendar-days',
        title: 'Calendar',
        description:
          'Tasks, reminders, and plans on one calendar — with a Today view that pulls it together.',
      },
      {
        icon: 'bell',
        title: 'Reminders',
        description: 'Task and calendar reminders surface in a notification center that never duplicates.',
      },
      {
        icon: 'timer',
        title: 'Pomodoro',
        description: 'Timed focus sessions with work/break cycles to protect deep work.',
      },
      {
        icon: 'clock',
        title: 'Focus Sessions',
        description: 'Completed focus time is saved and feeds your statistics, reviews, and AI context.',
      },
    ],
  },
  {
    label: 'Goals & Habits',
    description: 'Build the life you’re working toward.',
    items: [
      {
        icon: 'target',
        title: 'Goals',
        description: 'Set targets with deadlines, track progress, and see how much is left.',
      },
      {
        icon: 'piggy-bank',
        title: 'Savings Goals',
        description:
          'Savings goals connect to your accounts and show the monthly contribution your deadline requires.',
      },
      {
        icon: 'flame',
        title: 'Habits',
        description: 'Daily habit tracking with streaks, best streaks, and completion history.',
      },
    ],
  },
  {
    label: 'Reviews',
    description: 'Understand how you’re doing — weekly and monthly.',
    items: [
      {
        icon: 'refresh-cw',
        title: 'Weekly Review',
        description: 'A guided recap of your week — tasks, habits, finance, and focus at a glance.',
      },
      {
        icon: 'calendar-range',
        title: 'Monthly Review',
        description:
          'Understand how your month went across finances, productivity, habits, goals, and focus — with an AI-generated summary.',
      },
    ],
  },
  {
    label: 'Personal & Extras',
    description: 'Capture, organize, and find everything else.',
    items: [
      {
        icon: 'sticky-note',
        title: 'Notes',
        description: 'Quick capture and full notes, searchable from anywhere in LifeHub.',
      },
      {
        icon: 'gift',
        title: 'Wishlist',
        description: 'Save what you want and track savings progress toward each item.',
      },
      {
        icon: 'shopping-basket',
        title: 'Needs',
        description: 'Keep track of things you need with quantities and prices.',
      },
      {
        icon: 'search',
        title: 'Global Search',
        description:
          'One search across tasks, notes, transactions, goals, habits, and more (Ctrl/Cmd + K).',
      },
      {
        icon: 'bell',
        title: 'Notifications',
        description: 'Reminders, deadlines, and recurring items in one notification center.',
      },
      {
        icon: 'layout-dashboard',
        title: 'Dashboard',
        description: 'Customizable widgets showing your task, finance, habit, and goal summary.',
      },
    ],
  },
];

@Component({
  selector: 'app-features',
  standalone: true,
  imports: [RouterLink, IconComponent, PublicNavbarComponent, PublicFooterComponent],
  template: `
    <div class="min-h-dvh bg-bg">
      <app-public-navbar />

      <main>
        <!-- Page hero -->
        <section class="relative overflow-hidden border-b-2 border-ink bg-surface">
          <div class="neo-dots pointer-events-none absolute inset-0 opacity-25"></div>
          <div class="relative mx-auto max-w-6xl px-4 py-14 text-center lg:px-6 lg:py-20">
            <p
              class="inline-flex items-center gap-2 rounded-button border-2 border-ink bg-primary px-3 py-1.5 text-xs font-bold uppercase tracking-widest text-ink shadow-soft"
            >
              <app-icon name="layout-dashboard" [size]="14" />
              {{ t('Features') }}
            </p>
            <h1 class="mt-5 font-display text-4xl text-ink sm:text-5xl">
              {{ t('Everything LifeHub does.') }}
            </h1>
            <p class="mx-auto mt-4 max-w-2xl text-base font-medium text-ink-soft">
              {{ t('One app for your productivity, personal finance, habits, goals, notes, planning, and weekly & monthly reviews — plus an AI assistant that understands it all.') }}
            </p>
            <div class="mt-8 flex flex-wrap items-center justify-center gap-3">
              <a
                routerLink="/register"
                class="inline-flex items-center gap-2 rounded-button border-2 border-ink bg-primary px-6 py-3 text-sm font-bold text-ink shadow-soft transition-all duration-150 hover:-translate-y-[1px] hover:bg-primary-strong active:translate-x-[2px] active:translate-y-[2px] active:shadow-none"
              >
                {{ t('Get Started') }}
                <app-icon name="arrow-right" [size]="16" />
              </a>
              <a
                routerLink="/ai"
                class="inline-flex items-center gap-2 rounded-button border-2 border-ink bg-surface px-6 py-3 text-sm font-bold text-ink shadow-soft transition-all duration-150 hover:-translate-y-[1px] hover:bg-surface-2 active:translate-x-[2px] active:translate-y-[2px] active:shadow-none"
              >
                <app-icon name="bot" [size]="16" />
                {{ t('Meet LifeHub AI') }}
              </a>
            </div>
          </div>
        </section>

        <!-- Feature groups -->
        <section class="mx-auto max-w-6xl px-4 py-14 lg:px-6 lg:py-16">
          <div class="space-y-14">
            @for (group of GROUPS; track group.label) {
              <div>
                <div class="flex items-center gap-4">
                  <h2 class="font-display text-2xl text-ink sm:text-3xl">{{ t(group.label) }}</h2>
                  <span class="hidden h-1 flex-1 border-b-2 border-dashed border-ink/30 sm:block"></span>
                </div>
                <p class="mt-2 max-w-xl text-sm font-medium text-ink-soft">
                  {{ t(group.description) }}
                </p>

                <div class="mt-6 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
                  @for (item of group.items; track item.title) {
                    <article
                      class="group rounded-card border-2 border-ink bg-surface p-5 shadow-soft transition-all duration-200 hover:-translate-y-1 hover:shadow-card"
                    >
                      <span
                        class="flex h-10 w-10 items-center justify-center rounded-[10px] border-2 border-ink bg-primary text-ink shadow-soft transition-transform duration-200 group-hover:-rotate-6"
                      >
                        <app-icon [name]="item.icon" [size]="18" />
                      </span>
                      <h3 class="mt-3 font-display text-base text-ink">{{ t(item.title) }}</h3>
                      <p class="mt-1.5 text-sm font-medium leading-relaxed text-ink-soft">
                        {{ t(item.description) }}
                      </p>
                    </article>
                  }
                </div>
              </div>
            }
          </div>
        </section>

        <!-- CTA -->
        <section class="border-t-2 border-ink bg-primary">
          <div class="mx-auto max-w-3xl px-4 py-14 text-center lg:px-6">
            <h2 class="font-display text-3xl text-ink">{{ t('Ready to see it in action?') }}</h2>
            <p class="mx-auto mt-3 max-w-lg text-base font-medium text-ink">
              {{ t('Create your account — everything above is one sign-up away.') }}
            </p>
            <a
              routerLink="/register"
              class="mt-7 inline-flex items-center gap-2 rounded-button border-2 border-ink bg-surface px-6 py-3 text-base font-bold text-ink shadow-soft transition-all duration-150 hover:-translate-y-[1px] hover:bg-surface-2 active:translate-x-[2px] active:translate-y-[2px] active:shadow-none"
            >
              {{ t('Get Started') }}
              <app-icon name="arrow-right" [size]="17" />
            </a>
          </div>
        </section>
      </main>

      <app-public-footer />
    </div>
  `,
})
export class FeaturesComponent {
  private seo = inject(SeoService);
  private i18n = inject(I18nService);

  protected readonly t = this.i18n.t.bind(this.i18n);
  protected readonly GROUPS = GROUPS;

  constructor() {
    effect(() => {
      this.i18n.lang();
      this.seo.setPage({
        title: this.i18n.t('Features — LifeHub'),
        description: this.i18n.t(
          'Explore LifeHub features: tasks, personal finance, budgets, habits, goals, calendar, notes, wishlist, Pomodoro, statistics, and an AI productivity assistant — all in one app.'
        ),
        path: '/features',
      });
    });
  }
}
