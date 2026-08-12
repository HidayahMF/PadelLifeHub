import { Component, HostListener, inject, OnInit, signal } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { SidebarComponent } from './sidebar/sidebar.component';
import { TopbarComponent } from './topbar/topbar.component';
import { GlobalSearchComponent } from './components/global-search.component';
import { QuickAddComponent } from './components/quick-add.component';
import { ShortcutsService } from '../core/services/shortcuts.service';

@Component({
  selector: 'app-layout',
  standalone: true,
  imports: [
    RouterOutlet,
    SidebarComponent,
    TopbarComponent,
    GlobalSearchComponent,
    QuickAddComponent,
  ],
  template: `
    <div class="flex h-dvh overflow-hidden bg-bg">
      <!-- Mobile overlay drawer -->
      @if (mobileOpen()) {
        <div class="fixed inset-0 z-40 lg:hidden">
          <div
            class="absolute inset-0 bg-black/50 animate-fade-in"
            (click)="mobileOpen.set(false)"
          ></div>
          <div class="absolute left-0 top-0 z-10 h-full animate-slide-in-left">
            <app-sidebar (navigated)="mobileOpen.set(false)"></app-sidebar>
          </div>
        </div>
      }

      <!-- Desktop sidebar -->
      <div
        class="hidden lg:block"
        [class]="collapsed() ? 'w-0 overflow-hidden' : 'w-[248px] shrink-0'"
      >
        <app-sidebar [collapsed]="collapsed()"></app-sidebar>
      </div>

      <div class="flex min-w-0 flex-1 flex-col">
        <app-topbar (menu)="mobileOpen.set(true)"></app-topbar>
        <main
          class="mx-auto w-full max-w-[1440px] flex-1 overflow-y-auto px-4 py-6 lg:px-8 lg:py-8"
        >
          <router-outlet />
        </main>
      </div>

      <!-- Global overlays -->
      <app-global-search />
      <app-quick-add />
    </div>
  `,
})
export class LayoutComponent implements OnInit {
  private shortcuts = inject(ShortcutsService);

  protected readonly mobileOpen = signal(false);
  protected readonly collapsed = signal(false);

  ngOnInit(): void {
    this.shortcuts.init();
  }

  @HostListener('window:keydown', ['$event'])
  protected onKey(event: KeyboardEvent): void {
    if (event.key === 'Escape') {
      this.mobileOpen.set(false);
    }
  }
}
