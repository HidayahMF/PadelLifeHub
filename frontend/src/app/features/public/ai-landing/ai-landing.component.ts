import { Component, effect, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { IconComponent } from '../../../layout/components/icon.component';
import { AuthService } from '../../../core/services/auth.service';
import { SeoService } from '../../../core/services/seo.service';
import { I18nService } from '../../../core/services/i18n.service';
import { PublicNavbarComponent } from '../shared/public-navbar.component';
import { PublicFooterComponent } from '../shared/public-footer.component';

interface AiUseCase {
  icon: string;
  title: string;
  description: string;
}

const USE_CASES: AiUseCase[] = [
  {
    icon: 'list-todo',
    title: 'Daily planning',
    description:
      'LifeHub AI looks at today’s tasks, overdue items, habits, goals, and reminders — then suggests a realistic schedule for your day.',
  },
  {
    icon: 'wallet',
    title: 'Financial insights',
    description:
      'Ask why your spending went up this month. LifeHub AI analyzes your recorded income, expenses, budgets, accounts, investments, and spending patterns for context-aware answers.',
  },
  {
    icon: 'zap',
    title: 'Productivity suggestions',
    description:
      'Get concrete next steps based on what you actually track — deadlines, streaks, and progress — not generic advice.',
  },
  {
    icon: 'target',
    title: 'Goal planning',
    description:
      'See which goals are at risk of slipping and what monthly progress you need to stay on track.',
  },
  {
    icon: 'flame',
    title: 'Habit insights',
    description:
      'Spot your most consistent habits and the ones that are fading, with practical ways to protect your streaks.',
  },
  {
    icon: 'message-square',
    title: 'General assistant',
    description:
      'Ask anything about your LifeHub data — the AI answers from your data, in your language.',
  },
];

@Component({
  selector: 'app-ai-landing',
  standalone: true,
  imports: [RouterLink, IconComponent, PublicNavbarComponent, PublicFooterComponent],
  template: `
    <div class="min-h-dvh bg-bg">
      <app-public-navbar />

      <main>
        <!-- Hero -->
        <section class="relative overflow-hidden border-b-2 border-ink">
          <div class="neo-dots pointer-events-none absolute inset-0 opacity-25"></div>
          <div
            aria-hidden="true"
            class="pointer-events-none absolute inset-0 hidden lg:block"
          >
            <div class="absolute right-[10%] top-[16%] h-16 w-16 rotate-6 rounded-[14px] border-2 border-ink bg-accent shadow-soft"></div>
            <div class="absolute bottom-[14%] right-[6%] h-10 w-10 -rotate-12 rounded-full border-2 border-ink bg-secondary shadow-soft"></div>
          </div>

          <div class="relative mx-auto max-w-6xl px-4 py-16 lg:px-6 lg:py-24">
            <div class="mx-auto max-w-3xl text-center">
              <p
                class="inline-flex items-center gap-2 rounded-button border-2 border-ink bg-primary px-3 py-1.5 text-xs font-bold uppercase tracking-widest text-ink shadow-soft"
              >
                <img src="assets/LifeHubAI.png" alt="" class="h-5 w-5 shrink-0 object-contain" />
                LifeHub AI
              </p>
              <h1 class="mt-6 font-display text-5xl text-ink sm:text-6xl">
                {{ t('Your data.') }}
                <span class="box-decoration-clone bg-primary px-2 shadow-[5px_5px_0_0_var(--color-ink)]">
                  {{ t('Your assistant.') }}
                </span>
              </h1>
              <p class="mx-auto mt-6 max-w-2xl text-base font-medium text-ink-soft sm:text-lg">
                {{ t('LifeHub AI is a personal productivity and finance assistant built into LifeHub. It reads your own data — tasks, transactions, budgets, accounts, habits, goals, and investments — so its advice is about your life, not a generic chatbot.') }}
              </p>
              <div class="mt-8 flex flex-wrap items-center justify-center gap-3">
                <a
                  [routerLink]="ctaRoute()"
                  class="inline-flex items-center gap-2 rounded-button border-2 border-ink bg-primary px-6 py-3.5 text-base font-bold text-ink shadow-soft transition-all duration-150 hover:-translate-y-[2px] hover:bg-primary-strong active:translate-x-[2px] active:translate-y-[2px] active:shadow-none"
                >
                  <app-icon name="bot" [size]="18" />
                  {{ ctaLabel() }}
                </a>
                <a
                  routerLink="/register"
                  class="inline-flex items-center gap-2 rounded-button border-2 border-ink bg-surface px-6 py-3.5 text-base font-bold text-ink shadow-soft transition-all duration-150 hover:-translate-y-[2px] hover:bg-surface-2 active:translate-x-[2px] active:translate-y-[2px] active:shadow-none"
                >
                  {{ t('Create a free account') }}
                </a>
              </div>
            </div>
          </div>
        </section>

        <!-- Example conversation -->
        <section class="border-b-2 border-ink bg-surface">
          <div class="mx-auto max-w-4xl px-4 py-14 lg:px-6">
            <div class="rounded-card border-2 border-ink bg-bg p-5 shadow-card sm:p-7">
              <!-- User -->
              <div class="flex justify-end">
                <div class="max-w-[85%] rounded-card border-2 border-ink bg-primary px-4 py-3 shadow-soft">
                  <p class="text-sm font-semibold text-ink">
                    {{ t('“Why did my spending go up this month?”') }}
                  </p>
                </div>
              </div>
              <!-- AI -->
              <div class="mt-4 flex gap-3">
                <span
                  class="flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] border-2 border-ink bg-accent text-white shadow-soft"
                >
                  <app-icon name="bot" [size]="17" />
                </span>
                <div class="max-w-[85%] rounded-card border-2 border-ink bg-surface px-4 py-3 shadow-soft">
                  <p class="text-sm font-semibold text-ink">LifeHub AI</p>
                  <p class="mt-1.5 text-sm font-medium leading-relaxed text-ink-soft">
                    {{ t('My spending this month is up about 18% compared to last month, mostly from Food & dining (+Rp 320.000) and Entertainment (+Rp 210.000). Your Food budget is 78% used. Try cutting down on eating out this week to get back on track.') }}
                  </p>
                  <div class="mt-3 flex flex-wrap gap-1.5">
                    <span class="rounded-md border-2 border-ink bg-surface-2 px-2 py-0.5 text-[11px] font-bold text-ink">
                      {{ t('+18% expense') }}
                    </span>
                    <span class="rounded-md border-2 border-ink bg-surface-2 px-2 py-0.5 text-[11px] font-bold text-ink">
                      {{ t('Food budget 78%') }}
                    </span>
                    <span class="rounded-md border-2 border-ink bg-surface-2 px-2 py-0.5 text-[11px] font-bold text-ink">
                      {{ t('Actionable tip') }}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <!-- Use cases -->
        <section class="border-b-2 border-ink bg-bg">
          <div class="mx-auto max-w-6xl px-4 py-14 lg:px-6 lg:py-16">
            <div class="mx-auto max-w-2xl text-center">
              <p class="text-xs font-bold uppercase tracking-widest text-primary-strong">
                {{ t('What it can do') }}
              </p>
              <h2 class="mt-3 font-display text-3xl text-ink sm:text-4xl">
                {{ t('Built for your everyday questions.') }}
              </h2>
            </div>
            <div class="mt-10 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
              @for (useCase of USE_CASES; track useCase.title) {
                <article
                  class="rounded-card border-2 border-ink bg-surface p-5 shadow-soft transition-all duration-200 hover:-translate-y-1 hover:shadow-card"
                >
                  <span
                    class="flex h-11 w-11 items-center justify-center rounded-[10px] border-2 border-ink bg-accent text-white shadow-soft"
                  >
                    <app-icon [name]="useCase.icon" [size]="19" />
                  </span>
                  <h3 class="mt-4 font-display text-base text-ink">{{ t(useCase.title) }}</h3>
                  <p class="mt-2 text-sm font-medium leading-relaxed text-ink-soft">
                    {{ t(useCase.description) }}
                  </p>
                </article>
              }
            </div>
          </div>
        </section>

        <!-- How it works -->
        <section class="border-b-2 border-ink bg-surface">
          <div class="mx-auto max-w-6xl px-4 py-14 lg:px-6 lg:py-16">
            <div class="mx-auto max-w-2xl text-center">
              <p class="text-xs font-bold uppercase tracking-widest text-primary-strong">
                {{ t('Private by design') }}
              </p>
              <h2 class="mt-3 font-display text-3xl text-ink sm:text-4xl">
                {{ t('Your data stays yours.') }}
              </h2>
            </div>
            <div class="mt-10 grid grid-cols-1 gap-5 sm:grid-cols-3">
              @for (step of privacySteps; track step.title) {
                <div class="rounded-card border-2 border-ink bg-bg p-5 shadow-soft">
                  <span
                    class="flex h-10 w-10 items-center justify-center rounded-[10px] border-2 border-ink bg-primary font-display text-sm text-ink shadow-soft"
                  >
                    {{ step.step }}
                  </span>
                  <h3 class="mt-3 font-display text-base text-ink">{{ t(step.title) }}</h3>
                  <p class="mt-1.5 text-sm font-medium text-ink-soft">{{ t(step.text) }}</p>
                </div>
              }
            </div>
          </div>
        </section>

        <!-- CTA -->
        <section class="bg-accent">
          <div class="mx-auto max-w-3xl px-4 py-14 text-center lg:px-6">
            <h2 class="font-display text-3xl text-primary sm:text-4xl">
              {{ t('Ask your LifeHub about your life.') }}
            </h2>
            <p class="mx-auto mt-3 max-w-lg text-base font-medium text-primary/80">
              {{ t('Sign in and open LifeHub AI from the sidebar — quick actions for finances, daily planning, habits, and goals are one click away.') }}
            </p>
            <a
              [routerLink]="ctaRoute()"
              class="mt-7 inline-flex items-center gap-2 rounded-button border-2 border-ink bg-primary px-6 py-3 text-base font-bold text-ink shadow-soft transition-all duration-150 hover:-translate-y-[1px] hover:bg-primary-strong active:translate-x-[2px] active:translate-y-[2px] active:shadow-none"
            >
              <app-icon name="bot" [size]="17" />
              {{ ctaLabel() }}
            </a>
          </div>
        </section>
      </main>

      <app-public-footer />
    </div>
  `,
})
export class AiLandingComponent {
  private seo = inject(SeoService);
  private auth = inject(AuthService);
  private i18n = inject(I18nService);

  protected readonly t = this.i18n.t.bind(this.i18n);
  protected readonly USE_CASES = USE_CASES;

  protected readonly privacySteps = [
    {
      step: '01',
      title: 'Only your data',
      text: 'The AI reads only the LifeHub data belonging to your account — nothing else.',
    },
    {
      step: '02',
      title: 'Minimized context',
      text: 'The backend sends a compact summary of what is needed to answer, never raw private documents.',
    },
    {
      step: '03',
      title: 'No storage',
      text: 'Conversations are not saved to the database. Ask, get your answer, move on.',
    },
  ];

  constructor() {
    effect(() => {
      this.i18n.lang();
      this.seo.setPage({
        title: this.i18n.t('LifeHub AI — Personal Productivity & Finance Assistant'),
        description: this.i18n.t(
          'LifeHub AI is a personal productivity and finance assistant inside LifeHub. It analyzes your tasks, finances, habits, and goals to give practical, personalized advice.'
        ),
        path: '/ai',
      });
    });
  }

  protected ctaRoute(): string {
    return this.auth.isAuthenticated() ? '/app/ai' : '/login';
  }

  protected ctaLabel(): string {
    return this.auth.isAuthenticated() ? this.t('Open LifeHub AI') : this.t('Try LifeHub AI');
  }
}
