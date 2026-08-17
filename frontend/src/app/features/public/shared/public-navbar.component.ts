import { Component, HostListener, inject, signal } from '@angular/core';
import { Router, RouterLink, RouterLinkActive } from '@angular/router';
import { IconComponent } from '../../../layout/components/icon.component';
import { ThemeService } from '../../../core/services/theme.service';
import { AuthService } from '../../../core/services/auth.service';
import { I18nService, type Lang } from '../../../core/services/i18n.service';

interface PublicNavLink {
  label: string;
  /** Full route for page links (e.g. /features). */
  route?: string;
  /** Section id on the landing page for anchor links (e.g. finance). */
  section?: string;
}

const NAV_LINKS: PublicNavLink[] = [
  { label: 'Features', route: '/features' },
  { label: 'AI', route: '/ai' },
  { label: 'Finance', section: 'finance' },
  { label: 'Productivity', section: 'productivity' },
  { label: 'How it works', section: 'how-it-works' },
];

@Component({
  selector: 'app-public-navbar',
  standalone: true,
  imports: [RouterLink, RouterLinkActive, IconComponent],
  template: `
    <header
      class="sticky top-0 z-50 border-b border-neutral-200/80 bg-white/80 backdrop-blur-md"
    >
      <nav class="mx-auto flex h-16 max-w-7xl items-center gap-3 px-4 sm:px-6 lg:px-8" aria-label="Main">
        <a
          routerLink="/"
          class="flex shrink-0 items-center gap-2.5 rounded-lg px-1 py-1 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
          [attr.aria-label]="t('LifeHub — home')"
        >
          <span
            class="flex h-8 w-8 items-center justify-center rounded-[10px] bg-primary shadow-sm ring-1 ring-ink/10"
          >
            <img src="assets/logolifehub.png" alt="" class="h-5 w-5 object-contain" />
          </span>
          <span class="text-lg font-bold tracking-tight text-ink">LifeHub</span>
        </a>

        <!-- Desktop links -->
        <ul class="ml-4 hidden items-center gap-1 md:flex">
          @for (link of links; track link.label) {
            <li>
              @if (link.route) {
                <a
                  [routerLink]="link.route"
                  routerLinkActive="bg-neutral-100 text-ink"
                  #rla="routerLinkActive"
                  [attr.aria-current]="rla.isActive ? 'page' : null"
                  class="block rounded-lg px-3 py-2 text-sm font-medium text-neutral-600 transition-colors hover:bg-neutral-100 hover:text-ink"
                >
                  {{ t(link.label) }}
                </a>
              } @else {
                <button
                  (click)="goToSection(link.section ?? '')"
                  class="block rounded-lg px-3 py-2 text-sm font-medium text-neutral-600 transition-colors hover:bg-neutral-100 hover:text-ink"
                >
                  {{ t(link.label) }}
                </button>
              }
            </li>
          }
        </ul>

        <div class="ml-auto flex items-center gap-2">
          <!-- Language switcher (desktop) -->
          <div
            role="group"
            [attr.aria-label]="t('Language')"
            class="hidden items-center rounded-lg border border-neutral-200 bg-white p-0.5 shadow-sm md:flex"
          >
            <button
              (click)="setLang('en')"
              [attr.aria-pressed]="lang() === 'en'"
              [attr.aria-label]="t('English')"
              class="rounded-md px-2.5 py-1 text-xs font-bold transition-colors focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ink"
              [class]="
                lang() === 'en'
                  ? 'bg-neutral-900 text-white'
                  : 'text-neutral-500 hover:bg-neutral-100 hover:text-neutral-800'
              "
            >
              EN
            </button>
            <button
              (click)="setLang('id')"
              [attr.aria-pressed]="lang() === 'id'"
              [attr.aria-label]="t('Bahasa Indonesia')"
              class="rounded-md px-2.5 py-1 text-xs font-bold transition-colors focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ink"
              [class]="
                lang() === 'id'
                  ? 'bg-neutral-900 text-white'
                  : 'text-neutral-500 hover:bg-neutral-100 hover:text-neutral-800'
              "
            >
              ID
            </button>
          </div>

          <button
            (click)="toggleTheme()"
            class="flex h-9 w-9 items-center justify-center rounded-lg border border-neutral-200 bg-white text-neutral-600 shadow-sm transition-colors hover:bg-neutral-50 hover:text-ink"
            [attr.aria-label]="dark() ? t('Switch to light mode') : t('Switch to dark mode')"
          >
            <app-icon [name]="dark() ? 'sun' : 'moon'" [size]="17" />
          </button>

          @if (isAuthed()) {
            <a
              routerLink="/app/dashboard"
              class="hidden items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-ink shadow-sm transition-all duration-150 hover:bg-primary-strong hover:shadow sm:inline-flex"
            >
              <app-icon name="layout-dashboard" [size]="16" />
              {{ t('Open LifeHub') }}
            </a>
          } @else {
            <a
              routerLink="/login"
              class="hidden rounded-lg border border-neutral-200 bg-white px-4 py-2 text-sm font-semibold text-neutral-700 shadow-sm transition-colors hover:bg-neutral-50 hover:text-ink sm:inline-flex"
            >
              {{ t('Log in') }}
            </a>
            <a
              routerLink="/register"
              class="hidden items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-ink shadow-sm transition-all duration-150 hover:bg-primary-strong hover:shadow sm:inline-flex"
            >
              {{ t('Get Started') }}
              <app-icon name="arrow-right" [size]="15" />
            </a>
          }

          <!-- Mobile menu toggle -->
          <button
            (click)="mobileOpen.set(!mobileOpen())"
            class="flex h-9 w-9 items-center justify-center rounded-lg border border-neutral-200 bg-white text-neutral-700 shadow-sm transition-colors hover:bg-neutral-50 md:hidden"
            [attr.aria-expanded]="mobileOpen()"
            aria-controls="public-mobile-menu"
            [attr.aria-label]="mobileOpen() ? t('Close menu') : t('Open menu')"
          >
            <app-icon [name]="mobileOpen() ? 'x' : 'menu'" [size]="19" />
          </button>
        </div>
      </nav>

      <!-- Mobile menu -->
      @if (mobileOpen()) {
        <div
          id="public-mobile-menu"
          class="border-t border-neutral-200 bg-white md:hidden"
          role="menu"
          [attr.aria-label]="t('Main navigation')"
        >
          <nav class="mx-auto max-w-7xl px-4 py-3 sm:px-6" aria-label="Mobile">
            <ul class="space-y-1">
              @for (link of links; track link.label) {
                <li>
                  @if (link.route) {
                    <a
                      [routerLink]="link.route"
                      (click)="mobileOpen.set(false)"
                      class="block rounded-lg px-3 py-2.5 text-base font-medium text-neutral-700 transition-colors hover:bg-neutral-100 hover:text-ink"
                    >
                      {{ t(link.label) }}
                    </a>
                  } @else {
                    <button
                      (click)="goToSection(link.section ?? '')"
                      class="block w-full rounded-lg px-3 py-2.5 text-left text-base font-medium text-neutral-700 transition-colors hover:bg-neutral-100 hover:text-ink"
                    >
                      {{ t(link.label) }}
                    </button>
                  }
                </li>
              }
            </ul>

            <!-- Language selector (mobile) -->
            <div class="mt-3 border-t border-neutral-200 pt-3">
              <p class="px-1 text-xs font-bold uppercase tracking-widest text-neutral-500">
                {{ t('Language') }}
              </p>
              <div class="mt-2 flex gap-2">
                <button
                  (click)="setLang('en')"
                  [attr.aria-pressed]="lang() === 'en'"
                  class="flex-1 rounded-lg border px-4 py-2.5 text-sm font-semibold transition-colors"
                  [class]="
                    lang() === 'en'
                      ? 'border-neutral-900 bg-neutral-900 text-white'
                      : 'border-neutral-200 bg-white text-neutral-700'
                  "
                >
                  English
                </button>
                <button
                  (click)="setLang('id')"
                  [attr.aria-pressed]="lang() === 'id'"
                  class="flex-1 rounded-lg border px-4 py-2.5 text-sm font-semibold transition-colors"
                  [class]="
                    lang() === 'id'
                      ? 'border-neutral-900 bg-neutral-900 text-white'
                      : 'border-neutral-200 bg-white text-neutral-700'
                  "
                >
                  Bahasa Indonesia
                </button>
              </div>
            </div>

            <div class="mt-3 flex gap-2 border-t border-neutral-200 pt-3">
              @if (isAuthed()) {
                <a
                  routerLink="/app/dashboard"
                  (click)="mobileOpen.set(false)"
                  class="flex flex-1 items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-ink shadow-sm"
                >
                  <app-icon name="layout-dashboard" [size]="16" />
                  {{ t('Open LifeHub') }}
                </a>
              } @else {
                <a
                  routerLink="/login"
                  (click)="mobileOpen.set(false)"
                  class="flex-1 rounded-lg border border-neutral-200 bg-white px-4 py-2.5 text-center text-sm font-semibold text-neutral-700 shadow-sm"
                >
                  {{ t('Log in') }}
                </a>
                <a
                  routerLink="/register"
                  (click)="mobileOpen.set(false)"
                  class="flex-1 rounded-lg bg-primary px-4 py-2.5 text-center text-sm font-semibold text-ink shadow-sm"
                >
                  {{ t('Get Started') }}
                </a>
              }
            </div>
          </nav>
        </div>
      }
    </header>
  `,
})
export class PublicNavbarComponent {
  private theme = inject(ThemeService);
  private auth = inject(AuthService);
  private router = inject(Router);
  private i18n = inject(I18nService);

  protected readonly links = NAV_LINKS;
  protected readonly dark = this.theme.dark;
  protected readonly isAuthed = this.auth.isAuthenticated;
  protected readonly lang = this.i18n.lang;
  protected readonly t = this.i18n.t.bind(this.i18n);
  protected readonly mobileOpen = signal(false);

  protected toggleTheme(): void {
    this.theme.toggle();
  }

  protected setLang(lang: Lang): void {
    this.i18n.setLang(lang);
  }

  /**
   * Section links point at landing-page anchors (#finance, #productivity,
   * #how-it-works). From any page, navigate to the landing page first, then
   * scroll to the section — with reduced-motion awareness.
   */
  protected goToSection(id: string): void {
    this.mobileOpen.set(false);
    const scroll = (): void => {
      const el = document.getElementById(id);
      if (!el) return;
      const smooth = !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      el.scrollIntoView({ behavior: smooth ? 'smooth' : 'auto', block: 'start' });
    };
    if (this.router.url === '/') {
      scroll();
    } else {
      this.router.navigate(['/']).then(() => {
        setTimeout(scroll, 80);
      });
    }
  }

  @HostListener('document:keydown.escape')
  protected onEsc(): void {
    this.mobileOpen.set(false);
  }
}
