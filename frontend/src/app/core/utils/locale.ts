/**
 * Module-level locale registry used by the pure formatting utilities in
 * format.ts. The I18nService updates it whenever the user switches language,
 * so date/month labels follow the UI language without changing every call site.
 */
let currentLocale = 'en-GB';

export function setLocale(locale: string): void {
  currentLocale = locale;
}

export function getLocale(): string {
  return currentLocale;
}
