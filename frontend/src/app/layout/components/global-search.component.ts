import {
  Component,
  computed,
  HostListener,
  inject,
  OnDestroy,
  OnInit,
  signal,
} from '@angular/core';
import { toObservable } from '@angular/core/rxjs-interop';
import { Router } from '@angular/router';
import { Subscription } from 'rxjs';
import { CommandService } from '../../core/services/command.service';
import { SearchService } from '../../core/services/search.service';
import { I18nService } from '../../core/services/i18n.service';
import { IconComponent } from './icon.component';
import { SkeletonComponent } from './skeleton.component';
import type { SearchResults } from '../../core/models/misc.model';
import { formatCurrency, formatDate, formatTime } from '../../core/utils/format';

interface SearchHit {
  id: string;
  icon: string;
  title: string;
  subtitle: string;
  route: string[];
  queryParams?: Record<string, string>;
}

type Row = { kind: 'header'; label: string; icon: string } | { kind: 'item'; hit: SearchHit };

interface GroupConfig {
  key: keyof SearchResults;
  label: string;
  icon: string;
}

const GROUPS: GroupConfig[] = [
  { key: 'tasks', label: 'Tasks', icon: 'list-todo' },
  { key: 'habits', label: 'Habits', icon: 'flame' },
  { key: 'goals', label: 'Goals', icon: 'target' },
  { key: 'notes', label: 'Notes', icon: 'sticky-note' },
  { key: 'transactions', label: 'Transactions', icon: 'receipt' },
  { key: 'reminders', label: 'Reminders', icon: 'clock' },
  { key: 'wishlist', label: 'Wishlist', icon: 'gift' },
  { key: 'needs', label: 'Needs', icon: 'shopping-basket' },
];

/** Split text into highlighted/normal segments for the given query. */
function highlightSegments(text: string, query: string): { text: string; hit: boolean }[] {
  if (!query) return [{ text, hit: false }];
  const lower = text.toLowerCase();
  const q = query.toLowerCase();
  const out: { text: string; hit: boolean }[] = [];
  let i = 0;
  while (i < text.length) {
    const idx = lower.indexOf(q, i);
    if (idx === -1) {
      if (i < text.length) out.push({ text: text.slice(i), hit: false });
      break;
    }
    if (idx > i) out.push({ text: text.slice(i, idx), hit: false });
    out.push({ text: text.slice(idx, idx + q.length), hit: true });
    i = idx + q.length;
  }
  return out;
}

