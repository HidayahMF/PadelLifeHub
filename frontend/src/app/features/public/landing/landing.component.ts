import { Component, inject, OnInit } from '@angular/core';
import { RouterLink } from '@angular/router';
import { IconComponent } from '../../../layout/components/icon.component';
import { AuthService } from '../../../core/services/auth.service';
import { SeoService } from '../../../core/services/seo.service';
import { PublicNavbarComponent } from '../shared/public-navbar.component';
import { PublicFooterComponent } from '../shared/public-footer.component';

interface Feature {
  icon: string;
  title: string;
  description: string;
  tone: string;
  /** Optional brand image shown instead of the icon (e.g. the LifeHub AI logo). */
  image?: string;
}

const FEATURES: Feature[] = [
  {
    icon: 'wallet',
    title: 'Finance',
    description: 'Track accounts, income, expenses, budgets, and spending categories in one ledger.',
    tone: 'bg-success',
  },
  {
    icon: 'list-todo',
    title: 'Tasks',
    description: 'Deadlines, reminders, recurring tasks, priorities, categories, and tags.',
    tone: 'bg-primary',
  },
  {
    icon: 'flame',
    title: 'Habits',
    description: 'Build streaks and keep the momentum with daily habit tracking.',
    tone: 'bg-secondary',
  },
  {
    icon: 'target',
    title: 'Goals',
    description: 'Set targets, track progress over time, and hit your deadlines.',
    tone: 'bg-warning',
  },
  {
    icon: 'calendar-days',
    title: 'Calendar',
    description: 'Plan your days with tasks, reminders, and events in one view.',
    tone: 'bg-primary-strong',
  },
  {
    icon: 'sticky-note',
    title: 'Notes',
    description: 'Capture thoughts instantly and find them again with global search.',
    tone: 'bg-surface-2',
  },
  {
    icon: 'gift',
    title: 'Wishlist & Needs',
    description: 'Save the things you want, plan what you need, and track savings toward them.',
    tone: 'bg-secondary',
  },
  {
    icon: 'timer',
    title: 'Pomodoro',
    description: 'Focus in timed sessions and protect deep work from interruptions.',
    tone: 'bg-danger',
  },
  {
    icon: 'bot',
    title: 'LifeHub AI',
    description: 'Ask questions about your own data and get practical, personalized advice.',
    tone: 'bg-accent',
    image: 'assets/LifeHubAI.png',
  },
];

const HOW_IT_WORKS = [
  { step: '01', title: 'Create your account', text: 'Sign up in seconds — email or Google.' },
  { step: '02', title: 'Set up your life', text: 'Add accounts, categories, habits, and goals.' },
  { step: '03', title: 'Track everything', text: 'Log tasks and transactions as you go.' },
  { step: '04', title: 'Get insights', text: 'See patterns with dashboards, statistics, and AI.' },
  { step: '05', title: 'Improve every day', text: 'Weekly reviews and habit streaks keep you moving.' },
];

const TECH_STACK = [
  'Angular',
  'Express.js',
  'MongoDB Atlas',
  'Tailwind CSS',
  'Google Identity Services',
  'Gemini AI',
  'Cloudinary',
  'Vercel',
];

