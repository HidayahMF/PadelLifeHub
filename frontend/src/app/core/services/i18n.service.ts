import { effect, inject, Injectable, signal } from '@angular/core';
import { ID } from '../i18n/id';
import { setLocale } from '../utils/locale';
import { SettingService } from './data.service';

export type Lang = 'en' | 'id';

/**
 * Lightweight i18n. English source strings act as keys; the ID dictionary
 * (core/i18n/id.ts) maps them to Bahasa Indonesia. Any string without an
 * entry safely falls back to English.
 *
 * `t()` reads the `lang` signal internally, so Angular re-renders every
 * `{{ t('...') }}` binding automatically when the language changes.
 */
@Injectable({ providedIn: 'root' })
export class I18nService {
  private settings = inject(SettingService);

  /** Active language ('en' | 'id'). */
  readonly lang = signal<Lang>('en');

  constructor() {
    // Apply the persisted language whenever settings arrive (login / reload).
    effect(() => {
      const saved = this.settings.settings()?.language;
      if (saved === 'id' || saved === 'en') {
        this.applyLang(saved);
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

  /** Switch the active language and persist it to the user's settings. */
  setLang(lang: Lang): void {
    this.applyLang(lang);
    this.settings.update({ language: lang }).subscribe({ error: () => undefined });
  }

  private applyLang(lang: Lang): void {
    this.lang.set(lang);
    setLocale(lang === 'id' ? 'id-ID' : 'en-GB');
  }
}
