import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { IconComponent } from '../../../layout/components/icon.component';
import { SITE } from '../../../core/config/site.config';

interface FooterSocial {
  label: string;
  url: string;
  icon: string;
}

@Component({
  selector: 'app-public-footer',
  standalone: true,
  imports: [RouterLink, IconComponent],
  template: `
    <footer class="border-t-2 border-ink bg-surface">
      <div class="mx-auto max-w-6xl px-4 py-12 lg:px-6">
        <div class="grid grid-cols-1 gap-10 md:grid-cols-12">
          <!-- Brand -->
          <div class="md:col-span-5">
            <a routerLink="/" class="flex items-center gap-2.5" aria-label="LifeHub — home">
              <span
                class="flex h-10 w-10 items-center justify-center rounded-[10px] border-2 border-ink bg-primary shadow-soft"
              >
                <img src="assets/logolifehub.png" alt="" class="h-6 w-6 object-contain" />
              </span>
              <span class="font-display text-xl text-ink">LIFEHUB</span>
            </a>
            <p class="mt-3 text-sm font-bold uppercase tracking-widest text-ink-faint">
              {{ SITE.tagline }}
            </p>
            <p class="mt-4 max-w-sm text-sm font-medium text-ink-soft">
              Your personal space to manage productivity, finances, habits, goals, and notes — with
              an AI assistant that understands your life data.
            </p>
          </div>

          <!-- Product -->
          <nav class="md:col-span-2" aria-label="Product">
            <p class="text-xs font-bold uppercase tracking-widest text-ink-faint">Product</p>
            <ul class="mt-3 space-y-2">
              @for (item of productLinks; track item.label) {
                <li>
                  <a
                    [routerLink]="item.route"
                    class="inline-block rounded-md text-sm font-semibold text-ink-soft transition-colors hover:text-ink hover:underline hover:decoration-primary hover:decoration-2 hover:underline-offset-4"
                  >
                    {{ item.label }}
                  </a>
                </li>
              }
            </ul>
          </nav>

          <!-- Get started -->
          <nav class="md:col-span-2" aria-label="Get started">
            <p class="text-xs font-bold uppercase tracking-widest text-ink-faint">Get started</p>
            <ul class="mt-3 space-y-2">
              <li>
                <a
                  routerLink="/login"
                  class="inline-block rounded-md text-sm font-semibold text-ink-soft transition-colors hover:text-ink hover:underline hover:decoration-primary hover:decoration-2 hover:underline-offset-4"
                >
                  Log in
                </a>
              </li>
              <li>
                <a
                  routerLink="/register"
                  class="inline-block rounded-md text-sm font-semibold text-ink-soft transition-colors hover:text-ink hover:underline hover:decoration-primary hover:decoration-2 hover:underline-offset-4"
                >
                  Create account
                </a>
              </li>
            </ul>
          </nav>

          <!-- Connect -->
          <div class="md:col-span-3">
            <p class="text-xs font-bold uppercase tracking-widest text-ink-faint">Connect</p>
            @if (socialLinks.length > 0) {
              <ul class="mt-3 flex flex-wrap gap-2">
                @for (social of socialLinks; track social.label) {
                  <li>
                    <a
                      [href]="social.url"
                      target="_blank"
                      rel="noopener noreferrer"
                      [attr.aria-label]="'LifeHub on ' + social.label"
                      title="{{ social.label }}"
                      class="group flex h-11 w-11 items-center justify-center rounded-[10px] border-2 border-ink bg-surface p-1.5 shadow-soft transition-all duration-150 hover:-translate-y-[1px] hover:bg-primary-strong active:translate-x-[2px] active:translate-y-[2px] active:shadow-none"
                    >
                      <img
                        [src]="social.icon"
                        [alt]="social.label + ' logo'"
                        class="h-6 w-6 object-contain transition-transform duration-150 group-hover:scale-110"
                      />
                    </a>
                  </li>
                }
              </ul>
            } @else {
              <p class="mt-3 text-sm font-medium text-ink-soft">
                Follow the project on
                <a
                  routerLink="/contact"
                  class="font-bold text-ink underline decoration-primary decoration-2 underline-offset-4 hover:bg-primary"
                >
                  the contact page
                </a>
                .
              </p>
            }
          </div>
        </div>

        <div
          class="mt-10 flex flex-col items-center justify-between gap-3 border-t-2 border-ink/20 pt-6 sm:flex-row"
        >
          <p class="text-xs font-semibold text-ink-faint">© {{ year }} LifeHub</p>
          <p class="text-xs font-medium text-ink-faint">
            Built with Angular · Express · MongoDB — by {{ SITE.developer.name }}
          </p>
        </div>
      </div>
    </footer>
  `,
})
export class PublicFooterComponent {
  protected readonly SITE = SITE;
  protected readonly year = new Date().getFullYear();

  protected readonly productLinks = [
    { label: 'Features', route: '/features' },
    { label: 'LifeHub AI', route: '/ai' },
    { label: 'About', route: '/about' },
    { label: 'Contact', route: '/contact' },
  ];

  protected readonly socialLinks: FooterSocial[] = Object.values(SITE.social).filter(
    (s) => s.url.length > 0
  );
}