@Component({
  selector: 'app-global-search',
  standalone: true,
  imports: [IconComponent, SkeletonComponent],
  template: `
    @if (open()) {
      <div class="fixed inset-0 z-[60]">
        <div class="absolute inset-0 bg-black/60 animate-fade-in" (click)="close()"></div>

        <div
          class="relative mx-auto flex h-full w-full flex-col border-ink bg-surface sm:mt-14 sm:h-auto sm:max-h-[78vh] sm:w-[min(640px,92vw)] sm:rounded-card sm:border-2 sm:shadow-pop animate-scale-in"
          role="dialog"
          aria-modal="true"
          [attr.aria-label]="t('Global search')"
        >
          <!-- Search input -->
          <div class="flex items-center gap-3 border-b-2 border-ink px-4 sm:px-5">
            <app-icon name="search" [size]="20" color="var(--color-ink-soft)" />
            <input
              #searchInput
              type="text"
              [placeholder]="t('Search tasks, transactions, notes…')"
              (input)="onInput($any($event.target).value)"
              (keydown.arrowdown)="move(1)"
              (keydown.arrowup)="move(-1)"
              (keydown.enter)="openActive()"
              class="h-14 w-full bg-transparent text-base font-medium text-ink placeholder:text-ink-faint focus:outline-none"
              [attr.aria-label]="t('Search LifeHub')"
            />
            @if (query()) {
              <button
                (click)="clear()"
                class="flex h-7 w-7 shrink-0 items-center justify-center rounded-md border-2 border-ink bg-surface-2 text-ink transition-all hover:bg-danger hover:text-white"
                [attr.aria-label]="t('Clear search')"
              >
                <app-icon name="x" [size]="14" [strokeWidth]="3" />
              </button>
            } @else {
              <kbd
                class="hidden shrink-0 rounded-md border-2 border-ink bg-surface-2 px-1.5 py-0.5 font-display text-[10px] text-ink-soft sm:block"
                >ESC</kbd
              >
            }
          </div>

          <!-- Results -->
          <div class="min-h-0 flex-1 overflow-y-auto">
            @if (loading()) {
              <div class="space-y-3 p-4 sm:p-5">
                @for (_ of [1, 2, 3, 4, 5]; track $index) {
                  <app-skeleton size="field" />
                }
              </div>
            } @else if (error()) {
              <div class="px-6 py-12 text-center">
                <app-icon name="alert-circle" [size]="30" class="mx-auto text-ink-faint" />
                <p class="mt-3 font-display text-lg text-ink">{{ t('Something went wrong') }}</p>
                <p class="mt-1 text-sm text-ink-soft">{{ t('Try again in a moment.') }}</p>
                <button
                  (click)="onInput(query())"
                  class="mt-4 rounded-button border-2 border-ink bg-primary px-4 py-2 text-sm font-bold text-ink shadow-soft hover:bg-primary-strong"
                >
                  {{ t('Try again') }}
                </button>
              </div>
            } @else if (searched() && rows().length === 0) {
              <div class="px-6 py-12 text-center">
                <app-icon name="search" [size]="30" class="mx-auto text-ink-faint" />
                <p class="mt-3 font-display text-lg text-ink">{{ t('No results for “{q}”', { q: query() }) }}</p>
                <p class="mt-1 text-sm text-ink-soft">{{ t('Try a different keyword.') }}</p>
              </div>
            } @else if (!searched()) {
              <div class="px-6 py-12 text-center">
                <app-icon name="sparkles" [size]="30" class="mx-auto text-ink-faint" />
                <p class="mt-3 text-sm font-medium text-ink-soft">
                  {{ t('Search your tasks, notes, transactions, goals, habits, wishlist, needs and reminders.') }}
                </p>
              </div>
            } @else {
              <ul class="py-2">
                @for (row of rows(); track rowKey($index, row)) {
                  @if (row.kind === 'header') {
                    <li
                      class="flex items-center gap-2 px-5 pb-1.5 pt-4 text-[11px] font-bold uppercase tracking-widest text-ink-faint"
                    >
                      <app-icon [name]="row.icon" [size]="13" />
                      {{ t(row.label) }}
                    </li>
                  } @else {
                    <li>
                      <button
                        (click)="openHit(row.hit)"
                        (mouseenter)="setActive(row.hit)"
                        class="flex w-full items-center gap-3 px-5 py-2.5 text-left transition-colors"
                        [class]="
                          isActive(row.hit)
                            ? 'bg-primary/15'
                            : 'hover:bg-surface-2'
                        "
                      >
                        <span
                          class="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border-2 border-ink"
                          [class]="isActive(row.hit) ? 'bg-primary' : 'bg-surface-2'"
                        >
                          <app-icon [name]="row.hit.icon" [size]="15" />
                        </span>
                        <span class="min-w-0 flex-1">
                          <span class="block truncate text-sm font-semibold text-ink">
                            @for (seg of highlight(row.hit.title, query()); track seg) {
                              <mark
                                [class]="
                                  seg.hit
                                    ? 'bg-primary px-0 font-bold text-ink'
                                    : 'bg-transparent font-medium text-ink'
                                "
                                >{{ seg.text }}</mark
                              >
                            }
                          </span>
                          @if (row.hit.subtitle) {
                            <span class="block truncate text-xs text-ink-soft">
                              {{ row.hit.subtitle }}
                            </span>
                          }
                        </span>
                        <app-icon
                          name="arrow-right"
                          [size]="14"
                          class="shrink-0 text-ink-faint"
                        />
                      </button>
                    </li>
                  }
                }
              </ul>
            }
          </div>

          <!-- Footer hints -->
          <div
            class="hidden items-center gap-4 border-t-2 border-ink px-5 py-2.5 text-[11px] font-medium text-ink-faint sm:flex"
          >
            <span class="flex items-center gap-1">
              <kbd class="rounded border-2 border-ink bg-surface-2 px-1 font-bold">↑↓</kbd> {{ t('navigate') }}
            </span>
            <span class="flex items-center gap-1">
              <kbd class="rounded border-2 border-ink bg-surface-2 px-1 font-bold">↵</kbd> {{ t('open') }}
            </span>
            <span class="flex items-center gap-1">
              <kbd class="rounded border-2 border-ink bg-surface-2 px-1 font-bold">esc</kbd> {{ t('close') }}
            </span>
          </div>
        </div>
      </div>
    }
  `,
})
export class GlobalSearchComponent implements OnInit, OnDestroy {
  private searchService = inject(SearchService);
  private command = inject(CommandService);
  private router = inject(Router);
  private i18n = inject(I18nService);

