import { Component, HostListener, inject, signal } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { IconComponent } from '../../../layout/components/icon.component';
import { ThemeService } from '../../../core/services/theme.service';
import { AuthService } from '../../../core/services/auth.service';

interface PublicNavLink {
  label: string;
  route: string;
}

const NAV_LINKS: PublicNavLink[] = [
  { label: 'Features', route: '/features' },
  { label: 'AI', route: '/ai' },
  { label: 'About', route: '/about' },
  { label: 'Contact', route: '/contact' },
];

@Component({
  selector: 'app-public-navbar',
  standalone: true,
  imports: [RouterLink, RouterLinkActive, IconComponent],
  template: `
    <header class="sticky top-0 z-50 border-b-2 border-ink bg-surface">
      <nav class="mx-auto flex h-16 max-w-6xl items-center gap-3 px-4 lg:px-6" aria-label="Main">
        <a
          routerLink="/"
          class="flex shrink-0 items-center gap-2.5 rounded-button px-1 py-1 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
          aria-label="LifeHub — home"
        >
          <span
            class="flex h-9 w-9 items-center justify-center rounded-[10px] border-2 border-ink bg-primary shadow-soft"
          >
            <img src="assets/logolifehub.png" alt="" class="h-5 w-5 object-contain" />
          </span>
          <span class="font-display text-lg leading-none text-ink">LIFEHUB</span>
        </a>

        <!-- Desktop links -->
        <ul class="ml-6 hidden items-center gap-1 md:flex">
          @for (link of links; track link.route) {
            <li>
              <a
                [routerLink]="link.route"
                routerLinkActive="bg-primary text-ink font-bold shadow-[3px_3px_0_0_var(--color-ink)]"
                #rla="routerLinkActive"
                [attr.aria-current]="rla.isActive ? 'page' : null"
                class="block rounded-button border-2 border-transparent px-3.5 py-2 text-sm font-semibold text-ink-soft transition-all duration-150 hover:border-ink hover:bg-surface-2 hover:text-ink"
              >
                {{ link.label }}
              </a>
            </li>
          }
        </ul>

        <div class="ml-auto flex items-center gap-2">
          <button
            (click)="toggleTheme()"
            class="flex h-10 w-10 items-center justify-center rounded-[10px] border-2 border-ink bg-surface text-ink-soft shadow-soft transition-all duration-150 hover:bg-primary hover:text-ink active:translate-x-[1px] active:translate-y-[1px] active:shadow-none"
            [attr.aria-label]="dark() ? 'Switch to light mode' : 'Switch to dark mode'"
          >
            <app-icon [name]="dark() ? 'sun' : 'moon'" [size]="18" />
          </button>

          @if (isAuthed()) {
            <a
              routerLink="/app/dashboard"
              class="hidden items-center gap-2 rounded-button border-2 border-ink bg-primary px-4 py-2 text-sm font-bold text-ink shadow-soft transition-all duration-150 hover:-translate-y-[1px] hover:bg-primary-strong active:translate-x-[2px] active:translate-y-[2px] active:shadow-none sm:inline-flex"
            >
              <app-icon name="layout-dashboard" [size]="17" />
              Open LifeHub
            </a>
          } @else {
            <a
              routerLink="/login"
              class="hidden rounded-button border-2 border-ink bg-surface px-4 py-2 text-sm font-bold text-ink shadow-soft transition-all duration-150 hover:-translate-y-[1px] hover:bg-surface-2 active:translate-x-[2px] active:translate-y-[2px] active:shadow-none sm:inline-flex"
            >
              Log in
            </a>
            <a
              routerLink="/register"
              class="hidden items-center gap-2 rounded-button border-2 border-ink bg-primary px-4 py-2 text-sm font-bold text-ink shadow-soft transition-all duration-150 hover:-translate-y-[1px] hover:bg-primary-strong active:translate-x-[2px] active:translate-y-[2px] active:shadow-none sm:inline-flex"
            >
              Get Started
            </a>
          }

          <!-- Mobile menu toggle -->
          <button
            (click)="mobileOpen.set(!mobileOpen())"
            class="flex h-10 w-10 items-center justify-center rounded-[10px] border-2 border-ink bg-surface text-ink shadow-soft transition-all duration-150 hover:bg-primary md:hidden"
            [attr.aria-expanded]="mobileOpen()"
            aria-controls="public-mobile-menu"
            [attr.aria-label]="mobileOpen() ? 'Close menu' : 'Open menu'"
          >
            <app-icon [name]="mobileOpen() ? 'x' : 'menu'" [size]="20" />
          </button>
        </div>
      </nav>

      <!-- Mobile menu -->
      @if (mobileOpen()) {
        <div
          id="public-mobile-menu"
          class="border-t-2 border-ink bg-surface md:hidden"
          role="menu"
          aria-label="Mobile navigation"
        >
          <nav class="mx-auto max-w-6xl px-4 py-4" aria-label="Mobile">
            <ul class="space-y-1">
              @for (link of links; track link.route) {
                <li>
                  <a
                    [routerLink]="link.route"
                    (click)="mobileOpen.set(false)"
                    class="block rounded-button border-2 border-transparent px-4 py-3 text-base font-semibold text-ink-soft transition-colors hover:border-ink hover:bg-surface-2 hover:text-ink"
                  >
                    {{ link.label }}
                  </a>
                </li>
              }
            </ul>
            <div class="mt-4 flex gap-2 border-t-2 border-ink/20 pt-4">
              @if (isAuthed()) {
                <a
                  routerLink="/app/dashboard"
                  (click)="mobileOpen.set(false)"
                  class="flex flex-1 items-center justify-center gap-2 rounded-button border-2 border-ink bg-primary px-4 py-3 text-sm font-bold text-ink shadow-soft"
                >
                  <app-icon name="layout-dashboard" [size]="17" />
                  Open LifeHub
                </a>
              } @else {
                <a
                  routerLink="/login"
                  (click)="mobileOpen.set(false)"
                  class="flex-1 rounded-button border-2 border-ink bg-surface px-4 py-3 text-center text-sm font-bold text-ink shadow-soft"
                >
                  Log in
                </a>
                <a
                  routerLink="/register"
                  (click)="mobileOpen.set(false)"
                  class="flex-1 rounded-button border-2 border-ink bg-primary px-4 py-3 text-center text-sm font-bold text-ink shadow-soft"
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

  protected readonly links = NAV_LINKS;
  protected readonly dark = this.theme.dark;
  protected readonly isAuthed = this.auth.isAuthenticated;
  protected readonly mobileOpen = signal(false);

  protected toggleTheme(): void {
    this.theme.toggle();
  }

  @HostListener('document:keydown.escape')
  protected onEsc(): void {
    this.mobileOpen.set(false);
  }
}
