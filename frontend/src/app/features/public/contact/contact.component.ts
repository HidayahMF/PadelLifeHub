import { Component, inject, OnInit } from '@angular/core';
import { RouterLink } from '@angular/router';
import { IconComponent } from '../../../layout/components/icon.component';
import { SITE } from '../../../core/config/site.config';
import { SeoService } from '../../../core/services/seo.service';
import { PublicNavbarComponent } from '../shared/public-navbar.component';
import { PublicFooterComponent } from '../shared/public-footer.component';

interface SocialCard {
  label: string;
  url: string;
  icon: string;
  description: string;
}

@Component({
  selector: 'app-contact',
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
              <app-icon name="user-round" [size]="14" />
              Contact
            </p>
            <h1 class="mt-5 font-display text-4xl text-ink sm:text-5xl">
              Let’s talk about the project.
            </h1>
            <p class="mx-auto mt-4 max-w-2xl text-base font-medium text-ink-soft">
              LifeHub was designed and built by {{ SITE.developer.name }} — a full-stack developer
              who likes products that feel finished. Interested in the project or want to
              collaborate?
            </p>
          </div>
        </section>

        <!-- Developer card -->
        <section class="mx-auto max-w-6xl px-4 py-14 lg:px-6">
          <div class="mx-auto max-w-2xl">
            <div class="relative">
              <div aria-hidden="true" class="absolute -inset-2 rotate-1 rounded-card border-2 border-ink bg-primary shadow-soft"></div>
              <div class="relative rounded-card border-2 border-ink bg-surface p-7 shadow-pop sm:p-8">
                <div class="flex flex-col items-center gap-5 sm:flex-row sm:items-start">
                  <span
                    class="flex h-20 w-20 shrink-0 items-center justify-center rounded-card border-2 border-ink bg-accent font-display text-3xl text-primary shadow-soft"
                    aria-hidden="true"
                  >
                    HF
                  </span>
                  <div class="text-center sm:text-left">
                    <h2 class="font-display text-2xl text-ink">{{ SITE.developer.name }}</h2>
                    <p class="mt-1 text-sm font-bold uppercase tracking-widest text-primary-strong">
                      {{ SITE.developer.role }}
                    </p>
                    <p class="mt-3 text-sm font-medium leading-relaxed text-ink-soft">
                      Designer and developer of LifeHub — from the Angular frontend and the
                      neo-brutalist design system to the Express + MongoDB backend, authentication,
                      and the Gemini-powered LifeHub AI.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <!-- Social -->
            <h2 class="mt-12 text-center font-display text-2xl text-ink">Connect with me</h2>
            @if (socialCards.length > 0) {
              <div class="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
                @for (social of socialCards; track social.label) {
                  <a
                    [href]="social.url"
                    target="_blank"
                    rel="noopener noreferrer"
                    [attr.aria-label]="'Connect with me on ' + social.label"
                    class="group flex flex-col items-center rounded-card border-2 border-ink bg-surface p-5 text-center shadow-soft transition-all duration-200 hover:-translate-y-1 hover:shadow-card"
                  >
                    <span class="flex h-12 w-12 items-center justify-center rounded-[10px] border-2 border-ink bg-surface p-1.5 shadow-soft transition-transform duration-200 group-hover:-rotate-6">
                      <img
                        [src]="social.icon"
                        [alt]="social.label + ' logo'"
                        class="h-7 w-7 object-contain"
                      />
                    </span>
                    <h3 class="mt-3 font-display text-base text-ink">{{ social.label }}</h3>
                    <p class="mt-1 text-xs font-medium text-ink-soft">{{ social.description }}</p>
                  </a>
                }
              </div>
            } @else {
              <div class="mt-6 rounded-card border-2 border-ink bg-surface p-6 text-center shadow-soft">
                <p class="text-sm font-medium text-ink-soft">
                  Social links are not configured yet. Add your GitHub, LinkedIn, and Instagram
                  URLs in
                  <code class="inline-block max-w-full break-all rounded-md border-2 border-ink bg-surface-2 px-1.5 py-0.5 align-middle text-xs font-bold text-ink">frontend/src/app/core/config/site.config.ts</code>.
                </p>
              </div>
            }

            <!-- CTA -->
            <div class="mt-12 rounded-card border-2 border-ink bg-primary p-7 text-center shadow-card sm:p-9">
              <h2 class="font-display text-2xl text-ink">Interested in the project?</h2>
              <p class="mx-auto mt-2 max-w-md text-sm font-medium text-ink">
                Create an account to try LifeHub, or reach out through any of the links above.
              </p>
              <div class="mt-6 flex flex-wrap items-center justify-center gap-3">
                <a
                  routerLink="/register"
                  class="inline-flex items-center gap-2 rounded-button border-2 border-ink bg-surface px-6 py-3 text-sm font-bold text-ink shadow-soft transition-all duration-150 hover:-translate-y-[1px] hover:bg-surface-2 active:translate-x-[2px] active:translate-y-[2px] active:shadow-none"
                >
                  Try LifeHub
                  <app-icon name="arrow-right" [size]="16" />
                </a>
                <a
                  routerLink="/about"
                  class="inline-flex items-center gap-2 rounded-button border-2 border-ink bg-ink px-6 py-3 text-sm font-bold text-primary shadow-soft transition-all duration-150 hover:-translate-y-[1px] hover:opacity-90 active:translate-x-[2px] active:translate-y-[2px] active:shadow-none"
                >
                  <app-icon name="info" [size]="16" />
                  About the project
                </a>
              </div>
            </div>
          </div>
        </section>
      </main>

      <app-public-footer />
    </div>
  `,
})
export class ContactComponent implements OnInit {
  private seo = inject(SeoService);

  protected readonly SITE = SITE;

  protected readonly socialCards: SocialCard[] = Object.values(SITE.social).map((s) => ({
    label: s.label,
    url: s.url,
    icon: s.icon,
    description:
      s.label === 'GitHub'
        ? 'Code, commits, and contributions'
        : s.label === 'LinkedIn'
          ? 'Professional profile'
          : s.label === 'TikTok'
            ? 'Short videos & updates'
            : 'Behind the scenes',
  }));

  ngOnInit(): void {
    this.seo.setPage({
      title: 'Contact — LifeHub',
      description:
        'Get in touch about LifeHub, a personal life management platform. Connect with the developer Hidayah Muhammad Fadillah on GitHub, LinkedIn, or Instagram.',
      path: '/contact',
    });
  }
}
