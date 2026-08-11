import { Component, inject, output } from '@angular/core';
import { Router } from '@angular/router';
import { NgIf } from '@angular/common';
import { IconComponent } from '../components/icon.component';
import { AvatarComponent } from '../components/avatar.component';
import { ThemeService } from '../../core/services/theme.service';
import { AuthService } from '../../core/services/auth.service';

@Component({
  selector: 'app-topbar',
  standalone: true,
  imports: [IconComponent, AvatarComponent],
  template: `
    <header class="flex h-16 shrink-0 items-center gap-3 border-b-2 border-ink bg-surface px-4 lg:px-6">
      <button
        (click)="menu.emit()"
        class="flex h-10 w-10 items-center justify-center rounded-[10px] border-2 border-ink bg-surface text-ink shadow-soft transition-all duration-150 hover:bg-primary active:translate-x-[1px] active:translate-y-[1px] active:shadow-none lg:hidden"
        aria-label="Toggle navigation"
      >
        <app-icon name="menu" [size]="20" />
      </button>

      <span
        class="flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] border-2 border-ink bg-primary text-ink shadow-soft lg:hidden"
      >
        <app-icon name="zap" [size]="20" [strokeWidth]="2.6" />
      </span>

      <div class="relative hidden max-w-md flex-1 md:block">
        <app-icon
          name="search"
          [size]="17"
          class="pointer-events-none absolute top-1/2 -translate-y-1/2"
          [style.left.px]="13"
          [style.color]="'var(--color-ink-faint)'"
        />
        <input
          #searchInput
          type="text"
          name="global-search"
          placeholder="Search tasks, notes, transactions…"
          (keydown.enter)="globalSearch(searchInput.value)"
          class="h-10 w-full rounded-field border-2 border-ink bg-surface-2/70 pl-10 pr-3 text-sm font-medium text-ink placeholder:font-normal placeholder:text-ink-faint transition-all duration-150 focus:border-primary focus:bg-surface focus:shadow-soft focus:outline-none"
        />
      </div>

      <div class="ml-auto flex items-center gap-2">
        <button
          (click)="toggleTheme()"
          class="flex h-10 w-10 items-center justify-center rounded-[10px] border-2 border-ink bg-surface text-ink-soft shadow-soft transition-all duration-150 hover:bg-primary hover:text-ink active:translate-x-[1px] active:translate-y-[1px] active:shadow-none"
          [attr.aria-label]="dark() ? 'Switch to light mode' : 'Switch to dark mode'"
        >
          <app-icon [name]="dark() ? 'sun' : 'moon'" [size]="18" />
        </button>

        <button
          class="relative flex h-10 w-10 items-center justify-center rounded-[10px] border-2 border-ink bg-surface text-ink-soft shadow-soft transition-all duration-150 hover:bg-primary hover:text-ink active:translate-x-[1px] active:translate-y-[1px] active:shadow-none"
          aria-label="Notifications"
        >
          <app-icon name="bell" [size]="18" />
          <span class="absolute right-2 top-2 h-2.5 w-2.5 rounded-full border-2 border-ink bg-danger"></span>
        </button>

        <div class="relative ml-1">
          <button
            (click)="menuOpen = !menuOpen"
            class="flex items-center gap-2 rounded-full p-0.5 transition-all duration-150 hover:bg-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
            [attr.aria-expanded]="menuOpen"
            aria-haspopup="menu"
            aria-label="Account menu"
          >
            <app-avatar [name]="user()?.name ?? 'User'" [size]="36" />
          </button>

          @if (menuOpen) {
            <div
              class="absolute right-0 top-full z-50 mt-2 w-56 overflow-hidden rounded-card border-2 border-ink bg-surface py-1.5 shadow-pop animate-scale-in"
              role="menu"
            >
              <div class="border-b-2 border-ink px-4 py-2.5">
                <p class="truncate text-sm font-bold text-ink">{{ user()?.name }}</p>
                <p class="truncate text-xs font-medium text-ink-soft">{{ user()?.email }}</p>
              </div>
              <button role="menuitem" (click)="go('/profile')" class="flex w-full items-center gap-2.5 px-4 py-2.5 text-sm font-medium text-ink-soft transition-colors hover:bg-primary/10 hover:text-ink">
                <app-icon name="user-round" [size]="17" /> Profile
              </button>
              <button role="menuitem" (click)="go('/settings')" class="flex w-full items-center gap-2.5 px-4 py-2.5 text-sm font-medium text-ink-soft transition-colors hover:bg-primary/10 hover:text-ink">
                <app-icon name="settings" [size]="17" /> Settings
              </button>
              <div class="my-1 border-t-2 border-ink/20"></div>
              <button role="menuitem" (click)="logout()" class="flex w-full items-center gap-2.5 px-4 py-2.5 text-sm font-bold text-danger transition-colors hover:bg-danger/10">
                <app-icon name="log-out" [size]="17" /> Log out
              </button>
            </div>
          }
        </div>
      </div>
    </header>
  `,
})
export class TopbarComponent {
  readonly menu = output<void>();

  private theme = inject(ThemeService);
  private auth = inject(AuthService);
  private router = inject(Router);

  protected readonly dark = this.theme.dark;
  protected readonly user = this.auth.user;
  protected menuOpen = false;

  protected toggleTheme(): void {
    this.theme.toggle();
  }

  protected go(route: string): void {
    this.menuOpen = false;
    this.router.navigate([route]);
  }

  protected logout(): void {
    this.menuOpen = false;
    this.auth.logout();
  }

  protected globalSearch(query: string): void {
    if (!query.trim()) return;
    this.router.navigate(['/tasks'], { queryParams: { search: query.trim() } });
  }
}