@Component({
  selector: 'app-landing',
  standalone: true,
  imports: [RouterLink, IconComponent, PublicNavbarComponent, PublicFooterComponent],
  template: `
    <div class="min-h-dvh overflow-x-clip bg-bg">
      <app-public-navbar />

      <main>
        <!-- ── Hero ─────────────────────────────────────────────── -->
        <section class="relative overflow-hidden">
          <div class="neo-dots pointer-events-none absolute inset-0 opacity-30"></div>
          <div aria-hidden="true" class="pointer-events-none absolute inset-0 hidden lg:block">
            <div class="absolute left-[6%] top-[14%] h-20 w-20 rotate-6 rounded-[16px] border-2 border-ink bg-primary shadow-soft"></div>
            <div class="absolute bottom-[18%] left-[12%] h-14 w-14 -rotate-12 rounded-full border-2 border-ink bg-secondary shadow-soft"></div>
            <div class="absolute left-[38%] top-[10%] h-4 w-4 rounded-full border-2 border-ink bg-accent"></div>
            <div class="neo-stripes absolute right-[5%] top-[18%] h-6 w-28 rotate-3 border-2 border-ink"></div>
          </div>

          <div class="relative mx-auto grid max-w-6xl grid-cols-1 items-center gap-12 px-4 py-16 lg:grid-cols-2 lg:gap-10 lg:px-6 lg:py-24">
            <!-- Copy -->
            <div>
              <p
                class="inline-flex items-center gap-2 rounded-button border-2 border-ink bg-surface px-3 py-1.5 text-xs font-bold uppercase tracking-widest text-ink shadow-soft"
              >
                <app-icon name="sparkles" [size]="14" />
                Personal Life Management Platform
              </p>

              <h1
                class="mt-6 font-display text-5xl leading-[1.02] tracking-tight text-ink sm:text-6xl lg:text-7xl"
              >
                Life,
                <span class="relative inline-block">
                  <span
                    class="absolute -inset-x-1 -inset-y-1 -rotate-1 border-2 border-ink bg-primary shadow-[6px_6px_0_0_var(--color-ink)]"
                  ></span>
                  <span class="relative px-2">organized.</span>
                </span>
              </h1>

              <p class="mt-6 max-w-lg text-base font-medium text-ink-soft sm:text-lg">
                LifeHub brings your personal finance, tasks, habits, goals, calendar, notes,
                wishlist, and an AI assistant into one brutal-simple workspace — so you can run
                your whole life from a single dashboard.
              </p>

              <div class="mt-8 flex flex-wrap gap-3">
                <a
                  [routerLink]="startRoute()"
                  class="inline-flex items-center gap-2 rounded-button border-2 border-ink bg-primary px-6 py-3.5 text-base font-bold text-ink shadow-soft transition-all duration-150 hover:-translate-y-[2px] hover:bg-primary-strong active:translate-x-[2px] active:translate-y-[2px] active:shadow-none"
                >
                  Get Started
                  <app-icon name="arrow-right" [size]="18" />
                </a>
                <a
                  routerLink="/features"
                  class="inline-flex items-center gap-2 rounded-button border-2 border-ink bg-surface px-6 py-3.5 text-base font-bold text-ink shadow-soft transition-all duration-150 hover:-translate-y-[2px] hover:bg-surface-2 active:translate-x-[2px] active:translate-y-[2px] active:shadow-none"
                >
                  Explore Features
                </a>
                <a
                  routerLink="/ai"
                  class="inline-flex items-center gap-2 rounded-button border-2 border-ink bg-surface-2 px-6 py-3.5 text-base font-bold text-ink shadow-soft transition-all duration-150 hover:-translate-y-[2px] hover:bg-primary-strong active:translate-x-[2px] active:translate-y-[2px] active:shadow-none"
                >
                  <app-icon name="bot" [size]="18" />
                  Try LifeHub AI
                </a>
              </div>

              <ul class="mt-8 flex flex-wrap gap-2.5">
                @for (chip of heroChips; track chip) {
                  <li
                    class="rounded-[10px] border-2 border-ink bg-surface px-3 py-1.5 text-xs font-bold text-ink shadow-[2px_2px_0_0_var(--color-ink)]"
                  >
                    {{ chip }}
                  </li>
                }
              </ul>
            </div>

            <!-- Product mockup -->
            <div class="relative mx-auto w-full max-w-xl lg:mx-0">
              <div
                aria-hidden="true"
                class="absolute -inset-3 rotate-2 rounded-card border-2 border-ink bg-primary shadow-soft"
              ></div>
              <div class="relative overflow-hidden rounded-card border-2 border-ink bg-surface shadow-pop">
                <!-- Window chrome -->
                <div class="flex items-center gap-2 border-b-2 border-ink bg-surface-2 px-4 py-3">
                  <span class="h-3 w-3 rounded-full border-2 border-ink bg-danger"></span>
                  <span class="h-3 w-3 rounded-full border-2 border-ink bg-warning"></span>
                  <span class="h-3 w-3 rounded-full border-2 border-ink bg-success"></span>
                  <span class="ml-3 flex-1 truncate rounded-md border-2 border-ink bg-surface px-3 py-1 text-[11px] font-bold text-ink-faint">
                    app.lifehub.id/dashboard
                  </span>
                </div>

                <div class="flex">
                  <!-- Mock sidebar -->
                  <div class="hidden w-28 shrink-0 border-r-2 border-ink bg-surface-2 p-3 sm:block">
                    <div class="flex items-center gap-1.5 rounded-md border-2 border-ink bg-primary px-2 py-1.5">
                      <img src="assets/logolifehub.png" alt="" class="h-4 w-4" />
                      <span class="font-display text-[10px] text-ink">LH</span>
                    </div>
                    <ul class="mt-3 space-y-1.5">
                      @for (item of mockSidebar; track item.label) {
                        <li
                          class="flex items-center gap-1.5 rounded-md px-2 py-1.5 text-[10px] font-bold"
                          [class]="item.active ? 'bg-primary text-ink shadow-[2px_2px_0_0_var(--color-ink)]' : 'text-ink-faint'"
                        >
                          <app-icon [name]="item.icon" [size]="12" />
                          {{ item.label }}
                        </li>
                      }
                    </ul>
                  </div>

                  <!-- Mock content -->
                  <div class="min-w-0 flex-1 space-y-3 p-4">
                    <div class="flex items-center justify-between gap-2">
                      <div>
                        <p class="font-display text-sm text-ink">Good morning 👋</p>
                        <p class="text-[10px] font-semibold text-ink-faint">Saturday, 15 August</p>
                      </div>
                      <span class="rounded-md border-2 border-ink bg-primary px-2 py-1 text-[10px] font-bold text-ink">
                        + Add
                      </span>
                    </div>

                    <!-- Finance row -->
                    <div class="grid grid-cols-3 gap-2">
                      <div class="rounded-md border-2 border-ink bg-surface p-2 shadow-[2px_2px_0_0_var(--color-ink)]">
                        <p class="text-[9px] font-bold uppercase tracking-wide text-ink-faint">Balance</p>
                        <p class="font-display text-sm text-ink">Rp 12.4jt</p>
                      </div>
                      <div class="rounded-md border-2 border-ink bg-surface p-2 shadow-[2px_2px_0_0_var(--color-ink)]">
                        <p class="text-[9px] font-bold uppercase tracking-wide text-ink-faint">Income</p>
                        <p class="font-display text-sm text-success">+8jt</p>
                      </div>
                      <div class="rounded-md border-2 border-ink bg-surface p-2 shadow-[2px_2px_0_0_var(--color-ink)]">
                        <p class="text-[9px] font-bold uppercase tracking-wide text-ink-faint">Expense</p>
                        <p class="font-display text-sm text-danger">−4.5jt</p>
                      </div>
                    </div>

                    <!-- Tasks -->
                    <div class="rounded-md border-2 border-ink bg-surface p-2.5">
                      <p class="flex items-center gap-1 text-[10px] font-bold text-ink">
                        <app-icon name="list-todo" [size]="11" /> Today's tasks
                      </p>
                      <ul class="mt-2 space-y-1.5">
                        @for (task of mockTasks; track task.title) {
                          <li class="flex items-center gap-2 text-[10px] font-medium text-ink">
                            <span
                              class="flex h-3.5 w-3.5 items-center justify-center rounded-full border-2"
                              [class]="task.done ? 'border-success bg-success' : 'border-ink-faint'"
                            >
                              @if (task.done) {
                                <app-icon name="check" [size]="8" [strokeWidth]="3" class="text-surface" />
                              }
                            </span>
                            <span [class.line-through]="task.done" [class.text-ink-faint]="task.done">
                              {{ task.title }}
                            </span>
                          </li>
                        }
                      </ul>
                    </div>

                    <!-- Habits -->
                    <div class="flex items-center justify-between rounded-md border-2 border-ink bg-surface p-2.5">
                      <p class="flex items-center gap-1 text-[10px] font-bold text-ink">
                        <app-icon name="flame" [size]="11" /> Exercise · 12-day streak
                      </p>
                      <span class="rounded-full border-2 border-ink bg-success/20 px-2 py-0.5 text-[9px] font-bold text-ink">
                        Done ✓
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              <!-- Floating badges -->
              <div
                class="absolute -left-4 -top-5 rotate-[-4deg] rounded-[12px] border-2 border-ink bg-secondary px-3 py-1.5 text-xs font-bold text-ink shadow-soft animate-float"
                style="--tilt: -4deg"
              >
                💰 Budget on track
              </div>
              <div
                class="absolute -bottom-5 -right-3 rotate-3 rounded-[12px] border-2 border-ink bg-primary px-3 py-1.5 text-xs font-bold text-ink shadow-soft animate-float-slow"
                style="--tilt: 3deg"
              >
                ✨ AI: save Rp 200k this month
              </div>
            </div>
          </div>
        </section>

        <!-- ── Features grid ────────────────────────────────────── -->
        <section id="features" class="border-t-2 border-ink bg-surface">
          <div class="mx-auto max-w-6xl px-4 py-16 lg:px-6 lg:py-20">
            <div class="max-w-2xl">
              <p class="text-xs font-bold uppercase tracking-widest text-primary-strong">Everything in one place</p>
              <h2 class="mt-3 font-display text-3xl text-ink sm:text-4xl">
                One app for the whole picture of your life.
              </h2>
              <p class="mt-4 text-base font-medium text-ink-soft">
                Stop juggling five apps. LifeHub connects your money, time, habits, and goals so
                every part of your life stays in sync.
              </p>
            </div>

            <div class="mt-10 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
              @for (feature of FEATURES; track feature.title) {
                <article
                  class="group rounded-card border-2 border-ink bg-bg p-6 shadow-soft transition-all duration-200 hover:-translate-y-1 hover:shadow-card"
                >
                  <span
                    class="flex h-12 w-12 items-center justify-center rounded-[12px] border-2 border-ink shadow-soft transition-transform duration-200 group-hover:-rotate-6"
                    [class]="feature.tone"
                  >
                    @if (feature.image) {
                      <img
                        [src]="feature.image"
                        [alt]="feature.title + ' logo'"
                        class="h-8 w-8 object-contain"
                      />
                    } @else {
                      <app-icon [name]="feature.icon" [size]="22" />
                    }
                  </span>
                  <h3 class="mt-4 font-display text-lg text-ink">{{ feature.title }}</h3>
                  <p class="mt-2 text-sm font-medium leading-relaxed text-ink-soft">
                    {{ feature.description }}
                  </p>
                </article>
              }
            </div>

            <div class="mt-10 text-center">
              <a
                routerLink="/features"
                class="inline-flex items-center gap-2 rounded-button border-2 border-ink bg-primary px-6 py-3 text-sm font-bold text-ink shadow-soft transition-all duration-150 hover:-translate-y-[1px] hover:bg-primary-strong active:translate-x-[2px] active:translate-y-[2px] active:shadow-none"
              >
                See every feature
                <app-icon name="arrow-right" [size]="16" />
              </a>
            </div>
          </div>
        </section>

        <!-- ── Finance showcase ─────────────────────────────────── -->
        <section class="border-t-2 border-ink bg-bg">
          <div class="mx-auto grid max-w-6xl grid-cols-1 items-center gap-12 px-4 py-16 lg:grid-cols-2 lg:px-6 lg:py-20">
            <div class="order-2 lg:order-1">
              <div class="relative mx-auto w-full max-w-md">
                <div
                  aria-hidden="true"
                  class="absolute -inset-3 -rotate-2 rounded-card border-2 border-ink bg-success shadow-soft"
                ></div>
                <div class="relative rounded-card border-2 border-ink bg-surface p-5 shadow-pop">
                  <div class="flex items-center justify-between">
                    <div>
                      <p class="text-xs font-bold uppercase tracking-wide text-ink-faint">Total balance</p>
                      <p class="mt-1 font-display text-3xl text-ink">Rp 12.400.000</p>
                    </div>
                    <span class="rounded-md border-2 border-ink bg-success/15 px-2.5 py-1.5 text-xs font-bold text-ink">
                      ▲ +18% vs last month
                    </span>
                  </div>

                  <div class="mt-5 grid grid-cols-2 gap-3">
                    <div class="rounded-button border-2 border-ink bg-bg p-3">
                      <p class="text-[11px] font-bold uppercase tracking-wide text-ink-faint">Income</p>
                      <p class="mt-0.5 font-display text-lg text-success">Rp 8.000.000</p>
                    </div>
                    <div class="rounded-button border-2 border-ink bg-bg p-3">
                      <p class="text-[11px] font-bold uppercase tracking-wide text-ink-faint">Expense</p>
                      <p class="mt-0.5 font-display text-lg text-danger">Rp 4.500.000</p>
                    </div>
                  </div>

                  <div class="mt-5">
                    <p class="mb-2.5 text-[11px] font-bold uppercase tracking-wide text-ink-faint">
                      Spending this month
                    </p>
                    <ul class="space-y-2.5">
                      @for (cat of mockCategories; track cat.label) {
                        <li>
                          <div class="mb-1 flex items-center justify-between text-xs">
                            <span class="font-bold text-ink">{{ cat.label }}</span>
                            <span class="font-semibold text-ink-soft">{{ cat.amount }}</span>
                          </div>
                          <div class="h-3 rounded-full border-2 border-ink bg-surface-2">
                            <div
                              class="h-full rounded-full border-r-2 border-ink"
                              [class]="cat.color"
                              [style.width.%]="cat.percent"
                            ></div>
                          </div>
                        </li>
                      }
                    </ul>
                  </div>
                </div>
              </div>
            </div>

            <div class="order-1 lg:order-2">
              <p class="text-xs font-bold uppercase tracking-widest text-primary-strong">Finance</p>
              <h2 class="mt-3 font-display text-3xl text-ink sm:text-4xl">
                Understand where your money goes.
              </h2>
              <p class="mt-4 text-base font-medium text-ink-soft">
                Connect your accounts, log income and expenses, set monthly budgets per category,
                and watch your savings goals grow. No spreadsheets, no guessing.
              </p>
              <ul class="mt-6 space-y-3">
                @for (point of financePoints; track point) {
                  <li class="flex items-start gap-3">
                    <span
                      class="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 border-ink bg-primary text-ink"
                    >
                      <app-icon name="check" [size]="13" [strokeWidth]="3" />
                    </span>
                    <span class="text-sm font-medium text-ink">{{ point }}</span>
                  </li>
                }
              </ul>
              <div class="mt-8">
                <a
                  routerLink="/features"
                  class="inline-flex items-center gap-2 rounded-button border-2 border-ink bg-primary px-6 py-3 text-sm font-bold text-ink shadow-soft transition-all duration-150 hover:-translate-y-[1px] hover:bg-primary-strong active:translate-x-[2px] active:translate-y-[2px] active:shadow-none"
                >
                  Explore Finance
                  <app-icon name="arrow-right" [size]="16" />
                </a>
              </div>
            </div>
          </div>
        </section>

        <!-- ── Productivity showcase ────────────────────────────── -->
        <section class="border-t-2 border-ink bg-surface">
          <div class="mx-auto max-w-6xl px-4 py-16 lg:px-6 lg:py-20">
            <div class="mx-auto max-w-2xl text-center">
              <p class="text-xs font-bold uppercase tracking-widest text-primary-strong">Productivity</p>
              <h2 class="mt-3 font-display text-3xl text-ink sm:text-4xl">
                Turn intentions into daily progress.
              </h2>
              <p class="mt-4 text-base font-medium text-ink-soft">
                Start every day on Today, knock out tasks, keep your streaks alive, and protect
                deep work with Pomodoro — your plan, executed.
              </p>
            </div>

            <div class="mt-10 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
              @for (item of productivityCards; track item.title) {
                <div
                  class="rounded-card border-2 border-ink bg-bg p-5 shadow-soft transition-all duration-200 hover:-translate-y-1 hover:shadow-card"
                >
                  <span class="flex h-10 w-10 items-center justify-center rounded-[10px] border-2 border-ink bg-primary shadow-soft">
                    <app-icon [name]="item.icon" [size]="18" />
                  </span>
                  <h3 class="mt-3 font-display text-base text-ink">{{ item.title }}</h3>
                  <p class="mt-1.5 text-sm font-medium text-ink-soft">{{ item.text }}</p>
                </div>
              }
            </div>
          </div>
        </section>

        <!-- ── LifeHub AI ───────────────────────────────────────── -->
        <section class="border-t-2 border-ink bg-bg">
          <div class="mx-auto max-w-6xl px-4 py-16 lg:px-6 lg:py-20">
            <div class="grid grid-cols-1 items-center gap-12 lg:grid-cols-2">
              <div>
                <p class="inline-flex items-center gap-2 rounded-button border-2 border-ink bg-surface px-3 py-1.5 text-xs font-bold uppercase tracking-widest text-ink shadow-soft">
                  <img src="assets/LifeHubAI.png" alt="LifeHub AI logo" class="h-5 w-5 shrink-0 object-contain" />
                  LifeHub AI
                </p>
                <h2 class="mt-4 font-display text-3xl text-ink sm:text-4xl">Meet LifeHub AI.</h2>
                <p class="mt-4 text-base font-medium text-ink-soft">
                  Not a generic chatbot — LifeHub AI reads your actual LifeHub data and answers
                  questions about it. Ask why your spending went up, plan your day around your real
                  deadlines, or get a read on your habits and goals.
                </p>
                <div class="mt-8">
                  <a
                    routerLink="/ai"
                    class="inline-flex items-center gap-2 rounded-button border-2 border-ink bg-primary px-6 py-3 text-sm font-bold text-ink shadow-soft transition-all duration-150 hover:-translate-y-[1px] hover:bg-primary-strong active:translate-x-[2px] active:translate-y-[2px] active:shadow-none"
                  >
                    <app-icon name="bot" [size]="17" />
                    Try LifeHub AI
                  </a>
                </div>
              </div>

              <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
                @for (useCase of aiUseCases; track useCase.title) {
                  <div class="rounded-card border-2 border-ink bg-surface p-4 shadow-soft">
                    <div class="flex items-center gap-2">
                      <span class="flex h-8 w-8 items-center justify-center rounded-lg border-2 border-ink bg-accent text-white">
                        <app-icon [name]="useCase.icon" [size]="15" />
                      </span>
                      <p class="text-sm font-bold text-ink">{{ useCase.title }}</p>
                    </div>
                    <p class="mt-2 text-xs font-medium leading-relaxed text-ink-soft">
                      {{ useCase.text }}
                    </p>
                  </div>
                }
              </div>
            </div>
          </div>
        </section>

        <!-- ── How it works ─────────────────────────────────────── -->
        <section class="border-t-2 border-ink bg-surface">
          <div class="mx-auto max-w-6xl px-4 py-16 lg:px-6 lg:py-20">
            <div class="mx-auto max-w-2xl text-center">
              <p class="text-xs font-bold uppercase tracking-widest text-primary-strong">How it works</p>
              <h2 class="mt-3 font-display text-3xl text-ink sm:text-4xl">From zero to in control.</h2>
            </div>

            <ol class="mt-10 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-5">
              @for (item of HOW_IT_WORKS; track item.step) {
                <li class="relative rounded-card border-2 border-ink bg-bg p-5 shadow-soft">
                  <span
                    class="flex h-10 w-10 items-center justify-center rounded-[10px] border-2 border-ink bg-primary font-display text-sm text-ink shadow-soft"
                  >
                    {{ item.step }}
                  </span>
                  <h3 class="mt-3 font-display text-base text-ink">{{ item.title }}</h3>
                  <p class="mt-1.5 text-sm font-medium text-ink-soft">{{ item.text }}</p>
                  @if (!$last) {
                    <app-icon
                      name="arrow-right"
                      [size]="18"
                      class="absolute -right-4 top-1/2 hidden -translate-y-1/2 text-ink-faint lg:block"
                    />
                  }
                </li>
              }
            </ol>
          </div>
        </section>

        <!-- ── Tech stack ───────────────────────────────────────── -->
        <section class="border-t-2 border-ink bg-bg">
          <div class="mx-auto max-w-6xl px-4 py-14 lg:px-6">
            <p class="text-center text-xs font-bold uppercase tracking-widest text-ink-faint">
              Built with modern technologies
            </p>
            <ul class="mt-6 flex flex-wrap items-center justify-center gap-3">
              @for (tech of TECH_STACK; track tech) {
                <li
                  class="rounded-button border-2 border-ink bg-surface px-4 py-2 text-sm font-bold text-ink shadow-soft transition-all duration-150 hover:-translate-y-[1px] hover:bg-primary-strong"
                >
                  {{ tech }}
                </li>
              }
            </ul>
          </div>
        </section>

        <!-- ── Final CTA ────────────────────────────────────────── -->
        <section class="border-t-2 border-ink bg-primary">
          <div class="mx-auto max-w-4xl px-4 py-16 text-center lg:px-6 lg:py-20">
            <h2 class="font-display text-3xl text-ink sm:text-4xl">
              Your life has a lot going on. <br class="hidden sm:block" />
              <span class="box-decoration-clone bg-ink px-2 text-primary">Now it fits in one place.</span>
            </h2>
            <p class="mx-auto mt-4 max-w-xl text-base font-medium text-ink">
              Create your free account and start organizing today. No credit card, no setup maze —
              just pick it up and go.
            </p>
            <div class="mt-8 flex flex-wrap items-center justify-center gap-3">
              <a
                [routerLink]="startRoute()"
                class="inline-flex items-center gap-2 rounded-button border-2 border-ink bg-surface px-6 py-3.5 text-base font-bold text-ink shadow-soft transition-all duration-150 hover:-translate-y-[2px] hover:bg-surface-2 active:translate-x-[2px] active:translate-y-[2px] active:shadow-none"
              >
                Get Started
                <app-icon name="arrow-right" [size]="18" />
              </a>
              <a
                routerLink="/login"
                class="inline-flex items-center rounded-button border-2 border-ink bg-ink px-6 py-3.5 text-base font-bold text-primary shadow-soft transition-all duration-150 hover:-translate-y-[2px] hover:opacity-90 active:translate-x-[2px] active:translate-y-[2px] active:shadow-none"
              >
                Log in
              </a>
            </div>
          </div>
        </section>
      </main>

      <app-public-footer />
    </div>
  `,
})
export class LandingComponent implements OnInit {
  private seo = inject(SeoService);
  private auth = inject(AuthService);

