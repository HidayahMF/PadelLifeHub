import { signal } from '@angular/core';

// The user's currency preference, kept as a global signal so every component
// that calls formatCurrency() stays reactive when the setting changes.
const currentCurrency = signal('IDR');

/** Set the global display currency (called by SettingService on load/save). */
export function setCurrency(code: string): void {
  currentCurrency.set((code || 'IDR').toUpperCase());
}

/** Read the current display currency. */
export function getCurrency(): string {
  return currentCurrency();
}

/**
 * Format a number as currency using the user's currency setting (or an
 * explicit override). IDR and other zero-decimal currencies display whole
 * numbers (Rp10.000); others use two decimals ($10.00).
 */
export function formatCurrency(value: number, currency?: string): string {
  const code = (currency ?? currentCurrency()).toUpperCase();
  const zeroFraction = ['IDR', 'JPY', 'KRW', 'VND'].includes(code);
  const locale = code === 'IDR' ? 'id-ID' : 'en-US';
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: code,
    minimumFractionDigits: zeroFraction ? 0 : 2,
    maximumFractionDigits: zeroFraction ? 0 : 2,
  }).format(value ?? 0);
}

export function formatNumber(value: number): string {
  return new Intl.NumberFormat('en-US').format(value ?? 0);
}

export function formatDate(value: string | Date | null | undefined, style: 'short' | 'long' | 'medium' = 'medium'): string {
  if (!value) return '';
  const date = toDate(value);
  if (style === 'short') {
    return new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short' }).format(date);
  }
  if (style === 'long') {
    return new Intl.DateTimeFormat('en-US', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    }).format(date);
  }
  return new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }).format(date);
}

export function formatTime(value: string | Date | null | undefined): string {
  if (!value) return '';
  return new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit' }).format(toDate(value));
}

export function formatDateTime(value: string | Date | null | undefined): string {
  if (!value) return '';
  return `${formatDate(value)} · ${formatTime(value)}`;
}

export function toDate(value: string | Date): Date {
  if (value instanceof Date) return value;
  return new Date(value);
}

export function startOfDay(date: Date = new Date()): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

export function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

export function daysUntil(value: string | Date | null | undefined): number {
  if (!value) return 0;
  const target = startOfDay(toDate(value));
  const today = startOfDay();
  return Math.round((target.getTime() - today.getTime()) / 86_400_000);
}

export function relativeDay(value: string | Date | null | undefined): string {
  if (!value) return '';
  const diff = daysUntil(value);
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Tomorrow';
  if (diff === -1) return 'Yesterday';
  return formatDate(value, 'medium');
}

export function isOverdue(value: string | Date | null | undefined): boolean {
  if (!value) return false;
  return daysUntil(value) < 0;
}

export function isToday(value: string | Date | null | undefined): boolean {
  if (!value) return false;
  return daysUntil(value) === 0;
}

export function monthKey(date: Date = new Date()): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

export function monthLabel(month: string): string {
  const [year, m] = month.split('-').map(Number);
  const date = new Date(year, m - 1, 1);
  return new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric' }).format(date);
}

export function initials(name: string): string {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0].toUpperCase())
    .join('');
}

export function titleCase(value: string): string {
  return value
    .split('-')
    .map((w) => (w ? w[0].toUpperCase() + w.slice(1) : w))
    .join(' ');
}

export function clampProgress(value: number, max = 100): number {
  if (!value) return 0;
  return Math.min(100, Math.max(0, Math.round((value / max) * 100)));
}

export function percent(value: number, max: number): number {
  if (!max) return 0;
  return Math.min(100, Math.max(0, (value / max) * 100));
}
