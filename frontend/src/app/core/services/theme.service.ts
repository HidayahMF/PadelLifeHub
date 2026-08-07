import { Injectable, signal } from '@angular/core';

const THEME_KEY = 'lifehub_theme';

@Injectable({ providedIn: 'root' })
export class ThemeService {
  readonly dark = signal<boolean>(this.loadPreference());

  constructor() {
    this.apply(this.dark());
  }

  toggle() {
    this.set(!this.dark());
  }

  set(value: boolean) {
    this.dark.set(value);
    localStorage.setItem(THEME_KEY, value ? 'dark' : 'light');
    this.apply(value);
  }

  private apply(dark: boolean) {
    document.documentElement.classList.toggle('dark', dark);
  }

  private loadPreference(): boolean {
    const stored = localStorage.getItem(THEME_KEY);
    if (stored) return stored === 'dark';
    return window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false;
  }
}