  protected readonly FEATURES = FEATURES;
  protected readonly HOW_IT_WORKS = HOW_IT_WORKS;
  protected readonly TECH_STACK = TECH_STACK;

  protected readonly heroChips = [
    '✅ Task manager',
    '💰 Finance tracker',
    '🎯 Goals & habits',
    '⏱ Pomodoro focus',
    '📝 Notes',
    '✨ AI assistant',
  ];

  protected readonly mockSidebar = [
    { label: 'Today', icon: 'calendar-check', active: true },
    { label: 'Dashboard', icon: 'layout-dashboard', active: false },
    { label: 'Tasks', icon: 'list-todo', active: false },
    { label: 'Finance', icon: 'wallet', active: false },
    { label: 'Habits', icon: 'flame', active: false },
  ];

  protected readonly mockTasks = [
    { title: 'Finish API documentation', done: true },
    { title: 'Complete financial review', done: true },
    { title: 'Plan weekend trip', done: false },
    { title: 'Review monthly budget', done: false },
  ];

  protected readonly mockCategories = [
    { label: 'Food & dining', amount: 'Rp 1.200.000', percent: 78, color: 'bg-primary' },
    { label: 'Transport', amount: 'Rp 500.000', percent: 42, color: 'bg-secondary' },
    { label: 'Entertainment', amount: 'Rp 700.000', percent: 58, color: 'bg-success' },
  ];