  protected readonly t = this.i18n.t.bind(this.i18n);

  protected readonly open = this.command.searchOpen;
  protected readonly query = signal('');
  protected readonly loading = signal(false);
  protected readonly searched = signal(false);
  protected readonly error = signal(false);
  protected readonly results = signal<SearchResults | null>(null);
  protected readonly activeIndex = signal(-1);

  private readonly open$ = toObservable(this.command.searchOpen);

  private debounce: ReturnType<typeof setTimeout> | null = null;
  private searchSub: Subscription | null = null;

  protected readonly rows = computed<Row[]>(() => {
    const r = this.results();
    if (!r) return [];
    const rows: Row[] = [];
    for (const group of GROUPS) {
      const items = r[group.key] ?? [];
      if (items.length > 0) {
        rows.push({ kind: 'header', label: group.label, icon: group.icon });
        for (const item of items) rows.push({ kind: 'item', hit: this.toHit(group, item) });
      }
    }
    return rows;
  });

  ngOnInit(): void {
    // Reset state every time the search is opened.
    const sub = this.open$.subscribe((openNow) => {
      if (openNow) {
        this.query.set('');
        this.results.set(null);
        this.searched.set(false);
        this.error.set(false);
        this.activeIndex.set(-1);
        setTimeout(() => {
          const input = document.querySelector<HTMLInputElement>(
            'app-global-search input[type="text"]'
          );
          input?.focus();
        }, 0);
      }
    });
    this.subs.push(sub);
  }

  ngOnDestroy(): void {
    this.subs.forEach((s) => s.unsubscribe());
    if (this.debounce) clearTimeout(this.debounce);
    this.searchSub?.unsubscribe();
  }

  private readonly subs: Subscription[] = [];

  protected onInput(value: string): void {
    this.query.set(value);
    if (this.debounce) clearTimeout(this.debounce);
    this.activeIndex.set(-1);
    const q = value.trim();
    if (!q) {
      this.results.set(null);
      this.searched.set(false);
      this.loading.set(false);
      this.error.set(false);
      return;
    }
    this.loading.set(true);
    this.error.set(false);
    this.debounce = setTimeout(() => this.runSearch(q), 250);
  }

  private runSearch(q: string): void {
    this.searchSub?.unsubscribe();
    this.searchSub = this.searchService.search(q).subscribe({
      next: (res) => {
        this.results.set(res.results);
        this.loading.set(false);
        this.searched.set(true);
      },
      error: () => {
        this.loading.set(false);
        this.error.set(true);
      },
    });
  }

