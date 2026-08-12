import { inject, Injectable } from '@angular/core';
import { Router } from '@angular/router';
import { CommandService } from './command.service';

/**
 * Global keyboard shortcuts (Ctrl+K → search, / → search, N → new task, and
 * single-key navigation D/T/G). Shortcuts are suppressed while the user is
 * typing in any input/textarea/select/contenteditable element.
 */
@Injectable({ providedIn: 'root' })
export class ShortcutsService {
  private command = inject(CommandService);
  private router = inject(Router);
  private initialized = false;

  /** Register the window-level keydown listener once. */
  init(): void {
    if (this.initialized) return;
    this.initialized = true;
    window.addEventListener('keydown', (event) => this.onKey(event));
  }

  private isTyping(target: EventTarget | null): boolean {
    const el = target as HTMLElement | null;
    if (!el || !el.tagName) return false;
    const tag = el.tagName;
    return (
      tag === 'INPUT' ||
      tag === 'TEXTAREA' ||
      tag === 'SELECT' ||
      el.isContentEditable
    );
  }

  private onKey(event: KeyboardEvent): void {
    if (this.isTyping(event.target)) return;

    // Never hijack keys while the search or quick-add overlays are open.
    if (this.command.searchOpen() || this.command.quickAddOpen()) return;

    const key = event.key.toLowerCase();
    const mod = event.ctrlKey || event.metaKey;

    // Ctrl/Cmd + K — global search
    if (mod && key === 'k') {
      event.preventDefault();
      this.command.openSearch();
      return;
    }
    // "/" — global search (vim-style)
    if (key === '/') {
      event.preventDefault();
      this.command.openSearch();
      return;
    }
    // N — new task (quick add)
    if (key === 'n') {
      event.preventDefault();
      this.command.openQuickAdd('task');
      return;
    }
    // Single-letter navigation
    if (key === 'd') {
      event.preventDefault();
      this.router.navigate(['/dashboard']);
    } else if (key === 't') {
      event.preventDefault();
      this.router.navigate(['/tasks']);
    } else if (key === 'g') {
      event.preventDefault();
      this.router.navigate(['/goals']);
    }
  }
}
