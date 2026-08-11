import { Component, inject, OnDestroy, OnInit, output } from '@angular/core';
import { Router } from '@angular/router';
import { NgClass } from '@angular/common';
import { IconComponent } from '../components/icon.component';
import { AvatarComponent } from '../components/avatar.component';
import { ThemeService } from '../../core/services/theme.service';
import { AuthService } from '../../core/services/auth.service';
import { NotificationService } from '../../core/services/notification.service';
import { formatDateTime } from '../../core/utils/format';

@Component({
  selector: 'app-topbar',
  standalone: true,
  imports: [NgClass, IconComponent, AvatarComponent],
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

        <!-- Notification bell -->
        <div class="relative">
          <button
            (click)="notifOpen = !notifOpen"
            class="relative flex h-10 w-10 items-center justify-center rounded-[10px] border-2 border-ink bg-surface text-ink-soft shadow-soft transition-all duration-150 hover:bg-primary hover:text-ink active:translate-x-[1px] active:translate-y-[1px] active:shadow-none"
            [attr.aria-expanded]="notifOpen"
            aria-haspopup="dialog"
            aria-label="Notifications"
          >
            <app-icon name="bell" [size]="18" />
            @if (unreadCount() > 0) {
              <span
                class="absolute -right-1.5 -top-1.5 flex h-5 min-w-5 items-center justify-center rounded-full border-2 border-ink bg-danger px-1 text-[10px] font-bold text-white"
              >
                {{ unreadCount() > 99 ? '99+' : unreadCount() }}
              </span>
            }
          </button>

          @if (notifOpen) {
            <div
              class="absolute right-0 top-full z-50 mt-2 w-80 overflow-hidden rounded-card border-2 border-ink bg-surface shadow-pop animate-scale-in sm:w-96"
              role="dialog"
              aria-label="Notifications"
            >
              <div class="flex items-center justify-between border-b-2 border-ink px-4 py-3">
                <p class="text-sm font-bold text-ink">Notifications</p>
                @if (unreadCount() > 0) {
                  <button
                    (click)="markAllRead()"
                    class="text-xs font-medium text-primary-strong hover:underline"
                  >
                    Mark all read
                  </button>
                }
              </div>
              <div class="max-h-80 overflow-y-auto">
                @if (notifications().length === 0) {
                  <div class="px-4 py-10 text-center">
                    <app-icon name="bell" [size]="28" class="mx-auto text-ink-faint" />
                    <p class="mt-2 text-sm font-medium text-ink">All caught up</p>
                    <p class="mt-0.5 text-xs text-ink-soft">Reminders and alerts will show up here.</p>
                  </div>
                }
                @for (item of notifications(); track item._id) {
                  <button
                    (click)="openNotification(item)"
                    class="flex w-full items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-surface-2/70"
                    [class.bg-primary/5]="!item.read"
                  >
                    <span
                      class="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg"
                      [ngClass]="item.read ? 'bg-surface-2 text-ink-faint' : 'bg-primary/15 text-ink'"
                    >
                      <app-icon [name]="item.read ? 'bell' : 'bell-ring'" [size]="15" />
                    </span>
                    <span class="min-w-0 flex-1">
                      <span class="block text-sm font-semibold text-ink">{{ item.title }}</span>
                      @if (item.message) {
                        <span class="mt-0.5 line-clamp-2 block text-xs text-ink-soft">{{ item.message }}</span>
                      }
                      <span class="mt-1 block text-[11px] text-ink-faint">{{ formatDateTime(item.createdAt) }}</span>
                    </span>
                    @if (!item.read) {
                      <span class="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-primary"></span>
                    }
                  </button>
                }
              </div>
            </div>
          }
        </div>

        <div class="relative ml-1">
          <button
            (click)="menuOpen = !menuOpen"
            class="flex items-center gap-2 rounded-full p-0.5 transition-all duration-150 hover:bg-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
            [attr.aria-expanded]="menuOpen"
            aria-haspopup="menu"
            aria-label="Account menu"
          >
            <app-avatar [name]="user()?.name ?? 'User'" [src]="user()?.avatar ?? ''" [size]="36" />
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
export class TopbarComponent implements OnInit, OnDestroy {
  readonly menu = output<void>();

  private theme = inject(ThemeService);
  private auth = inject(AuthService);
  private router = inject(Router);
  private notifService = inject(NotificationService);

  protected readonly dark = this.theme.dark;
  protected readonly user = this.auth.user;
  protected readonly notifications = this.notifService.notifications;
  protected readonly unreadCount = this.notifService.unread;

  protected menuOpen = false;
  protected notifOpen = false;
  private poll: ReturnType<typeof setInterval> | null = null;

  ngOnInit(): void {
    this.notifService.load();
    // Poll so reminders processed by the backend appear while the app is open.
    this.poll = setInterval(() => this.notifService.load(), 60_000);
  }

  ngOnDestroy(): void {
    if (this.poll) clearInterval(this.poll);
  }

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

  protected markAllRead(): void {
    this.notifService.markAllRead();
  }

  protected openNotification(item: { _id: string; read: boolean }): void {
    if (!item.read) this.notifService.markRead(item._id);
  }

  protected readonly formatDateTime = formatDateTime;
}
