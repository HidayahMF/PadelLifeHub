import { effect, inject, Injectable, signal } from '@angular/core';
import { ID } from '../i18n/id';
import { setLocale } from '../utils/locale';
import { SettingService } from './data.service';

export type Lang = 'en' | 'id';

/** localStorage key used to persist the language for public/guest visitors. */
const STORAGE_KEY = 'lifehub_lang';

/** Indonesian browser → ID, anything else → EN. */
function detectBrowserLang(): Lang {
  const candidates =
    typeof navigator !== 'undefined'
      ? navigator.languages ?? [navigator.language]
      : ['en'];
  return candidates.some((l) => l.toLowerCase().startsWith('id')) ? 'id' : 'en';
}

/**
 * Lightweight i18n. English source strings act as keys; the ID dictionary
 * (core/i18n/id.ts) maps them to Bahasa Indonesia. Any string without an
 * entry safely falls back to English.
 *
 * `t()` reads the `lang` signal internally, so Angular re-renders every
 * `{{ t('...') }}` binding automatically when the language changes.
 *
 * Language resolution priority:
 *   1. Backend user settings (authenticated users — the persisted source of truth)
 *   2. localStorage (a manually chosen language, e.g. by public visitors)
 *   3. Browser language detection (first visit)
 *   4. English (default)
 */
@Injectable({ providedIn: 'root' })
export class I18nService {
  private settings = inject(SettingService);

  /** Active language ('en' | 'id'). */
  readonly lang = signal<Lang>('en');

  constructor() {
    // Public/guest visitors have no backend settings yet — restore a manually
    // chosen language from localStorage, otherwise detect the browser language.
    const stored = this.readStored();
    this.applyLang(stored ?? detectBrowserLang());

    // Authenticated users: the backend setting wins whenever it arrives.
    effect(() => {
      const saved = this.settings.settings()?.language;
      if (saved === 'id' || saved === 'en') {
        this.applyLang(saved);
        this.writeStored(saved);
      }
    });
  }

  /** Translate an English source string into the active language. */
  t(key: string, params?: Record<string, string | number>): string {
    this.lang(); // track dependency so templates re-render on switch
    let out = this.lang() === 'id' ? (ID[key] ?? key) : key;
    if (params) {
      for (const [k, v] of Object.entries(params)) {
        out = out.replaceAll(`{${k}}`, String(v));
      }
    }
    return out;
  }

  /** Switch the active language, persist it, and update the locale/html lang. */
  setLang(lang: Lang): void {
    this.applyLang(lang);
    this.writeStored(lang);
    this.settings.update({ language: lang }).subscribe({ error: () => undefined });
  }

  private applyLang(lang: Lang): void {
    this.lang.set(lang);
    setLocale(lang === 'id' ? 'id-ID' : 'en-GB');
    if (typeof document !== 'undefined') {
      document.documentElement.lang = lang;
    }
  }

  private readStored(): Lang | null {
    try {
      const v = localStorage.getItem(STORAGE_KEY);
      return v === 'id' || v === 'en' ? v : null;
    } catch {
      return null;
    }
  }

  private writeStored(lang: Lang): void {
    try {
      localStorage.setItem(STORAGE_KEY, lang);
    } catch {
      /* storage unavailable (private mode) — language still applies for the session */
    }
  }
}
