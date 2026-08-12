import { Injectable, signal } from '@angular/core';

/**
 * Global UI command state — lets any part of the app (topbar buttons, keyboard
 * shortcuts, pages) open the shared search / quick-add overlays.
 */
@Injectable({ providedIn: 'root' })
export class CommandService {
  readonly searchOpen = signal(false);
  readonly quickAddOpen = signal(false);
  /** Optional pre-selected entity when opening quick add (e.g. 'task'). */
  readonly quickAddEntity = signal<string | null>(null);

  openSearch(): void {
    this.searchOpen.set(true);
  }

  closeSearch(): void {
    this.searchOpen.set(false);
  }

  openQuickAdd(entity?: string): void {
    this.quickAddEntity.set(entity ?? null);
    this.quickAddOpen.set(true);
  }

  closeQuickAdd(): void {
    this.quickAddOpen.set(false);
    this.quickAddEntity.set(null);
  }
}
