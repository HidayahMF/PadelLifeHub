import { Component, inject, OnInit } from '@angular/core';
import { RouterLink } from '@angular/router';
import { IconComponent } from '../../../layout/components/icon.component';
import { SeoService } from '../../../core/services/seo.service';
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
    label: 'Productivity',
    description: 'Plan your time, protect your focus, and get things done.',
    items: [
      {
        icon: 'list-todo',
        title: 'Tasks',
        description: 'Priorities, deadlines, reminders, recurring tasks, categories, and tags — with archive and trash.',
      },
      {
        icon: 'flame',
        title: 'Habits',
        description: 'Daily habit tracking with streaks, best streaks, and completion history.',
      },
      {
        icon: 'target',
        title: 'Goals',
        description: 'Set targets with deadlines, track progress, and see how much is left.',
      },
      {
        icon: 'calendar-days',
        title: 'Calendar',
        description: 'Tasks, reminders, and plans on one calendar — with a Today view that pulls it together.',
      },
      {
        icon: 'timer',
        title: 'Pomodoro',
        description: 'Timed focus sessions with work/break cycles to protect deep work.',
      },
    ],
  },
  {
    label: 'Finance',
    description: 'See the full picture of your money without the spreadsheet.',
    items: [
      {
        icon: 'wallet',
        title: 'Accounts',
        description: 'Cash, bank accounts, and e-wallets — with balances and transfers between them.',
      },
      {
        icon: 'receipt',
        title: 'Transactions',
        description: 'Income and expenses with categories, notes, and repeat schedules.',
      },
      {
        icon: 'piggy-bank',
        title: 'Budgets',
        description: 'Monthly spending limits per category with progress tracking.',
      },
      {
        icon: 'bar-chart-3',
        title: 'Statistics',
        description: 'Income vs expense trends, spending breakdowns, and monthly summaries.',
      },
      {
        icon: 'sparkles',
        title: 'Insights',
        description: 'Smart summaries of where your money went and how it changed.',
      },
    ],
  },
  {
    label: 'Personal',
    description: 'Capture, plan, and reflect on the rest of your life.',
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
        icon: 'refresh-cw',
        title: 'Weekly Review',
        description: 'A guided recap of your week — tasks, habits, and money at a glance.',
      },
    ],
  },
  {
    label: 'Intelligence',
    description: 'The layer that connects everything you track.',
    items: [
      {
        icon: 'bot',
        title: 'LifeHub AI',
        description: 'Ask questions about your own data and get practical, personalized advice.',
      },
      {
        icon: 'search',
        title: 'Global Search',
        description: 'One search across tasks, notes, transactions, goals, habits, and more (Ctrl/Cmd + K).',
      },
      {
        icon: 'gauge',
        title: 'Dashboard',
        description: 'Customizable widgets showing your task, finance, habit, and goal summary.',
      },
      {
        icon: 'bell',
        title: 'Notifications',
        description: 'Reminders, deadlines, and recurring items surface in a notification center.',
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
            <p class="inline-flex items-center gap-2 rounded-button border-2 border-ink bg-primary px-3 py-1.5 text-xs font-bold uppercase tracking-widest text-ink shadow-soft">
              <app-icon name="layout-dashboard" [size]="14" />
              Features
            </p>
            <h1 class="mt-5 font-display text-4xl text-ink sm:text-5xl">
              Everything LifeHub does.
            </h1>
            <p class="mx-auto mt-4 max-w-2xl text-base font-medium text-ink-soft">
              One app for your productivity, personal finance, habits, goals, notes, and planning —
              plus an AI assistant that understands it all.
            </p>
            <div class="mt-8 flex flex-wrap items-center justify-center gap-3">
              <a
                routerLink="/register"
                class="inline-flex items-center gap-2 rounded-button border-2 border-ink bg-primary px-6 py-3 text-sm font-bold text-ink shadow-soft transition-all duration-150 hover:-translate-y-[1px] hover:bg-primary-strong active:translate-x-[2px] active:translate-y-[2px] active:shadow-none"
              >
                Get Started
                <app-icon name="arrow-right" [size]="16" />
              </a>
              <a
                routerLink="/ai"
                class="inline-flex items-center gap-2 rounded-button border-2 border-ink bg-surface px-6 py-3 text-sm font-bold text-ink shadow-soft transition-all duration-150 hover:-translate-y-[1px] hover:bg-surface-2 active:translate-x-[2px] active:translate-y-[2px] active:shadow-none"
              >
                <app-icon name="bot" [size]="16" />
                Meet LifeHub AI
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
                  <h2 class="font-display text-2xl text-ink sm:text-3xl">{{ group.label }}</h2>
                  <span class="hidden h-1 flex-1 border-b-2 border-dashed border-ink/30 sm:block"></span>
                </div>
                <p class="mt-2 max-w-xl text-sm font-medium text-ink-soft">{{ group.description }}</p>

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
                      <h3 class="mt-3 font-display text-base text-ink">{{ item.title }}</h3>
                      <p class="mt-1.5 text-sm font-medium leading-relaxed text-ink-soft">
                        {{ item.description }}
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
            <h2 class="font-display text-3xl text-ink">Ready to see it in action?</h2>
            <p class="mx-auto mt-3 max-w-lg text-base font-medium text-ink">
              Create your account — everything above is one sign-up away.
            </p>
            <a
              routerLink="/register"
              class="mt-7 inline-flex items-center gap-2 rounded-button border-2 border-ink bg-surface px-6 py-3 text-base font-bold text-ink shadow-soft transition-all duration-150 hover:-translate-y-[1px] hover:bg-surface-2 active:translate-x-[2px] active:translate-y-[2px] active:shadow-none"
            >
              Get Started
              <app-icon name="arrow-right" [size]="17" />
            </a>
          </div>
        </section>
      </main>

      <app-public-footer />
    </div>
  `,
})
export class FeaturesComponent implements OnInit {
  private seo = inject(SeoService);

  protected readonly GROUPS = GROUPS;

  ngOnInit(): void {
    this.seo.setPage({
      title: 'Features — LifeHub',
      description:
        'Explore LifeHub features: tasks, personal finance, budgets, habits, goals, calendar, notes, wishlist, Pomodoro, statistics, and an AI productivity assistant — all in one app.',
      path: '/features',
    });
  }
}
