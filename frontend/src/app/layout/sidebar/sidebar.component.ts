import { Component, computed, inject, input, output } from '@angular/core';
import { Router, RouterLink, RouterLinkActive } from '@angular/router';
import { NgClass, NgIf } from '@angular/common';
import { NAV_BOTTOM, NAV_SECTIONS } from '../nav-items';
import { IconComponent } from '../components/icon.component';
import { AvatarComponent } from '../components/avatar.component';
import { AuthService } from '../../core/services/auth.service';
import { I18nService } from '../../core/services/i18n.service';

@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [
    RouterLink,
    RouterLinkActive,
    NgClass,
    NgIf,
    IconComponent,
    AvatarComponent,
  ],
  template: `
    <aside
      class="flex h-full w-[248px] flex-col border-r-2 border-ink bg-surface transition-all duration-200"
      [ngClass]="{ '-ml-[248px]': collapsed() }"
    >
      <div class="flex h-16 shrink-0 items-center gap-3 border-b-2 border-ink px-5">
        <span
          class="flex h-10 w-10 items-center justify-center rounded-[10px] border-2 border-ink bg-primary text-ink shadow-soft"
        >
          <img src="assets/logolifehub.png" alt="LifeHub logo" class="h-6 w-6 object-contain" />
        </span>
        <div class="min-w-0">
          <p class="font-display text-base leading-tight text-ink">LifeHub</p>
          <p class="text-[11px] font-bold uppercase tracking-wider text-ink-faint">{{ t('Get it done') }}</p>
        </div>
      </div>

      <nav class="flex-1 overflow-y-auto px-3 py-4" [attr.aria-label]="t('Main navigation')">
        @for (section of sections; track section.title) {
          <p
            *ngIf="section.title"
            class="px-3 pb-2 pt-4 text-[11px] font-bold uppercase tracking-widest text-ink-faint"
          >
            {{ t(section.title) }}
          </p>
          <ul class="space-y-1">
            @for (item of section.items; track item.route) {
              <li>
                <a
                  [routerLink]="item.route"
                  routerLinkActive="bg-primary text-ink font-bold shadow-[3px_3px_0_0_var(--color-ink)]"
                  #rla="routerLinkActive"
                  (click)="navigated.emit()"
                  class="group flex items-center gap-3 rounded-button border-2 border-transparent px-3 py-2.5 text-sm font-medium text-ink-soft transition-all duration-150 hover:border-ink hover:bg-surface-2 hover:text-ink"
                  [attr.aria-current]="rla.isActive ? 'page' : null"
                >
                  <app-icon
                    [name]="item.icon"
                    [size]="19"
                    [strokeWidth]="rla.isActive ? 2.5 : 2"
                    [color]="rla.isActive ? 'var(--color-ink)' : undefined"
                  />
                  <span class="truncate">{{ t(item.label) }}</span>
                </a>
              </li>
            }
          </ul>
        }
      </nav>

      <div class="border-t-2 border-ink p-3">
        <ul class="space-y-1">
          @for (item of bottomItems; track item.route) {
            <li>
              <a
                [routerLink]="item.route"
                routerLinkActive="bg-primary text-ink font-bold shadow-[3px_3px_0_0_var(--color-ink)]"
                #rla="routerLinkActive"
                (click)="navigated.emit()"
                class="group flex items-center gap-3 rounded-button border-2 border-transparent px-3 py-2.5 text-sm font-medium text-ink-soft transition-all duration-150 hover:border-ink hover:bg-surface-2 hover:text-ink"
                [attr.aria-current]="rla.isActive ? 'page' : null"
              >
                <app-icon [name]="item.icon" [size]="19" [strokeWidth]="rla.isActive ? 2.5 : 2" />
                <span class="truncate">{{ t(item.label) }}</span>
              </a>
            </li>
          }
        </ul>

        <div class="mt-2 flex items-center gap-2.5 rounded-card border-2 border-ink bg-surface-2 p-3">
          <app-avatar [name]="user()?.name ?? t('User')" [size]="32" />
          <div class="min-w-0 flex-1">
            <p class="truncate text-sm font-bold text-ink">{{ user()?.name }}</p>
            <p class="truncate text-xs font-medium text-ink-soft">{{ user()?.email }}</p>
          </div>
          <button
            (click)="logout()"
            class="rounded-lg border-2 border-ink bg-surface p-1.5 text-ink-soft transition-all duration-150 hover:bg-danger hover:text-white"
            [attr.aria-label]="t('Log out')"
          >
            <app-icon name="log-out" [size]="17" />
          </button>
        </div>
      </div>
    </aside>
  `,
})
export class SidebarComponent {
  readonly collapsed = input(false);
  readonly navigated = output<void>();

  readonly sections = NAV_SECTIONS;
  readonly bottomItems = NAV_BOTTOM;

  private auth = inject(AuthService);
  private router = inject(Router);
  private i18n = inject(I18nService);

  protected readonly user = this.auth.user;
  protected readonly t = this.i18n.t.bind(this.i18n);

  protected logout(): void {
    this.auth.logout();
    this.router.navigate(['/login']);
  }
}
