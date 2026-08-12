import { Component, computed, inject, OnDestroy, OnInit, output, signal } from '@angular/core';
import { Router } from '@angular/router';
import { NgClass } from '@angular/common';
import { IconComponent } from '../components/icon.component';
import { AvatarComponent } from '../components/avatar.component';
import { ThemeService } from '../../core/services/theme.service';
import { AuthService } from '../../core/services/auth.service';
import { NotificationService } from '../../core/services/notification.service';
import { CommandService } from '../../core/services/command.service';
import { formatDateTime } from '../../core/utils/format';
import type { NotificationItem } from '../../core/models/misc.model';

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
        <img src="assets/logolifehub.png" alt="LifeHub logo" class="h-5 w-5 object-contain" />
      </span>

      <!-- Global search trigger -->
      <button
        (click)="command.openSearch()"
        class="hidden h-10 w-full max-w-md items-center gap-2.5 rounded-field border-2 border-ink bg-surface-2/70 px-3.5 text-sm font-medium text-ink-faint transition-all duration-150 hover:border-primary hover:bg-surface hover:text-ink-soft hover:shadow-soft md:flex"
        aria-label="Open global search (Ctrl+K)"
      >
        <app-icon name="search" [size]="17" />
        <span class="flex-1 text-left">Search LifeHub…</span>
        <span class="flex items-center gap-0.5 rounded-md border-2 border-ink bg-surface px-1.5 py-0.5 font-display text-[10px] text-ink-soft">
          CTRL K
        </span>
      </button>
      <button
        (click)="command.openSearch()"
        class="flex h-10 w-10 shrink-0 items-center justify-center rounded-[10px] border-2 border-ink bg-surface text-ink-soft shadow-soft transition-all duration-150 hover:bg-primary hover:text-ink active:translate-x-[1px] active:translate-y-[1px] active:shadow-none md:hidden"
        aria-label="Search"
      >
        <app-icon name="search" [size]="18" />
      </button>

      <div class="ml-auto flex items-center gap-2">
        <!-- Quick add (desktop; FAB on mobile) -->
        <button
          (click)="command.openQuickAdd()"
          class="hidden h-10 items-center gap-2 rounded-[10px] border-2 border-ink bg-primary px-3.5 text-sm font-bold text-ink shadow-soft transition-all duration-150 hover:bg-primary-strong hover:-translate-y-[1px] active:translate-x-[1px] active:translate-y-[1px] active:shadow-none lg:flex"
          aria-label="Quick add"
        >
          <app-icon name="plus" [size]="18" [strokeWidth]="2.6" />
          Add
        </button>

        <button
          (click)="toggleTheme()"
          class="flex h-10 w-10 items-center justify-center rounded-[10px] border-2 border-ink bg-surface text-ink-soft shadow-soft transition-all duration-150 hover:bg-primary hover:text-ink active:translate-x-[1px] active:translate-y-[1px] active:shadow-none"
          [attr.aria-label]="dark() ? 'Switch to light mode' : 'Switch to dark mode'"
        >
          <app-icon [name]="dark() ? 'sun' : 'moon'" [size]="18" />
        </button>

        <!-- Notification center -->
        <div class="relative">
          <button
            (click)="toggleNotif()"
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
              class="absolute right-0 top-full z-50 mt-2 w-[92vw] max-w-sm overflow-hidden rounded-card border-2 border-ink bg-surface shadow-pop animate-scale-in sm:w-96"
              role="dialog"
              aria-label="Notifications"
            >
              <div class="flex items-center justify-between gap-2 border-b-2 border-ink px-4 py-3">
                <p class="text-sm font-bold text-ink">Notifications</p>
                <div class="flex items-center gap-2">
                  <button
                    (click)="showUnread.set(!showUnread())"
                    class="rounded-md border-2 border-ink px-2 py-0.5 text-[11px] font-bold transition-colors"
                    [class]="showUnread() ? 'bg-primary text-ink' : 'bg-surface-2 text-ink-soft hover:text-ink'"
                  >
                    Unread
                  </button>
                  @if (unreadCount() > 0) {
                    <button
                      (click)="markAllRead()"
                      class="text-xs font-medium text-primary-strong hover:underline"
                    >
                      Mark all read
                    </button>
                  }
                </div>
              </div>
              <div class="max-h-96 overflow-y-auto">
                @if (visibleNotifications().length === 0) {
                  <div class="px-4 py-10 text-center">
                    <app-icon name="bell" [size]="28" class="mx-auto text-ink-faint" />
                    <p class="mt-2 text-sm font-medium text-ink">
                      {{ showUnread() ? 'Nothing unread' : 'All caught up' }}
                    </p>
                    <p class="mt-0.5 text-xs text-ink-soft">Reminders and alerts will show up here.</p>
                  </div>
                }
                @for (item of visibleNotifications(); track item._id) {
                  <div
                    class="group flex w-full items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-surface-2/70"
                    [class.bg-primary/5]="!item.read"
                  >
                    <button
                      (click)="openNotification(item)"
                      class="flex min-w-0 flex-1 items-start gap-3 text-left"
                    >
                      <span
                        class="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg"
                        [ngClass]="
                          item.read
                            ? 'bg-surface-2 text-ink-faint'
                            : typeColor(item.type)
                        "
                      >
                        <app-icon [name]="typeIcon(item.type)" [size]="15" />
                      </span>
                      <span class="min-w-0 flex-1">
                        <span class="block text-sm font-semibold text-ink">{{ item.title }}</span>
                        @if (item.message) {
                          <span class="mt-0.5 line-clamp-2 block text-xs text-ink-soft">{{ item.message }}</span>
                        }
                        <span class="mt-1 block text-[11px] text-ink-faint">{{ formatDateTime(item.createdAt) }}</span>
                      </span>
                    </button>
                    @if (!item.read) {
                      <span class="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-primary"></span>
                    }
                    <button
                      (click)="removeNotification(item)"
                      class="mt-1 hidden h-7 w-7 shrink-0 items-center justify-center rounded-md text-ink-faint transition-colors hover:bg-danger hover:text-white group-hover:flex"
                      [attr.aria-label]="'Delete notification'"
                    >
                      <app-icon name="x" [size]="14" [strokeWidth]="2.6" />
                    </button>
                  </div>
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
  protected readonly command = inject(CommandService);

  protected readonly dark = this.theme.dark;
  protected readonly user = this.auth.user;
  protected readonly notifications = this.notifService.notifications;
  protected readonly unreadCount = this.notifService.unread;
  protected readonly showUnread = signal(false);

  protected readonly visibleNotifications = computed(() => {
    const list = this.notifications();
    return this.showUnread() ? list.filter((n) => !n.read) : list;
  });

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

  protected toggleNotif(): void {
    this.notifOpen = !this.notifOpen;
    if (this.notifOpen) this.notifService.load();
  }

  protected go(route: string): void {
    this.menuOpen = false;
    this.router.navigate([route]);
  }

  protected logout(): void {
    this.menuOpen = false;
    this.auth.logout();
  }

  protected markAllRead(): void {
    this.notifService.markAllRead();
  }

  protected removeNotification(item: NotificationItem): void {
    this.notifService.remove(item._id);
  }

  protected openNotification(item: NotificationItem): void {
    this.notifOpen = false;
    if (!item.read) this.notifService.markRead(item._id);
    const route = this.routeFor(item);
    this.router.navigate(route.route, route.queryParams ? { queryParams: route.queryParams } : undefined);
  }

  /** Map a notification type to the module that owns the related resource. */
  private routeFor(item: NotificationItem): { route: string[]; queryParams?: Record<string, string> } {
    switch (item.type) {
      case 'task':
        return { route: ['/tasks'], queryParams: { search: item.title } };
      case 'habit':
        return { route: ['/habits'] };
      case 'recurring':
      case 'bill':
        return { route: ['/finance'] };
      case 'reminder':
        return { route: ['/calendar'] };
      default:
        return { route: ['/today'] };
    }
  }

  protected typeIcon(type: NotificationItem['type']): string {
    switch (type) {
      case 'task':
        return 'list-todo';
      case 'habit':
        return 'flame';
      case 'recurring':
        return 'refresh-cw';
      case 'bill':
        return 'receipt';
      case 'reminder':
        return 'clock';
      default:
        return 'bell';
    }
  }

  protected typeColor(type: NotificationItem['type']): string {
    switch (type) {
      case 'task':
        return 'bg-danger/15 text-danger';
      case 'habit':
        return 'bg-success/15 text-success';
      case 'recurring':
        return 'bg-primary/15 text-ink';
      case 'bill':
        return 'bg-warning/15 text-warning';
      case 'reminder':
        return 'bg-primary/15 text-ink';
      default:
        return 'bg-surface-2 text-ink';
    }
  }

  protected readonly formatDateTime = formatDateTime;
}
