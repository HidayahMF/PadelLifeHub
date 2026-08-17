import { Component, inject, OnInit } from '@angular/core';
import { RouterLink } from '@angular/router';
import { IconComponent } from '../../../layout/components/icon.component';
import { SeoService } from '../../../core/services/seo.service';
import { PublicNavbarComponent } from '../shared/public-navbar.component';
import { PublicFooterComponent } from '../shared/public-footer.component';

const STACK = [
  'Angular 21 (standalone + signals)',
  'Express.js',
  'MongoDB Atlas',
  'Tailwind CSS',
  'Google Identity Services',
  'Gemini AI',
  'Cloudinary',
  'Vercel',
];

@Component({
  selector: 'app-about',
  standalone: true,
  imports: [RouterLink, IconComponent, PublicNavbarComponent, PublicFooterComponent],
  template: `
    <div class="min-h-dvh bg-bg">
      <app-public-navbar />

      <main>
        <!-- Hero -->
        <section class="relative overflow-hidden border-b-2 border-ink bg-surface">
          <div class="neo-dots pointer-events-none absolute inset-0 opacity-25"></div>
          <div class="relative mx-auto max-w-6xl px-4 py-14 text-center lg:px-6 lg:py-20">
            <p class="inline-flex items-center gap-2 rounded-button border-2 border-ink bg-primary px-3 py-1.5 text-xs font-bold uppercase tracking-widest text-ink shadow-soft">
              <app-icon name="info" [size]="14" />
              About
            </p>
            <h1 class="mt-5 font-display text-4xl text-ink sm:text-5xl">Why LifeHub exists.</h1>
            <p class="mx-auto mt-4 max-w-2xl text-base font-medium text-ink-soft">
              A personal life management platform that brings productivity, personal finance,
              habits, and goals into one place — with an AI assistant that understands it all.
            </p>
          </div>
        </section>

        <!-- Story -->
        <section class="mx-auto max-w-6xl px-4 py-14 lg:px-6 lg:py-16">
          <div class="grid grid-cols-1 gap-12 lg:grid-cols-2">
            <div>
              <h2 class="font-display text-2xl text-ink sm:text-3xl">What is LifeHub?</h2>
              <div class="mt-4 space-y-4 text-sm font-medium leading-relaxed text-ink-soft">
                <p>
                  LifeHub is an all-in-one personal dashboard for running your life. Instead of
                  juggling a task app, a finance tracker, a habit tracker, and a notes app, LifeHub
                  keeps everything in one place — and connects the dots between them.
                </p>
                <p>
                  It started with a simple problem: <strong class="text-ink">life data lives in too many apps</strong>.
                  Your tasks say one thing, your bank account says another, and nothing talks to
                  each other. LifeHub brings them together so you can see the whole picture instead
                  of isolated fragments.
                </p>
                <p>
                  Today it includes personal finance, tasks, habits, goals, calendar, notes,
                  wishlist &amp; needs, Pomodoro, statistics, weekly and monthly reviews, and LifeHub
                  AI — an assistant that reads your own data to answer questions and suggest next
                  steps.
                </p>
              </div>
            </div>

            <div class="space-y-4">
              <div class="rounded-card border-2 border-ink bg-surface p-5 shadow-soft">
                <h3 class="flex items-center gap-2 font-display text-base text-ink">
                  <app-icon name="alert-circle" [size]="18" class="text-warning" />
                  The problem
                </h3>
                <p class="mt-2 text-sm font-medium leading-relaxed text-ink-soft">
                  Personal productivity and personal finance are usually tracked in separate tools
                  with separate logins and separate mental models — so “I have no idea where my
                  money went” and “I keep missing my own deadlines” stay true no matter how many
                  apps you install.
                </p>
              </div>
              <div class="rounded-card border-2 border-ink bg-surface p-5 shadow-soft">
                <h3 class="flex items-center gap-2 font-display text-base text-ink">
                  <app-icon name="target" [size]="18" class="text-success" />
                  The philosophy
                </h3>
                <p class="mt-2 text-sm font-medium leading-relaxed text-ink-soft">
                  One source of truth for your life. Data you track in one area should inform the
                  others: a transaction you log feeds your budget, budget progress shows up on your
                  dashboard, and LifeHub AI can reason across all of it. Simple, private, and
                  no-nonsense — the UI is deliberately brutal-simple so the data stays the hero.
                </p>
              </div>
              <div class="rounded-card border-2 border-ink bg-surface p-5 shadow-soft">
                <h3 class="flex items-center gap-2 font-display text-base text-ink">
                  <app-icon name="sparkles" [size]="18" class="text-primary-strong" />
                  The purpose
                </h3>
                <p class="mt-2 text-sm font-medium leading-relaxed text-ink-soft">
                  LifeHub is a full-stack project built to prove the whole loop: a real
                  authentication system, a real database, real-time tracking across domains, and a
                  production-ready AI integration — end to end.
                </p>
              </div>
            </div>
          </div>
        </section>

        <!-- Feature overview -->
        <section class="border-t-2 border-ink bg-surface">
          <div class="mx-auto max-w-6xl px-4 py-14 lg:px-6 lg:py-16">
            <h2 class="font-display text-2xl text-ink sm:text-3xl">What’s inside</h2>
            <div class="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              @for (pillar of pillars; track pillar.title) {
                <div class="rounded-card border-2 border-ink bg-bg p-5 shadow-soft">
                  <span class="flex h-10 w-10 items-center justify-center rounded-[10px] border-2 border-ink bg-primary shadow-soft">
                    <app-icon [name]="pillar.icon" [size]="18" />
                  </span>
                  <h3 class="mt-3 font-display text-base text-ink">{{ pillar.title }}</h3>
                  <p class="mt-1.5 text-sm font-medium text-ink-soft">{{ pillar.text }}</p>
                </div>
              }
            </div>
          </div>
        </section>

        <!-- Tech stack -->
        <section class="border-t-2 border-ink bg-bg">
          <div class="mx-auto max-w-6xl px-4 py-14 lg:px-6">
            <h2 class="text-center font-display text-2xl text-ink sm:text-3xl">Built with</h2>
            <ul class="mt-6 flex flex-wrap items-center justify-center gap-3">
              @for (tech of STACK; track tech) {
                <li
                  class="rounded-button border-2 border-ink bg-surface px-4 py-2 text-sm font-bold text-ink shadow-soft transition-all duration-150 hover:-translate-y-[1px] hover:bg-primary-strong"
                >
                  {{ tech }}
                </li>
              }
            </ul>
          </div>
        </section>

        <!-- CTA -->
        <section class="border-t-2 border-ink bg-primary">
          <div class="mx-auto max-w-3xl px-4 py-14 text-center lg:px-6">
            <h2 class="font-display text-3xl text-ink">Curious what it feels like?</h2>
            <div class="mt-7 flex flex-wrap items-center justify-center gap-3">
              <a
                routerLink="/register"
                class="inline-flex items-center gap-2 rounded-button border-2 border-ink bg-surface px-6 py-3 text-base font-bold text-ink shadow-soft transition-all duration-150 hover:-translate-y-[1px] hover:bg-surface-2 active:translate-x-[2px] active:translate-y-[2px] active:shadow-none"
              >
                Try LifeHub
                <app-icon name="arrow-right" [size]="17" />
              </a>
              <a
                routerLink="/contact"
                class="inline-flex items-center rounded-button border-2 border-ink bg-ink px-6 py-3 text-base font-bold text-primary shadow-soft transition-all duration-150 hover:-translate-y-[1px] hover:opacity-90 active:translate-x-[2px] active:translate-y-[2px] active:shadow-none"
              >
                Contact the developer
              </a>
            </div>
          </div>
        </section>
      </main>

      <app-public-footer />
    </div>
  `,
})
export class AboutComponent implements OnInit {
  private seo = inject(SeoService);

  protected readonly STACK = STACK;

  protected readonly pillars = [
    {
      icon: 'wallet',
      title: 'Finance',
      text: 'Accounts, transactions, budgets, net worth, and spending insights.',
    },
    {
      icon: 'list-todo',
      title: 'Productivity',
      text: 'Tasks, habits, goals, calendar, and Pomodoro focus.',
    },
    {
      icon: 'sticky-note',
      title: 'Personal',
      text: 'Notes, wishlist & needs, and guided weekly & monthly reviews.',
    },
    {
      icon: 'bot',
      title: 'Intelligence',
      text: 'LifeHub AI, global search, dashboard, and notifications.',
    },
  ];

  ngOnInit(): void {
    this.seo.setPage({
      title: 'About LifeHub — The Story Behind the Platform',
      description:
        'LifeHub is a personal life management platform: tasks, personal finance, habits, goals, notes, and an AI assistant in one place. Learn about the problem it solves and how it is built.',
      path: '/about',
    });
  }
}
