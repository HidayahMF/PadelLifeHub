import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { SITE } from '../../../core/config/site.config';

interface FooterSocial {
  label: string;
  url: string;
  icon: string;
}

@Component({
  selector: 'app-public-footer',
  standalone: true,
  imports: [RouterLink],
  template: `
    <footer class="border-t border-neutral-200 bg-white">
      <div class="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <div class="grid grid-cols-1 gap-10 md:grid-cols-12">
          <!-- Brand -->
          <div class="md:col-span-5">
            <a routerLink="/" class="flex items-center gap-2.5" aria-label="LifeHub — home">
              <span
                class="flex h-9 w-9 items-center justify-center rounded-[10px] bg-primary shadow-sm ring-1 ring-ink/10"
              >
                <img src="assets/logolifehub.png" alt="" class="h-5 w-5 object-contain" />
              </span>
              <span class="text-xl font-bold tracking-tight text-ink">LifeHub</span>
            </a>
            <p class="mt-3 text-xs font-semibold uppercase tracking-widest text-neutral-500">
              {{ SITE.tagline }}
            </p>
            <p class="mt-4 max-w-sm text-sm font-medium leading-relaxed text-neutral-600">
              Your personal space to manage productivity, finances, habits, goals, and notes — with
              weekly &amp; monthly reviews and an AI assistant that understands your life data.
            </p>
          </div>

          <!-- Product -->
          <nav class="md:col-span-2" aria-label="Product">
            <p class="text-xs font-bold uppercase tracking-widest text-neutral-500">Product</p>
            <ul class="mt-3 space-y-2">
              @for (item of productLinks; track item.label) {
                <li>
                  <a
                    [routerLink]="item.route"
                    class="inline-block rounded-md text-sm font-medium text-neutral-600 transition-colors hover:text-ink"
                  >
                    {{ item.label }}
                  </a>
                </li>
              }
            </ul>
          </nav>

          <!-- Get started -->
          <nav class="md:col-span-2" aria-label="Get started">
            <p class="text-xs font-bold uppercase tracking-widest text-neutral-500">Get started</p>
            <ul class="mt-3 space-y-2">
              <li>
                <a
                  routerLink="/login"
                  class="inline-block rounded-md text-sm font-medium text-neutral-600 transition-colors hover:text-ink"
                >
                  Log in
                </a>
              </li>
              <li>
                <a
                  routerLink="/register"
                  class="inline-block rounded-md text-sm font-medium text-neutral-600 transition-colors hover:text-ink"
                >
                  Create account
                </a>
              </li>
            </ul>
          </nav>

          <!-- Connect -->
          <div class="md:col-span-3">
            <p class="text-xs font-bold uppercase tracking-widest text-neutral-500">Connect</p>
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
                      class="flex h-10 w-10 items-center justify-center rounded-lg border border-neutral-200 bg-white p-1.5 shadow-sm transition-all duration-150 hover:-translate-y-0.5 hover:border-neutral-300 hover:shadow"
                    >
                      <img
                        [src]="social.icon"
                        [alt]="social.label + ' logo'"
                        class="h-5 w-5 object-contain"
                      />
                    </a>
                  </li>
                }
              </ul>
            } @else {
              <p class="mt-3 text-sm font-medium text-neutral-600">
                Follow the project on
                <a
                  routerLink="/contact"
                  class="font-semibold text-ink underline decoration-primary decoration-2 underline-offset-4 hover:bg-primary"
                >
                  the contact page
                </a>
                .
              </p>
            }
          </div>
        </div>

        <div
          class="mt-10 flex flex-col items-center justify-between gap-3 border-t border-neutral-200 pt-6 sm:flex-row"
        >
          <p class="text-xs font-medium text-neutral-500">© {{ year }} LifeHub</p>
          <p class="text-xs font-medium text-neutral-500">
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
