import {
  AfterViewInit,
  Component,
  effect,
  ElementRef,
  inject,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { IconComponent } from '../../../layout/components/icon.component';
import { AuthService } from '../../../core/services/auth.service';
import { SeoService } from '../../../core/services/seo.service';
import { I18nService } from '../../../core/services/i18n.service';
import { PublicNavbarComponent } from '../shared/public-navbar.component';
import { PublicFooterComponent } from '../shared/public-footer.component';

interface ValueCard {
  icon: string;
  title: string;
  description: string;
  tone: string;
}

interface EcosystemItem {
  icon: string;
  title: string;
  description: string;
}

interface Step {
  step: string;
  title: string;
  text: string;
}

const VALUE_CARDS: ValueCard[] = [
  {
    icon: 'wallet',
    title: 'Finance',
    description:
      'Know where your money goes. Track income, expenses, accounts, budgets, transfers, net worth, liquid assets, and investments.',
    tone: 'bg-success/10 text-success',
  },
  {
    icon: 'list-todo',
    title: 'Tasks',
    description:
      'Turn plans into action. Manage tasks, priorities, due dates, reminders, and completion.',
    tone: 'bg-primary/20 text-ink',
  },
  {
    icon: 'target',
    title: 'Goals',
    description:
      'Turn goals into measurable progress. Track targets, progress, savings goals, and required monthly contributions.',
    tone: 'bg-warning/10 text-warning',
  },
  {
    icon: 'flame',
    title: 'Habits',
    description: 'Build consistency. Track habits, streaks, and long-term progress.',
    tone: 'bg-secondary/10 text-secondary',
  },
  {
    icon: 'timer',
    title: 'Focus',
    description:
      'Make your time count. Use Pomodoro and track focus sessions and productivity statistics.',
    tone: 'bg-danger/10 text-danger',
  },
  {
    icon: 'calendar-range',
    title: 'Reviews',
    description:
      'Understand how you’re doing. Weekly and Monthly Reviews connect finance, productivity, habits, goals, and focus.',
    tone: 'bg-primary/20 text-ink',
  },
  {
    icon: 'bot',
    title: 'AI',
    description:
      'Understand your life through your data. LifeHub AI analyzes your recorded data and provides facts, insights, and recommendations.',
    tone: 'bg-accent text-white',
  },
];

const ECOSYSTEM: EcosystemItem[] = [
  { icon: 'wallet', title: 'Finance', description: 'Accounts, transactions, transfers, budgets, net worth.' },
  { icon: 'list-todo', title: 'Tasks', description: 'Priorities, deadlines, reminders, and recurring work.' },
  { icon: 'calendar-days', title: 'Calendar', description: 'Tasks, reminders, and events in one view.' },
  { icon: 'target', title: 'Goals', description: 'Targets, progress, and savings plans.' },
  { icon: 'flame', title: 'Habits', description: 'Streaks and consistency tracking.' },
  { icon: 'timer', title: 'Pomodoro', description: 'Focus sessions with work and break cycles.' },
  { icon: 'gift', title: 'Wishlist', description: 'Save what you want and track progress toward it.' },
  { icon: 'shopping-basket', title: 'Needs', description: 'Track what you need, with quantities and prices.' },
  { icon: 'sticky-note', title: 'Notes', description: 'Capture thoughts, searchable anywhere.' },
  { icon: 'bar-chart-3', title: 'Statistics', description: 'Trends, breakdowns, and monthly summaries.' },
  { icon: 'refresh-cw', title: 'Weekly Review', description: 'A guided recap of your week.' },
  { icon: 'calendar-range', title: 'Monthly Review', description: 'Understand your month — with an AI summary.' },
  { icon: 'bot', title: 'LifeHub AI', description: 'Facts, insights, and recommendations from your data.' },
  { icon: 'bell', title: 'Notifications', description: 'Reminders and warnings in one notification center.' },
  { icon: 'search', title: 'Global Search', description: 'One search across everything — Ctrl/Cmd + K.' },
  { icon: 'settings', title: 'Settings', description: 'Profile, appearance, security, and data export.' },
];

const STEPS: Step[] = [
  { step: '01', title: 'Organize', text: 'Add your accounts, tasks, goals, habits, and plans.' },
  { step: '02', title: 'Track', text: 'LifeHub records your activity and progress as you go.' },
  { step: '03', title: 'Understand', text: 'Statistics, weekly & monthly reviews, and AI turn your data into insights.' },
  { step: '04', title: 'Improve', text: 'Use those insights to make better decisions every day.' },
];

const PRODUCTIVITY_FLOW = [
  { icon: 'list-todo', title: 'Tasks', text: 'Plan what matters' },
  { icon: 'timer', title: 'Focus', text: 'Protect deep work' },
  { icon: 'flame', title: 'Habits', text: 'Stay consistent' },
  { icon: 'bar-chart-3', title: 'Statistics', text: 'See the trends' },
  { icon: 'refresh-cw', title: 'Review', text: 'Reflect weekly' },
];

@Component({
  selector: 'app-landing',
  standalone: true,
  imports: [RouterLink, IconComponent, PublicNavbarComponent, PublicFooterComponent],
  template: `
    <div class="min-h-dvh overflow-x-clip bg-bg">
      <app-public-navbar />

      <main>
        <!-- ══════════════════ HERO ══════════════════ -->
        <section class="relative overflow-hidden">
          <div aria-hidden="true" class="landing-glow pointer-events-none absolute inset-0"></div>
          <div
            aria-hidden="true"
            class="landing-dots pointer-events-none absolute inset-0 opacity-40"
          ></div>

          <div
            class="relative mx-auto grid max-w-7xl grid-cols-1 items-center gap-14 px-4 pb-20 pt-14 sm:px-6 lg:grid-cols-2 lg:gap-12 lg:px-8 lg:pb-28 lg:pt-20"
          >
            <!-- Copy -->
            <div class="max-w-xl">
              <p
                class="inline-flex items-center gap-2 rounded-full border border-neutral-200 bg-white px-3.5 py-1.5 text-xs font-semibold uppercase tracking-widest text-neutral-600 shadow-sm"
              >
                <span class="h-2 w-2 rounded-full bg-primary"></span>
                {{ t('Personal Life Management Platform') }}
              </p>

              <h1
                class="mt-6 text-5xl font-bold leading-[1.04] tracking-tight text-ink sm:text-6xl lg:text-7xl"
              >
                {{ t('Your Life.') }}
                <span class="text-gradient-gold">{{ t('One Hub.') }}</span>
              </h1>

              <p class="mt-6 text-lg font-medium leading-relaxed text-neutral-700 sm:text-xl">
                {{ t('Manage your money, productivity, goals, and habits — all in one place.') }}
              </p>
              <p class="mt-3 text-base font-medium leading-relaxed text-neutral-600">
                {{ t('LifeHub combines finance, tasks, goals, habits, calendar, focus sessions, weekly & monthly reviews, and AI insights — so your whole life works from a single command center.') }}
              </p>

              <div class="mt-8 flex flex-wrap items-center gap-3">
                <a
                  [routerLink]="startRoute()"
                  class="inline-flex items-center gap-2 rounded-xl bg-primary px-6 py-3.5 text-base font-semibold text-ink shadow-sm transition-all duration-150 hover:-translate-y-0.5 hover:bg-primary-strong hover:shadow-md"
                >
                  {{ t('Get Started Free') }}
                  <app-icon name="arrow-right" [size]="18" />
                </a>
                <a
                  routerLink="/features"
                  class="inline-flex items-center gap-2 rounded-xl border border-neutral-200 bg-white px-6 py-3.5 text-base font-semibold text-neutral-700 shadow-sm transition-all duration-150 hover:-translate-y-0.5 hover:bg-neutral-50 hover:text-ink hover:shadow-md"
                >
                  {{ t('Explore Features') }}
                </a>
              </div>

              <ul class="mt-8 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm font-medium text-neutral-600">
                <li class="flex items-center gap-1.5">
                  <app-icon name="check" [size]="15" class="text-success" [strokeWidth]="3" />
                  {{ t('Free to start') }}
                </li>
                <li class="flex items-center gap-1.5">
                  <app-icon name="check" [size]="15" class="text-success" [strokeWidth]="3" />
                  {{ t('No credit card') }}
                </li>
                <li class="flex items-center gap-1.5">
                  <app-icon name="check" [size]="15" class="text-success" [strokeWidth]="3" />
                  {{ t('Your data stays yours') }}
                </li>
              </ul>
            </div>

            <!-- Product mockup -->
            <div class="relative mx-auto w-full max-w-xl lg:mx-0" data-reveal>
              <div class="relative overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-xl shadow-neutral-900/10">
                <!-- Window chrome -->
                <div class="flex items-center gap-2 border-b border-neutral-200 bg-neutral-50 px-4 py-3">
                  <span class="h-3 w-3 rounded-full bg-[#ff5f57]"></span>
                  <span class="h-3 w-3 rounded-full bg-[#febc2e]"></span>
                  <span class="h-3 w-3 rounded-full bg-[#28c840]"></span>
                  <span
                    class="ml-3 flex-1 truncate rounded-md border border-neutral-200 bg-white px-3 py-1 text-center text-[11px] font-medium text-neutral-500"
                  >
                    lifehub.app/app/dashboard
                  </span>
                  <span
                    class="hidden items-center gap-1 rounded-md border border-neutral-200 bg-white px-2 py-1 text-[10px] font-semibold text-neutral-500 sm:flex"
                  >
                    <app-icon name="search" [size]="11" />
                    ⌘K
                  </span>
                </div>

                <div class="flex">
                  <!-- Mock sidebar -->
                  <div class="hidden w-36 shrink-0 border-r border-neutral-200 bg-neutral-50/60 p-3 sm:block">
                    <ul class="space-y-1">
                      @for (item of mockSidebar; track item.label) {
                        <li
                          class="flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-[11px] font-semibold"
                          [class]="
                            item.active
                              ? 'bg-primary text-ink shadow-sm'
                              : 'text-neutral-500'
                          "
                        >
                          <app-icon [name]="item.icon" [size]="13" />
                          {{ t(item.label) }}
                        </li>
                      }
                    </ul>
                    <div
                      class="mt-4 flex items-center gap-2 rounded-lg bg-accent px-2.5 py-1.5 text-[11px] font-semibold text-white"
                    >
                      <app-icon name="bot" [size]="13" />
                      LifeHub AI
                    </div>
                  </div>

                  <!-- Mock content -->
                  <div class="min-w-0 flex-1 space-y-3 p-4">
                    <div class="flex items-center justify-between gap-2">
                      <div>
                        <p class="text-sm font-bold text-ink">{{ t('Good morning 👋') }}</p>
                        <p class="text-[10px] font-medium text-neutral-500">
                          {{ t('Saturday, 15 August') }}
                        </p>
                      </div>
                      <span
                        class="rounded-lg bg-primary px-2.5 py-1 text-[10px] font-bold text-ink shadow-sm"
                      >
                        + {{ t('Add') }}
                      </span>
                    </div>

                    <!-- Finance row -->
                    <div class="grid grid-cols-3 gap-2">
                      <div class="rounded-xl border border-neutral-200 bg-white p-2.5 shadow-sm">
                        <p class="text-[9px] font-bold uppercase tracking-wide text-neutral-500">{{ t('Net worth') }}</p>
                        <p class="mt-0.5 text-sm font-bold text-ink">Rp 63,4jt</p>
                      </div>
                      <div class="rounded-xl border border-neutral-200 bg-white p-2.5 shadow-sm">
                        <p class="text-[9px] font-bold uppercase tracking-wide text-neutral-500">{{ t('Income') }}</p>
                        <p class="mt-0.5 text-sm font-bold text-success">+8jt</p>
                      </div>
                      <div class="rounded-xl border border-neutral-200 bg-white p-2.5 shadow-sm">
                        <p class="text-[9px] font-bold uppercase tracking-wide text-neutral-500">{{ t('Expense') }}</p>
                        <p class="mt-0.5 text-sm font-bold text-danger">−4,5jt</p>
                      </div>
                    </div>

                    <!-- Tasks -->
                    <div class="rounded-xl border border-neutral-200 bg-white p-3 shadow-sm">
                      <p class="flex items-center gap-1.5 text-[11px] font-bold text-ink">
                        <app-icon name="list-todo" [size]="12" />
                        {{ t('Today’s tasks') }}
                      </p>
                      <ul class="mt-2 space-y-1.5">
                        @for (task of mockTasks; track task.title) {
                          <li class="flex items-center gap-2 text-[11px] font-medium text-ink">
                            <span
                              class="flex h-4 w-4 shrink-0 items-center justify-center rounded-full border-2"
                              [class]="task.done ? 'border-success bg-success' : 'border-neutral-300'"
                            >
                              @if (task.done) {
                                <app-icon name="check" [size]="9" [strokeWidth]="3" class="text-white" />
                              }
                            </span>
                            <span class="truncate" [class.line-through]="task.done" [class.text-neutral-400]="task.done">
                              {{ t(task.title) }}
                            </span>
                          </li>
                        }
                      </ul>
                    </div>

                    <!-- Habits + Focus -->
                    <div class="grid grid-cols-2 gap-2">
                      <div class="rounded-xl border border-neutral-200 bg-white p-2.5 shadow-sm">
                        <p class="flex items-center gap-1 text-[10px] font-bold text-ink">
                          <app-icon name="flame" [size]="12" class="text-warning" />
                          {{ t('Exercise') }}
                        </p>
                        <p class="mt-1 text-[10px] font-semibold text-neutral-500">{{ t('12-day streak') }}</p>
                      </div>
                      <div class="rounded-xl border border-neutral-200 bg-white p-2.5 shadow-sm">
                        <p class="flex items-center gap-1 text-[10px] font-bold text-ink">
                          <app-icon name="timer" [size]="12" class="text-danger" />
                          {{ t('Focus') }}
                        </p>
                        <p class="mt-1 text-[10px] font-semibold text-neutral-500">{{ t('Session 3 of 4 · 25:00') }}</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <!-- Floating badges -->
              <div
                class="absolute -left-3 -top-4 hidden -rotate-2 rounded-xl border border-neutral-200 bg-white px-3 py-1.5 text-xs font-semibold text-neutral-700 shadow-lg sm:block"
              >
                {{ t('💰 Budget on track') }}
              </div>
              <div
                class="absolute -bottom-4 -right-3 hidden rotate-2 rounded-xl border border-neutral-200 bg-white px-3 py-1.5 text-xs font-semibold text-neutral-700 shadow-lg sm:block"
              >
                {{ t('✨ AI · 2 reminders today') }}
              </div>
            </div>
          </div>

          <p
            class="relative mx-auto max-w-7xl px-4 pb-8 text-center text-xs font-medium text-neutral-500 sm:px-6 lg:px-8"
          >
            {{ t('Illustrative preview — your LifeHub shows your own numbers.') }}
          </p>
        </section>

        <!-- ══════════════════ VALUE PROPOSITION ══════════════════ -->
        <section class="bg-white">
          <div class="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8 lg:py-24">
            <div class="mx-auto max-w-2xl text-center" data-reveal>
              <p class="text-xs font-bold uppercase tracking-widest text-neutral-500">
                {{ t('One system') }}
              </p>
              <h2
                class="mt-3 text-3xl font-bold tracking-tight text-ink sm:text-4xl"
              >
                {{ t('Everything you need to stay on top of your life.') }}
              </h2>
              <p class="mt-4 text-base font-medium leading-relaxed text-neutral-600">
                {{ t('Not twenty disconnected apps — one connected system where your money, time, habits, and goals inform each other.') }}
              </p>
            </div>

            <div class="mt-12 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
              @for (card of VALUE_CARDS; track card.title; let i = $index) {
                <article
                  data-reveal
                  [style.transition-delay]="(i % 3) * 80 + 'ms'"
                  class="group rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm transition-all duration-200 hover:-translate-y-1 hover:border-neutral-300 hover:shadow-lg"
                >
                  <span
                    class="flex h-11 w-11 items-center justify-center rounded-xl"
                    [class]="card.tone"
                  >
                    <app-icon [name]="card.icon" [size]="20" />
                  </span>
                  <h3 class="mt-4 text-lg font-bold tracking-tight text-ink">{{ t(card.title) }}</h3>
                  <p class="mt-2 text-sm font-medium leading-relaxed text-neutral-600">
                    {{ t(card.description) }}
                  </p>
                </article>
              }
            </div>
          </div>
        </section>

        <!-- ══════════════════ FINANCE SHOWCASE ══════════════════ -->
        <section id="finance" class="scroll-mt-20">
          <div class="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8 lg:py-24">
            <div class="grid grid-cols-1 items-center gap-14 lg:grid-cols-2 lg:gap-16">
              <!-- Copy -->
              <div data-reveal>
                <p class="text-xs font-bold uppercase tracking-widest text-neutral-500">{{ t('Finance') }}</p>
                <h2 class="mt-3 text-3xl font-bold tracking-tight text-ink sm:text-4xl">
                  {{ t('Your money, finally in one place.') }}
                </h2>
                <p class="mt-4 text-base font-medium leading-relaxed text-neutral-600">
                  {{ t('Track income, expenses, budgets, accounts, investments, and net worth — with a clear view of what you can spend and what you’re investing.') }}
                </p>
                <ul class="mt-7 space-y-3.5">
                  @for (point of financePoints; track point) {
                    <li class="flex items-start gap-3">
                      <span
                        class="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-ink"
                      >
                        <app-icon name="check" [size]="13" [strokeWidth]="3" />
                      </span>
                      <span class="text-sm font-medium text-neutral-700">{{ t(point) }}</span>
                    </li>
                  }
                </ul>
                <div class="mt-9">
                  <a
                    routerLink="/features"
                    class="inline-flex items-center gap-2 rounded-xl bg-primary px-6 py-3 text-sm font-semibold text-ink shadow-sm transition-all duration-150 hover:-translate-y-0.5 hover:bg-primary-strong hover:shadow-md"
                  >
                    {{ t('Explore Finance') }}
                    <app-icon name="arrow-right" [size]="16" />
                  </a>
                </div>
              </div>

              <!-- Net worth mockup -->
              <div class="mx-auto w-full max-w-md" data-reveal>
                <div class="overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-lg shadow-neutral-900/5">
                  <div class="border-b border-neutral-200 bg-neutral-50/60 px-5 py-4">
                    <div class="flex items-center justify-between gap-2">
                      <p class="text-xs font-bold uppercase tracking-wide text-neutral-500">
                        {{ t('Net worth') }}
                      </p>
                      <span
                        class="rounded-full bg-success/10 px-2.5 py-1 text-[11px] font-bold text-success"
                      >
                        {{ t('Health 78/100') }}
                      </span>
                    </div>
                    <p class="mt-2 text-3xl font-bold tracking-tight text-ink">Rp63.409.000</p>
                  </div>

                  <div class="space-y-4 p-5">
                    <div class="grid grid-cols-2 gap-3">
                      <div class="rounded-xl border border-neutral-200 bg-white p-3">
                        <p class="text-[10px] font-bold uppercase tracking-wide text-neutral-500">
                          {{ t('Liquid assets') }}
                        </p>
                        <p class="mt-1 text-base font-bold text-ink">Rp845.000</p>
                        <p class="text-[10px] font-medium text-neutral-500">{{ t('Cash + e-wallets + banks') }}</p>
                      </div>
                      <div class="rounded-xl border border-neutral-200 bg-white p-3">
                        <p class="text-[10px] font-bold uppercase tracking-wide text-neutral-500">
                          {{ t('Investment assets') }}
                        </p>
                        <p class="mt-1 text-base font-bold text-ink">Rp62.564.000</p>
                        <p class="text-[10px] font-medium text-neutral-500">{{ t('Investments only') }}</p>
                      </div>
                    </div>

                    <div>
                      <p class="mb-2 text-[10px] font-bold uppercase tracking-wide text-neutral-500">
                        {{ t('Accounts') }}
                      </p>
                      <div class="space-y-1.5">
                        @for (account of mockAccounts; track account.name) {
                          <div class="flex items-center justify-between rounded-lg border border-neutral-200 px-3 py-2">
                            <span class="flex items-center gap-2 text-xs font-semibold text-ink">
                              <span class="h-2 w-2 rounded-full" [class]="account.dot"></span>
                              {{ account.name }}
                              <span
                                class="rounded-full bg-neutral-100 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-neutral-500"
                              >
                                {{ t(account.type) }}
                              </span>
                            </span>
                            <span class="text-xs font-bold text-ink">{{ account.balance }}</span>
                          </div>
                        }
                      </div>
                    </div>

                    <div>
                      <p class="mb-2 text-[10px] font-bold uppercase tracking-wide text-neutral-500">
                        {{ t('Budgets') }}
                      </p>
                      <div class="rounded-xl border border-neutral-200 p-3">
                        <div class="flex items-center justify-between text-xs">
                          <span class="font-semibold text-ink">{{ t('Food & Drinks') }}</span>
                          <span class="font-medium text-neutral-500">Rp438.000 / Rp500.000</span>
                        </div>
                        <div class="mt-2 h-2 overflow-hidden rounded-full bg-neutral-100">
                          <div class="h-full rounded-full bg-warning" style="width: 88%"></div>
                        </div>
                        <p class="mt-1.5 text-[10px] font-semibold text-warning">
                          {{ t('Approaching your limit') }}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
                <p class="mt-3 text-center text-xs font-medium text-neutral-500">
                  {{ t('Sample data for illustration.') }}
                </p>
              </div>
            </div>

            <!-- Quick-add demo -->
            <div
              class="mx-auto mt-16 max-w-4xl rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm sm:p-8"
              data-reveal
            >
              <div class="flex flex-col items-start gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h3 class="text-lg font-bold tracking-tight text-ink">
                    {{ t('Quick-add transactions naturally') }}
                  </h3>
                  <p class="mt-1 text-sm font-medium text-neutral-600">
                    {{ t('Type it like you’d say it. LifeHub parses the amount, category, and account — then updates the balance.') }}
                  </p>
                </div>
                <span
                  class="rounded-full border border-neutral-200 bg-neutral-50 px-3 py-1 text-[11px] font-bold uppercase tracking-wide text-neutral-500"
                >
                  {{ t('Real feature') }}
                </span>
              </div>

              <div class="mt-6 grid grid-cols-1 items-center gap-4 sm:grid-cols-[1fr_auto_1fr]">
                <div class="flex items-center gap-2 rounded-xl border border-neutral-200 bg-neutral-50 px-4 py-3">
                  <app-icon name="message-square" [size]="16" class="text-neutral-400" />
                  <span class="text-sm font-medium text-neutral-700">“jajan 15k bca”</span>
                </div>
                <span
                  class="mx-auto flex h-9 w-9 items-center justify-center rounded-full bg-primary text-ink shadow-sm"
                >
                  <app-icon name="arrow-right" [size]="16" />
                </span>
                <div class="flex flex-wrap items-center gap-2">
                  <span class="rounded-lg bg-success/10 px-2.5 py-1 text-xs font-bold text-success">
                    {{ t('Expense') }}
                  </span>
                  <span class="rounded-lg bg-neutral-100 px-2.5 py-1 text-xs font-bold text-ink">
                    Rp15.000
                  </span>
                  <span class="rounded-lg bg-primary/20 px-2.5 py-1 text-xs font-bold text-ink">
                    {{ t('Food & Drinks') }}
                  </span>
                  <span class="rounded-lg bg-neutral-100 px-2.5 py-1 text-xs font-bold text-ink">
                    BCA
                  </span>
                  <span class="text-xs font-semibold text-neutral-500">
                    {{ t('→ BCA balance −Rp15.000') }}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </section>

        <!-- ══════════════════ AI SHOWCASE ══════════════════ -->
        <section id="ai" class="scroll-mt-20 bg-ink">
          <div class="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8 lg:py-24">
            <div class="grid grid-cols-1 items-center gap-14 lg:grid-cols-2 lg:gap-16">
              <!-- Copy -->
              <div data-reveal>
                <p
                  class="inline-flex items-center gap-2 rounded-full border border-neutral-700 bg-neutral-900 px-3.5 py-1.5 text-xs font-semibold uppercase tracking-widest text-neutral-300"
                >
                  <img src="assets/LifeHubAI.png" alt="" class="h-4 w-4 object-contain" />
                  LifeHub AI
                </p>
                <h2 class="mt-5 text-3xl font-bold tracking-tight text-white sm:text-4xl">
                  {{ t('Your personal AI, powered by your own data.') }}
                </h2>
                <p class="mt-4 text-base font-medium leading-relaxed text-neutral-400">
                  {{ t('LifeHub AI turns your personal data into useful insights without asking you to manually analyze everything.') }}
                </p>

                <ul class="mt-7 space-y-3">
                  @for (pillar of aiPillars; track pillar) {
                    <li class="flex items-center gap-3">
                      <span
                        class="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-ink"
                      >
                        <app-icon name="check" [size]="13" [strokeWidth]="3" />
                      </span>
                      <span class="text-sm font-medium text-neutral-300">{{ t(pillar) }}</span>
                    </li>
                  }
                </ul>

                <div class="mt-9 flex flex-wrap gap-3">
                  <a
                    routerLink="/ai"
                    class="inline-flex items-center gap-2 rounded-xl bg-primary px-6 py-3 text-sm font-semibold text-ink shadow-sm transition-all duration-150 hover:-translate-y-0.5 hover:bg-primary-strong hover:shadow-md"
                  >
                    <app-icon name="bot" [size]="17" />
                    {{ t('Try LifeHub AI') }}
                  </a>
                </div>
              </div>

              <!-- Chat mockup -->
              <div class="mx-auto w-full max-w-lg" data-reveal>
                <div class="overflow-hidden rounded-2xl border border-neutral-800 bg-neutral-900 shadow-2xl shadow-black/40">
                  <div class="flex items-center gap-2 border-b border-neutral-800 px-4 py-3">
                    <span class="flex h-6 w-6 items-center justify-center rounded-lg bg-accent">
                      <img src="assets/LifeHubAI.png" alt="" class="h-4 w-4 object-contain" />
                    </span>
                    <p class="text-sm font-semibold text-white">LifeHub AI</p>
                    <span class="ml-auto flex items-center gap-1.5 text-[10px] font-semibold text-neutral-500">
                      <span class="h-1.5 w-1.5 rounded-full bg-success"></span>
                      {{ t('Connected to your data') }}
                    </span>
                  </div>

                  <div class="space-y-4 p-5">
                    <!-- User -->
                    <div class="flex justify-end">
                      <div class="max-w-[85%] rounded-2xl rounded-br-sm bg-primary px-4 py-2.5 text-sm font-medium text-ink">
                        {{ t('Can I afford a Rp5M purchase next month?') }}
                      </div>
                    </div>

                    <!-- AI -->
                    <div class="space-y-2.5">
                      <div class="rounded-2xl rounded-tl-sm border border-neutral-800 bg-neutral-800/60 p-4">
                        <p class="text-[10px] font-bold uppercase tracking-widest text-neutral-500">
                          {{ t('FACTS') }} <span class="font-medium normal-case text-neutral-600">{{ t('— from your recorded data') }}</span>
                        </p>
                        <p class="mt-1.5 text-sm font-medium leading-relaxed text-neutral-300">
                          {{ t('Total assets Rp63,4M · Liquid Rp845K · Investments Rp62,5M · Net cash flow last month +Rp3,2M.') }}
                        </p>
                      </div>
                      <div class="rounded-2xl rounded-tl-sm border border-neutral-800 bg-neutral-800/60 p-4">
                        <p class="text-[10px] font-bold uppercase tracking-widest text-neutral-500">
                          {{ t('INSIGHTS') }}
                        </p>
                        <p class="mt-1.5 text-sm font-medium leading-relaxed text-neutral-300">
                          {{ t('Almost all of your money sits in investments, so a Rp5M purchase would mostly draw from your liquid funds.') }}
                        </p>
                      </div>
                      <div class="rounded-2xl rounded-tl-sm border border-neutral-800 bg-neutral-800/60 p-4">
                        <p class="text-[10px] font-bold uppercase tracking-widest text-neutral-500">
                          {{ t('RECOMMENDATIONS') }}
                        </p>
                        <p class="mt-1.5 text-sm font-medium leading-relaxed text-neutral-300">
                          {{ t('Move funds from investments, or delay the purchase one month while you rebuild your liquid cash.') }}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div class="border-t border-neutral-800 px-5 py-3">
                    <p class="text-[11px] font-medium text-neutral-500">
                      {{ t('Facts from your data · Insights with context · Recommendations you can act on') }}
                    </p>
                  </div>
                </div>
                <p class="mt-3 text-center text-xs font-medium text-neutral-500">
                  {{ t('Illustrative example — LifeHub AI always answers from your own recorded data.') }}
                </p>
              </div>
            </div>
          </div>
        </section>

        <!-- ══════════════════ PRODUCTIVITY SHOWCASE ══════════════════ -->
        <section id="productivity" class="scroll-mt-20 bg-white">
          <div class="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8 lg:py-24">
            <div class="mx-auto max-w-2xl text-center" data-reveal>
              <p class="text-xs font-bold uppercase tracking-widest text-neutral-500">{{ t('Productivity') }}</p>
              <h2 class="mt-3 text-3xl font-bold tracking-tight text-ink sm:text-4xl">
                {{ t('Plan less. Accomplish more.') }}
              </h2>
              <p class="mt-4 text-base font-medium leading-relaxed text-neutral-600">
                {{ t('Tasks feed your focus sessions, focus feeds your statistics, and every week closes with a review — so your momentum compounds.') }}
              </p>
            </div>

            <div
              class="mt-12 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5"
              data-reveal
            >
              @for (item of PRODUCTIVITY_FLOW; track item.title; let i = $index) {
                <div class="relative">
                  <div
                    class="flex h-full flex-col items-start rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm transition-all duration-200 hover:-translate-y-1 hover:shadow-lg"
                    [style.transition-delay]="(i % 5) * 60 + 'ms'"
                  >
                    <span class="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/15 text-ink">
                      <app-icon [name]="item.icon" [size]="18" />
                    </span>
                    <p class="mt-3 text-sm font-bold text-ink">{{ t(item.title) }}</p>
                    <p class="mt-1 text-xs font-medium text-neutral-500">{{ t(item.text) }}</p>
                  </div>
                  @if (!$last) {
                    <app-icon
                      name="arrow-right"
                      [size]="16"
                      class="absolute -right-3 top-1/2 z-10 hidden -translate-y-1/2 text-neutral-400 lg:block"
                    />
                  }
                </div>
              }
            </div>

            <div
              class="mx-auto mt-10 max-w-2xl rounded-2xl border border-neutral-200 bg-bg px-6 py-4 text-center"
              data-reveal
            >
              <p class="text-sm font-medium text-neutral-700">
                <span class="font-bold text-ink">{{ t('Focus sessions are persisted.') }}</span>
                {{ t('Completed Pomodoro time feeds your Dashboard, Statistics, Weekly & Monthly Reviews, and AI context.') }}
              </p>
            </div>
          </div>
        </section>

        <!-- ══════════════════ GOALS + HABITS ══════════════════ -->
        <section class="scroll-mt-20">
          <div class="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8 lg:py-24">
            <div class="grid grid-cols-1 items-center gap-14 lg:grid-cols-2 lg:gap-16">
              <!-- Goal mockup -->
              <div class="mx-auto w-full max-w-md" data-reveal>
                <div class="overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-lg shadow-neutral-900/5">
                  <div class="border-b border-neutral-200 bg-neutral-50/60 px-5 py-4">
                    <div class="flex items-center justify-between">
                      <p class="text-xs font-bold uppercase tracking-wide text-neutral-500">{{ t('Savings goal') }}</p>
                      <span class="rounded-full bg-primary/20 px-2.5 py-1 text-[11px] font-bold text-ink">
                        40%
                      </span>
                    </div>
                    <h3 class="mt-2 text-xl font-bold tracking-tight text-ink">{{ t('Save for laptop') }}</h3>
                  </div>
                  <div class="space-y-4 p-5">
                    <div>
                      <div class="flex items-baseline justify-between">
                        <p class="text-2xl font-bold tracking-tight text-ink">Rp3,2M</p>
                        <p class="text-sm font-medium text-neutral-500">{{ t('of Rp8M') }}</p>
                      </div>
                      <div class="mt-2 h-3 overflow-hidden rounded-full bg-neutral-100">
                        <div class="h-full rounded-full bg-primary" style="width: 40%"></div>
                      </div>
                    </div>
                    <div class="grid grid-cols-2 gap-3">
                      <div class="rounded-xl border border-neutral-200 p-3">
                        <p class="text-[10px] font-bold uppercase tracking-wide text-neutral-500">
                          {{ t('Required monthly') }}
                        </p>
                        <p class="mt-1 text-base font-bold text-ink">Rp1,2M</p>
                      </div>
                      <div class="rounded-xl border border-neutral-200 p-3">
                        <p class="text-[10px] font-bold uppercase tracking-wide text-neutral-500">
                          {{ t('Deadline') }}
                        </p>
                        <p class="mt-1 text-base font-bold text-ink">{{ t('Dec 2026') }}</p>
                      </div>
                    </div>
                    <p class="text-[11px] font-medium text-neutral-500">
                      {{ t('Estimated from your target, deadline, and recorded savings.') }}
                    </p>
                  </div>
                </div>
                <p class="mt-3 text-center text-xs font-medium text-neutral-500">
                  {{ t('Sample data for illustration.') }}
                </p>
              </div>

              <!-- Copy + habits -->
              <div data-reveal>
                <p class="text-xs font-bold uppercase tracking-widest text-neutral-500">{{ t('Goals & habits') }}</p>
                <h2 class="mt-3 text-3xl font-bold tracking-tight text-ink sm:text-4xl">
                  {{ t('Build the life you’re working toward.') }}
                </h2>
                <p class="mt-4 text-base font-medium leading-relaxed text-neutral-600">
                  {{ t('Savings goals connect to your accounts and show the monthly contribution your deadline requires. Habits keep you consistent — one day at a time.') }}
                </p>

                <div class="mt-8 space-y-3">
                  @for (habit of mockHabits; track habit.name) {
                    <div class="flex items-center justify-between rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm">
                      <div class="flex items-center gap-3">
                        <span class="flex h-9 w-9 items-center justify-center rounded-xl bg-warning/10 text-warning">
                          <app-icon name="flame" [size]="17" />
                        </span>
                        <div>
                          <p class="text-sm font-bold text-ink">{{ t(habit.name) }}</p>
                          <p class="text-xs font-medium text-neutral-500">{{ t(habit.streak) }}</p>
                        </div>
                      </div>
                      <div class="hidden gap-1 sm:flex">
                        @for (day of habit.days; track $index) {
                          <span
                            class="h-5 w-5 rounded-md text-[9px] font-bold"
                            [class]="day ? 'bg-success text-white' : 'bg-neutral-100 text-neutral-400'"
                          >
                            {{ day ? '✓' : '·' }}
                          </span>
                        }
                      </div>
                    </div>
                  }
                </div>
              </div>
            </div>
          </div>
        </section>

        <!-- ══════════════════ MONTHLY REVIEW SHOWCASE ══════════════════ -->
        <section class="scroll-mt-20 bg-white">
          <div class="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8 lg:py-24">
            <div class="mx-auto max-w-2xl text-center" data-reveal>
              <p class="text-xs font-bold uppercase tracking-widest text-neutral-500">{{ t('Monthly Review') }}</p>
              <h2 class="mt-3 text-3xl font-bold tracking-tight text-ink sm:text-4xl">
                {{ t('Don’t just track your life. Understand it.') }}
              </h2>
              <p class="mt-4 text-base font-medium leading-relaxed text-neutral-600">
                {{ t('LifeHub brings your activity together so you can see what changed, what went well, and what deserves your attention next.') }}
              </p>
            </div>

            <!-- Review mockup -->
            <div class="mx-auto mt-12 max-w-4xl" data-reveal>
              <div class="overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-lg shadow-neutral-900/5">
                <div class="flex items-center justify-between border-b border-neutral-200 bg-neutral-50/60 px-5 py-4 sm:px-7">
                  <div>
                    <p class="text-xs font-bold uppercase tracking-wide text-neutral-500">{{ t('Monthly Review') }}</p>
                    <h3 class="mt-1 text-lg font-bold tracking-tight text-ink">{{ t('July 2026') }}</h3>
                  </div>
                  <span
                    class="rounded-full border border-neutral-200 bg-white px-3 py-1.5 text-[11px] font-bold text-success"
                  >
                    {{ t('▲ Net worth +4,2% vs June') }}
                  </span>
                </div>

                <div class="space-y-5 p-5 sm:p-7">
                  <!-- Metrics -->
                  <div class="grid grid-cols-2 gap-3 lg:grid-cols-4">
                    <div class="rounded-xl border border-neutral-200 p-3.5">
                      <p class="text-[10px] font-bold uppercase tracking-wide text-neutral-500">{{ t('Financial health') }}</p>
                      <p class="mt-1 text-lg font-bold text-ink">78<span class="text-xs font-semibold text-neutral-500">/100</span></p>
                    </div>
                    <div class="rounded-xl border border-neutral-200 p-3.5">
                      <p class="text-[10px] font-bold uppercase tracking-wide text-neutral-500">{{ t('Income') }}</p>
                      <p class="mt-1 text-lg font-bold text-success">Rp8,0jt</p>
                    </div>
                    <div class="rounded-xl border border-neutral-200 p-3.5">
                      <p class="text-[10px] font-bold uppercase tracking-wide text-neutral-500">{{ t('Expenses') }}</p>
                      <p class="mt-1 text-lg font-bold text-danger">Rp4,5jt</p>
                    </div>
                    <div class="rounded-xl border border-neutral-200 p-3.5">
                      <p class="text-[10px] font-bold uppercase tracking-wide text-neutral-500">{{ t('Net cash flow') }}</p>
                      <p class="mt-1 text-lg font-bold text-ink">+Rp3,5jt</p>
                    </div>
                  </div>

                  <div class="grid grid-cols-1 gap-5 lg:grid-cols-2">
                    <!-- Top categories -->
                    <div class="rounded-xl border border-neutral-200 p-4">
                      <p class="text-[11px] font-bold uppercase tracking-wide text-neutral-500">
                        {{ t('Top categories') }}
                      </p>
                      <ul class="mt-3 space-y-2.5">
                        @for (cat of reviewCategories; track cat.label) {
                          <li>
                            <div class="mb-1 flex items-center justify-between text-xs">
                              <span class="font-semibold text-ink">{{ t(cat.label) }}</span>
                              <span class="font-medium text-neutral-500">{{ cat.amount }} · {{ cat.percent }}%</span>
                            </div>
                            <div class="h-2 overflow-hidden rounded-full bg-neutral-100">
                              <div
                                class="h-full rounded-full"
                                [class]="cat.bar"
                                [style.width.%]="cat.percent"
                              ></div>
                            </div>
                          </li>
                        }
                      </ul>
                    </div>

                    <!-- Budget performance + productivity -->
                    <div class="space-y-4">
                      <div class="rounded-xl border border-neutral-200 p-4">
                        <p class="text-[11px] font-bold uppercase tracking-wide text-neutral-500">
                          {{ t('Budget performance') }}
                        </p>
                        <ul class="mt-3 space-y-2">
                          @for (b of reviewBudgets; track b.label) {
                            <li class="flex items-center justify-between text-xs">
                              <span class="font-semibold text-ink">{{ t(b.label) }}</span>
                              <span
                                class="rounded-full px-2 py-0.5 text-[10px] font-bold"
                                [class]="b.status === 'Over' ? 'bg-danger/10 text-danger' : 'bg-success/10 text-success'"
                              >
                                {{ b.used }} · {{ t(b.status) }}
                              </span>
                            </li>
                          }
                        </ul>
                      </div>
                      <div class="grid grid-cols-3 gap-3">
                        <div class="rounded-xl border border-neutral-200 p-3">
                          <p class="text-[10px] font-bold uppercase tracking-wide text-neutral-500">{{ t('Tasks') }}</p>
                          <p class="mt-1 text-sm font-bold text-ink">42/48 <span class="text-[10px] font-semibold text-neutral-500">88%</span></p>
                        </div>
                        <div class="rounded-xl border border-neutral-200 p-3">
                          <p class="text-[10px] font-bold uppercase tracking-wide text-neutral-500">{{ t('Focus') }}</p>
                          <p class="mt-1 text-sm font-bold text-ink">18h 32m</p>
                        </div>
                        <div class="rounded-xl border border-neutral-200 p-3">
                          <p class="text-[10px] font-bold uppercase tracking-wide text-neutral-500">{{ t('Goals') }}</p>
                          <p class="mt-1 text-sm font-bold text-ink">3/4 <span class="text-[10px] font-semibold text-neutral-500">{{ t('on track') }}</span></p>
                        </div>
                      </div>
                    </div>
                  </div>

                  <!-- AI summary -->
                  <div class="rounded-xl border border-neutral-200 bg-bg p-4">
                    <p class="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-neutral-500">
                      <app-icon name="bot" [size]="13" />
                      {{ t('AI monthly summary') }}
                    </p>
                    <p class="mt-2 text-sm font-medium leading-relaxed text-neutral-700">
                      <span class="font-bold text-success">{{ t('What went well:') }}</span>
                      {{ t('focus time up 32% and all goals progressed.') }}
                      <span class="font-bold text-warning">{{ t('Needs attention:') }}</span>
                      {{ t('Entertainment ran 20% over budget.') }}
                      <span class="font-bold text-ink">{{ t('Next month:') }}</span>
                      {{ t('hold entertainment to Rp400K and keep the laptop goal on schedule.') }}
                    </p>
                  </div>
                </div>
              </div>
              <p class="mt-3 text-center text-xs font-medium text-neutral-500">
                {{ t('Sample data for illustration.') }}
              </p>
            </div>
          </div>
        </section>

        <!-- ══════════════════ HOW IT WORKS ══════════════════ -->
        <section id="how-it-works" class="scroll-mt-20">
          <div class="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8 lg:py-24">
            <div class="mx-auto max-w-2xl text-center" data-reveal>
              <p class="text-xs font-bold uppercase tracking-widest text-neutral-500">{{ t('How it works') }}</p>
              <h2 class="mt-3 text-3xl font-bold tracking-tight text-ink sm:text-4xl">
                {{ t('From scattered to in control.') }}
              </h2>
              <p class="mt-4 text-base font-medium leading-relaxed text-neutral-600">
                {{ t('Four steps between you and a life that runs itself.') }}
              </p>
            </div>

            <ol class="mt-12 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
              @for (step of STEPS; track step.step; let i = $index) {
                <li
                  data-reveal
                  [style.transition-delay]="(i % 4) * 80 + 'ms'"
                  class="relative rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm transition-all duration-200 hover:-translate-y-1 hover:shadow-lg"
                >
                  <span class="text-4xl font-bold tracking-tight text-primary">{{ step.step }}</span>
                  <h3 class="mt-3 text-lg font-bold tracking-tight text-ink">{{ t(step.title) }}</h3>
                  <p class="mt-1.5 text-sm font-medium leading-relaxed text-neutral-600">{{ t(step.text) }}</p>
                  @if (!$last) {
                    <span
                      aria-hidden="true"
                      class="absolute -right-4 top-1/2 hidden h-px w-8 bg-neutral-300 lg:block"
                    ></span>
                  }
                </li>
              }
            </ol>
          </div>
        </section>

        <!-- ══════════════════ FEATURE ECOSYSTEM ══════════════════ -->
        <section class="bg-white">
          <div class="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8 lg:py-24">
            <div class="mx-auto max-w-2xl text-center" data-reveal>
              <p class="text-xs font-bold uppercase tracking-widest text-neutral-500">{{ t('The ecosystem') }}</p>
              <h2 class="mt-3 text-3xl font-bold tracking-tight text-ink sm:text-4xl">
                {{ t('One system. Every part of your life.') }}
              </h2>
              <p class="mt-4 text-base font-medium leading-relaxed text-neutral-600">
                {{ t('Sixteen tools that share one source of truth — so nothing lives in a silo.') }}
              </p>
            </div>

            <div class="mt-12 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              @for (item of ECOSYSTEM; track item.title; let i = $index) {
                <div
                  data-reveal
                  [style.transition-delay]="(i % 4) * 50 + 'ms'"
                  class="group flex items-start gap-3.5 rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-neutral-300 hover:shadow-md"
                >
                  <span
                    class="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/15 text-ink transition-colors group-hover:bg-primary"
                  >
                    <app-icon [name]="item.icon" [size]="18" />
                  </span>
                  <div class="min-w-0">
                    <h3 class="text-sm font-bold text-ink">{{ t(item.title) }}</h3>
                    <p class="mt-0.5 text-xs font-medium leading-relaxed text-neutral-600">
                      {{ t(item.description) }}
                    </p>
                  </div>
                </div>
              }
            </div>
          </div>
        </section>

        <!-- ══════════════════ COMMAND CENTER ══════════════════ -->
        <section class="scroll-mt-20">
          <div class="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8 lg:py-24">
            <div class="grid grid-cols-1 items-center gap-14 lg:grid-cols-2 lg:gap-16">
              <!-- Copy -->
              <div data-reveal>
                <p class="text-xs font-bold uppercase tracking-widest text-neutral-500">{{ t('Command center') }}</p>
                <h2 class="mt-3 text-3xl font-bold tracking-tight text-ink sm:text-4xl">
                  {{ t('One place to access everything.') }}
                </h2>
                <p class="mt-4 text-base font-medium leading-relaxed text-neutral-600">
                  {{ t('Press Ctrl/Cmd + K anywhere in LifeHub to search tasks, notes, transactions, goals, and more — or type a quick-add like “jajan 15k bca” to log it instantly.') }}
                </p>
                <ul class="mt-7 space-y-3">
                  @for (point of commandPoints; track point) {
                    <li class="flex items-start gap-3">
                      <span
                        class="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-ink"
                      >
                        <app-icon name="check" [size]="13" [strokeWidth]="3" />
                      </span>
                      <span class="text-sm font-medium text-neutral-700">{{ t(point) }}</span>
                    </li>
                  }
                </ul>
              </div>

              <!-- Palette mockup -->
              <div class="relative mx-auto w-full max-w-md" data-reveal>
                <div class="overflow-hidden rounded-2xl border border-neutral-800 bg-neutral-900 shadow-2xl shadow-black/30">
                  <div class="flex items-center gap-3 border-b border-neutral-800 px-4 py-3.5">
                    <app-icon name="search" [size]="16" class="text-neutral-500" />
                    <span class="flex-1 text-sm text-neutral-300">
                      {{ t('Search tasks, transactions, notes…') }}
                    </span>
                    <span class="flex items-center gap-1 rounded-md border border-neutral-700 bg-neutral-800 px-1.5 py-0.5 text-[10px] font-bold text-neutral-400">
                      <app-icon name="search" [size]="10" /> K
                    </span>
                  </div>
                  <div class="p-2">
                    @for (result of searchResults; track result.title; let i = $index) {
                      <div
                        class="flex items-center gap-3 rounded-lg px-3 py-2.5"
                        [class]="i === 0 ? 'bg-primary/15' : ''"
                      >
                        <span class="flex h-7 w-7 items-center justify-center rounded-lg bg-neutral-800 text-neutral-300">
                          <app-icon [name]="result.icon" [size]="14" />
                        </span>
                        <div class="min-w-0 flex-1">
                          <p class="truncate text-sm font-medium text-white">{{ t(result.title) }}</p>
                          <p class="text-[10px] font-semibold uppercase tracking-wide text-neutral-500">
                            {{ t(result.type) }}
                          </p>
                        </div>
                        @if (i === 0) {
                          <span class="rounded-md bg-primary px-1.5 py-0.5 text-[10px] font-bold text-ink">
                            {{ t('Enter') }}
                          </span>
                        }
                      </div>
                    }
                  </div>
                  <div class="flex items-center gap-3 border-t border-neutral-800 px-4 py-2.5 text-[10px] font-medium text-neutral-500">
                    <span>{{ t('↑↓ Navigate') }}</span>
                    <span>{{ t('Enter Open') }}</span>
                    <span>{{ t('Esc Close') }}</span>
                    <span class="ml-auto">{{ t('Real global search') }}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <!-- ══════════════════ FINAL CTA ══════════════════ -->
        <section class="relative overflow-hidden bg-ink">
          <div
            aria-hidden="true"
            class="pointer-events-none absolute inset-0"
            style="background: radial-gradient(60% 70% at 50% 0%, color-mix(in srgb, #ffd600 18%, transparent), transparent 70%)"
          ></div>
          <div class="relative mx-auto max-w-3xl px-4 py-20 text-center sm:px-6 lg:py-28">
            <h2 class="text-4xl font-bold tracking-tight text-white sm:text-5xl">
              {{ t('Your life deserves a') }}<br class="hidden sm:block" />
              <span class="text-gradient-gold">{{ t('better dashboard.') }}</span>
            </h2>
            <p class="mx-auto mt-5 max-w-xl text-base font-medium leading-relaxed text-neutral-400">
              {{ t('Bring your finances, productivity, goals, and habits together with LifeHub.') }}
            </p>
            <div class="mt-9 flex flex-wrap items-center justify-center gap-3">
              <a
                [routerLink]="startRoute()"
                class="inline-flex items-center gap-2 rounded-xl bg-primary px-7 py-3.5 text-base font-semibold text-ink shadow-sm transition-all duration-150 hover:-translate-y-0.5 hover:bg-primary-strong hover:shadow-md"
              >
                {{ t('Get Started Free') }}
                <app-icon name="arrow-right" [size]="18" />
              </a>
              <a
                routerLink="/features"
                class="inline-flex items-center gap-2 rounded-xl border border-neutral-700 bg-neutral-900 px-7 py-3.5 text-base font-semibold text-white transition-all duration-150 hover:-translate-y-0.5 hover:bg-neutral-800"
              >
                {{ t('Explore LifeHub') }}
              </a>
            </div>
            <p class="mt-6 text-xs font-medium text-neutral-500">
              {{ t('Free to start · No credit card · Your data stays yours') }}
            </p>
          </div>
        </section>
      </main>

      <app-public-footer />
    </div>
  `,
})
export class LandingComponent implements AfterViewInit {
  private seo = inject(SeoService);
  private auth = inject(AuthService);
  private el = inject(ElementRef);
  private i18n = inject(I18nService);

  protected readonly t = this.i18n.t.bind(this.i18n);
  protected readonly VALUE_CARDS = VALUE_CARDS;
  protected readonly ECOSYSTEM = ECOSYSTEM;
  protected readonly STEPS = STEPS;
  protected readonly PRODUCTIVITY_FLOW = PRODUCTIVITY_FLOW;

  protected readonly financePoints = [
    'Net worth, liquid assets, and investments computed from your real account balances',
    'Transfers between accounts never count as income or expense',
    'Account-level transaction history and spending per account',
    'Budgets compare plan vs actual, with warnings before you overspend',
    'Financial Health Score — a transparent, explainable metric, not advice',
  ];

  protected readonly aiPillars = [
    'Facts come from your recorded data — never invented',
    'Insights add context to what you actually track',
    'Recommendations you can act on, with no generic advice',
  ];

  protected readonly commandPoints = [
    'Search across tasks, notes, transactions, goals, habits, and more',
    'Quick-add transactions by typing naturally, e.g. “jajan 15k bca”',
    'Keyboard-first: navigate and act without leaving the keyboard',
  ];

  protected readonly mockSidebar = [
    { label: 'Today', icon: 'calendar-check', active: true },
    { label: 'Dashboard', icon: 'layout-dashboard', active: false },
    { label: 'Tasks', icon: 'list-todo', active: false },
    { label: 'Finance', icon: 'wallet', active: false },
    { label: 'Habits', icon: 'flame', active: false },
    { label: 'Pomodoro', icon: 'timer', active: false },
  ];

  protected readonly mockTasks = [
    { title: 'Finish API documentation', done: true },
    { title: 'Complete financial review', done: true },
    { title: 'Plan weekend trip', done: false },
    { title: 'Review monthly budget', done: false },
  ];

  protected readonly mockAccounts = [
    { name: 'BCA', type: 'Bank', balance: 'Rp12,4jt', dot: 'bg-primary' },
    { name: 'GoPay', type: 'E-wallet', balance: 'Rp845rb', dot: 'bg-success' },
    { name: 'Ajaib', type: 'Investment', balance: 'Rp62,5jt', dot: 'bg-secondary' },
  ];

  protected readonly mockHabits = [
    { name: 'Exercise', streak: '12-day streak', days: [true, true, true, true, true, true, true] },
    { name: 'Read 30 minutes', streak: '8-day streak', days: [true, true, false, true, true, true, false] },
    { name: 'Drink 2L water', streak: '21-day streak', days: [true, true, true, true, true, true, true] },
  ];

  protected readonly reviewCategories = [
    { label: 'Food & Drinks', amount: 'Rp1,2jt', percent: 78, bar: 'bg-primary' },
    { label: 'Transport', amount: 'Rp520rb', percent: 46, bar: 'bg-success' },
    { label: 'Entertainment', amount: 'Rp410rb', percent: 34, bar: 'bg-warning' },
  ];

  protected readonly reviewBudgets = [
    { label: 'Food & Drinks', used: '88%', status: 'On track' },
    { label: 'Entertainment', used: '120%', status: 'Over' },
  ];

  protected readonly searchResults = [
    { icon: 'list-todo', title: 'Finish API documentation', type: 'Task' },
    { icon: 'wallet', title: 'GoPay top-up 50rb', type: 'Transaction' },
    { icon: 'sticky-note', title: 'Weekly planning', type: 'Note' },
    { icon: 'layout-dashboard', title: 'Go to Finance', type: 'Action' },
  ];

  constructor() {
    // SEO must follow the active language — re-run whenever it changes.
    effect(() => {
      this.i18n.lang();
      this.seo.setPage({
        title: this.i18n.t('LifeHub — Your Life. One Hub.'),
        description: this.i18n.t(
          'Manage your finances, tasks, goals, habits, and productivity in one personal life management platform.'
        ),
        path: '/',
        type: 'software.application',
      });
    });
  }

  ngAfterViewInit(): void {
    // Scroll-reveal — fade/slide sections in once, respecting reduced motion
    // (the CSS media query disables the transition entirely).
    const elements = this.el.nativeElement.querySelectorAll('[data-reveal]');
    if (typeof IntersectionObserver === 'undefined') {
      elements.forEach((el: HTMLElement) => el.classList.add('is-visible'));
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            entry.target.classList.add('is-visible');
            observer.unobserve(entry.target);
          }
        }
      },
      { threshold: 0.12, rootMargin: '0px 0px -48px 0px' }
    );
    elements.forEach((el: HTMLElement) => observer.observe(el));
  }

  protected startRoute(): string {
    return this.auth.isAuthenticated() ? '/app/today' : '/register';
  }
}