  protected clear(): void {
    this.onInput('');
    const input = document.querySelector<HTMLInputElement>(
      'app-global-search input[type="text"]'
    );
    input?.focus();
  }

  protected move(dir: 1 | -1): void {
    const items = this.rows().filter((r) => r.kind === 'item').length;
    if (items === 0) return;
    this.activeIndex.update((i) => (i + dir + items) % items);
  }

  protected setActive(hit: SearchHit): void {
    const idx = this.itemRows().findIndex((r) => r.hit.id === hit.id);
    this.activeIndex.set(idx);
  }

  protected isActive(hit: SearchHit): boolean {
    const idx = this.itemRows().findIndex((r) => r.hit.id === hit.id);
    return idx === this.activeIndex();
  }

  protected openActive(): void {
    const rows = this.itemRows();
    const idx = this.activeIndex();
    const hit = idx >= 0 ? rows[idx]?.hit : rows[0]?.hit;
    if (hit) this.openHit(hit);
  }

  protected openHit(hit: SearchHit): void {
    this.close();
    this.router.navigate(hit.route, hit.queryParams ? { queryParams: hit.queryParams } : undefined);
  }

  protected close(): void {
    this.command.closeSearch();
  }

  @HostListener('document:keydown.escape')
  protected onEsc(): void {
    if (this.open()) this.close();
  }

  protected readonly rowKey = (index: number, row: Row): string =>
    row.kind === 'header' ? `h-${index}` : `i-${row.hit.id}`;

  private itemRows() {
    return this.rows().filter((r) => r.kind === 'item') as { kind: 'item'; hit: SearchHit }[];
  }

  protected highlight(text: string, query: string) {
    return highlightSegments(text, query);
  }

  private toHit(group: GroupConfig, item: any): SearchHit {
    const base = {
      id: item._id,
      icon: group.icon,
      route: [this.routeFor(group.key)],
    };
    switch (group.key) {
      case 'tasks':
        return {
          ...base,
          title: item.title,
          subtitle: `${item.status ?? 'todo'}${item.dueDate ? ` · ${formatDate(item.dueDate)}` : ''}`,
          queryParams: { search: item.title },
        };
      case 'transactions':
        return {
          ...base,
          title: item.description || this.t('Transaction'),
          subtitle: `${item.type === 'income' ? '+' : '−'}${formatCurrency(item.amount)} · ${formatDate(item.date, 'short')}`,
        };
      case 'notes':
        return {
          ...base,
          title: item.title,
          subtitle: item.content ? item.content.slice(0, 80) : '',
        };
      case 'goals':
        return {
          ...base,
          title: item.title,
          subtitle:
            item.target != null
              ? `${item.progress ?? 0} / ${item.target} ${item.unit ?? ''}`.trim()
              : (item.description ?? ''),
        };
      case 'habits':
        return {
          ...base,
          title: item.name,
          subtitle: this.t('{n}-day streak', { n: item.streak ?? 0 }),
        };
      case 'wishlist':
        return {
          ...base,
          title: item.name,
          subtitle: formatCurrency(item.price),
        };
      case 'needs':
        return {
          ...base,
          title: item.name,
          subtitle: `×${item.quantity ?? 1}${item.price ? ` · ${formatCurrency(item.price)}` : ''}`,
        };
      case 'reminders':
        return {
          ...base,
          title: item.title,
          subtitle: item.datetime ? `${formatDate(item.datetime)} · ${formatTime(item.datetime)}` : '',
        };
    }
  }

  private routeFor(key: keyof SearchResults): string {
    switch (key) {
      case 'tasks':
        return '/tasks';
      case 'transactions':
        return '/finance';
      case 'notes':
        return '/notes';
      case 'goals':
        return '/goals';
      case 'habits':
        return '/habits';
      case 'wishlist':
        return '/wishlist';
      case 'needs':
        return '/needs';
      case 'reminders':
        return '/calendar';
    }
  }
}