  protected readonly financePoints = [
    'Accounts, income, expenses, transfers, and budgets in one ledger',
    'Spending breakdown by category — know exactly where it goes',
    'Monthly budget limits with progress at a glance',
    'Savings goals you can fund directly from the dashboard',
  ];

  protected readonly productivityCards = [
    { icon: 'calendar-check', title: "Today's Focus", text: 'A single view of what matters right now.' },
    { icon: 'list-todo', title: 'Tasks', text: 'Deadlines, priorities, and recurring work.' },
    { icon: 'flame', title: 'Habits', text: 'Daily streaks that compound into results.' },
    { icon: 'timer', title: 'Pomodoro', text: 'Focused sessions that protect deep work.' },
  ];

  protected readonly aiUseCases = [
    { icon: 'list-todo', title: 'Daily planning', text: 'A realistic schedule built from your real tasks and deadlines.' },
    { icon: 'wallet', title: 'Financial insights', text: 'Spot spending patterns and get practical money advice.' },
    { icon: 'zap', title: 'Productivity suggestions', text: 'Clear next steps based on what you actually track.' },
    { icon: 'target', title: 'Goal & habit insights', text: 'See what is on track and what needs attention.' },
  ];

  ngOnInit(): void {
    this.seo.setPage({
      title: 'LifeHub — Personal Life Management & Productivity App',
      description:
        'LifeHub is an all-in-one personal life management platform for managing finances, tasks, habits, goals, notes, planning, and productivity in one place.',
      path: '/',
      type: 'software.application',
    });
  }

  protected startRoute(): string {
    return this.auth.isAuthenticated() ? '/app/today' : '/register';
  }
}
