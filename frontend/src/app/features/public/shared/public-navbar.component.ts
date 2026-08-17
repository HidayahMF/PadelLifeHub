import { Component, HostListener, inject, signal } from '@angular/core';
import { Router, RouterLink, RouterLinkActive } from '@angular/router';
import { IconComponent } from '../../../layout/components/icon.component';
import { ThemeService } from '../../../core/services/theme.service';
import { AuthService } from '../../../core/services/auth.service';

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
      <nav class="mx-auto flex h-16 max-w-7xl items-center gap-4 px-4 sm:px-6 lg:px-8" aria-label="Main">
        <a
          routerLink="/"
          class="flex shrink-0 items-center gap-2.5 rounded-lg px-1 py-1 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
          aria-label="LifeHub — home"
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
                  {{ link.label }}
                </a>
              } @else {
                <button
                  (click)="goToSection(link.section ?? '')"
                  class="block rounded-lg px-3 py-2 text-sm font-medium text-neutral-600 transition-colors hover:bg-neutral-100 hover:text-ink"
                >
                  {{ link.label }}
                </button>
              }
            </li>
          }
        </ul>

        <div class="ml-auto flex items-center gap-2">
          <button
            (click)="toggleTheme()"
            class="flex h-9 w-9 items-center justify-center rounded-lg border border-neutral-200 bg-white text-neutral-600 shadow-sm transition-colors hover:bg-neutral-50 hover:text-ink"
            [attr.aria-label]="dark() ? 'Switch to light mode' : 'Switch to dark mode'"
          >
            <app-icon [name]="dark() ? 'sun' : 'moon'" [size]="17" />
          </button>

          @if (isAuthed()) {
            <a
              routerLink="/app/dashboard"
              class="hidden items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-ink shadow-sm transition-all duration-150 hover:bg-primary-strong hover:shadow sm:inline-flex"
            >
              <app-icon name="layout-dashboard" [size]="16" />
              Open LifeHub
            </a>
          } @else {
            <a
              routerLink="/login"
              class="hidden rounded-lg border border-neutral-200 bg-white px-4 py-2 text-sm font-semibold text-neutral-700 shadow-sm transition-colors hover:bg-neutral-50 hover:text-ink sm:inline-flex"
            >
              Log in
            </a>
            <a
              routerLink="/register"
              class="hidden items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-ink shadow-sm transition-all duration-150 hover:bg-primary-strong hover:shadow sm:inline-flex"
            >
              Get Started
              <app-icon name="arrow-right" [size]="15" />
            </a>
          }

          <!-- Mobile menu toggle -->
          <button
            (click)="mobileOpen.set(!mobileOpen())"
            class="flex h-9 w-9 items-center justify-center rounded-lg border border-neutral-200 bg-white text-neutral-700 shadow-sm transition-colors hover:bg-neutral-50 md:hidden"
            [attr.aria-expanded]="mobileOpen()"
            aria-controls="public-mobile-menu"
            [attr.aria-label]="mobileOpen() ? 'Close menu' : 'Open menu'"
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
          aria-label="Mobile navigation"
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
                      {{ link.label }}
                    </a>
                  } @else {
                    <button
                      (click)="goToSection(link.section ?? '')"
                      class="block w-full rounded-lg px-3 py-2.5 text-left text-base font-medium text-neutral-700 transition-colors hover:bg-neutral-100 hover:text-ink"
                    >
                      {{ link.label }}
                    </button>
                  }
                </li>
              }
            </ul>
            <div class="mt-3 flex gap-2 border-t border-neutral-200 pt-3">
              @if (isAuthed()) {
                <a
                  routerLink="/app/dashboard"
                  (click)="mobileOpen.set(false)"
                  class="flex flex-1 items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-ink shadow-sm"
                >
                  <app-icon name="layout-dashboard" [size]="16" />
                  Open LifeHub
                </a>
              } @else {
                <a
                  routerLink="/login"
                  (click)="mobileOpen.set(false)"
                  class="flex-1 rounded-lg border border-neutral-200 bg-white px-4 py-2.5 text-center text-sm font-semibold text-neutral-700 shadow-sm"
                >
                  Log in
                </a>
                <a
                  routerLink="/register"
                  (click)="mobileOpen.set(false)"
                  class="flex-1 rounded-lg bg-primary px-4 py-2.5 text-center text-sm font-semibold text-ink shadow-sm"
                >
                  Get Started
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

  protected readonly links = NAV_LINKS;
  protected readonly dark = this.theme.dark;
  protected readonly isAuthed = this.auth.isAuthenticated;
  protected readonly mobileOpen = signal(false);

  protected toggleTheme(): void {
    this.theme.toggle();
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
