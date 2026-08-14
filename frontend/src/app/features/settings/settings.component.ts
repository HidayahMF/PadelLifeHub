import { Component, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CardComponent } from '../../layout/components/card.component';
import { PageHeaderComponent } from '../../layout/components/page-header.component';
import { ButtonComponent } from '../../layout/components/button.component';
import { SelectComponent } from '../../layout/components/select.component';
import { ToggleComponent } from './components/toggle.component';
import { SkeletonComponent } from '../../layout/components/skeleton.component';
import { SettingService } from '../../core/services/data.service';
import { I18nService, type Lang } from '../../core/services/i18n.service';
import { ThemeService } from '../../core/services/theme.service';
import { ToastService } from '../../core/services/toast.service';
import { ApiService } from '../../core/services/api.service';
import type { Setting } from '../../core/models/misc.model';

@Component({
  selector: 'app-settings',
  standalone: true,
  imports: [
    FormsModule,
    CardComponent,
    PageHeaderComponent,
    ButtonComponent,
    SelectComponent,
    ToggleComponent,
    SkeletonComponent,
  ],
  template: `
    <app-page-header [title]="t('Settings')" [subtitle]="t('Personalize your LifeHub experience.')"
      actionLabel="" [action]="noop"></app-page-header>

    @if (loading()) {
      <div class="max-w-2xl space-y-4">@for (_ of [1, 2, 3]; track $index) { <app-skeleton size="button" class="rounded-card" /> }</div>
    } @else {
      <div class="max-w-2xl space-y-6">
        <app-card>
          <h2 class="text-base font-semibold text-ink">{{ t('Appearance') }}</h2>
          <div class="mt-5 flex items-center justify-between gap-4">
            <div class="min-w-0">
              <p class="text-sm font-medium text-ink">{{ t('Dark mode') }}</p>
              <p class="mt-0.5 text-sm text-ink-soft">{{ t('Reduce eye strain in low light.') }}</p>
            </div>
            <app-toggle [model]="dark()" [label]="t('Toggle dark mode')" (change)="toggleDark($event)" />
          </div>
          <div class="mt-5">
            <app-select [label]="t('Theme')" [options]="themeOptions()" [(ngModel)]="form.theme"
              (ngModelChange)="form.theme = $event; syncTheme()"></app-select>
          </div>
          <div class="mt-5">
            <app-select [label]="t('Language')" [options]="languageOptions()"
              [(ngModel)]="form.language" (ngModelChange)="setLanguage($event)"></app-select>
          </div>
        </app-card>

        <app-card>
          <h2 class="text-base font-semibold text-ink">{{ t('Keyboard shortcuts') }}</h2>
          <p class="mt-1 text-sm text-ink-soft">{{ t('Active everywhere, except while typing in a field.') }}</p>
          <div class="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2">
            @for (sc of shortcuts(); track sc.keys) {
              <div class="flex items-center justify-between rounded-button border-2 border-ink bg-surface-2 px-3 py-2">
                <span class="text-sm font-medium text-ink">{{ sc.action }}</span>
                <kbd class="rounded-md border-2 border-ink bg-surface px-2 py-0.5 font-display text-[11px] text-ink">
                  {{ sc.keys }}
                </kbd>
              </div>
            }
          </div>
        </app-card>

        <app-card>
          <h2 class="text-base font-semibold text-ink">{{ t('Export data') }}</h2>
          <p class="mt-1 text-sm text-ink-soft">{{ t('Download only your own data — no passwords or secrets.') }}</p>
          <div class="mt-4 flex flex-wrap gap-2">
            <app-button variant="secondary" icon="receipt" (click)="exportCsv('transactions')">
              {{ t('Transactions CSV') }}
            </app-button>
            <app-button variant="secondary" icon="list-todo" (click)="exportCsv('tasks')">
              {{ t('Tasks CSV') }}
            </app-button>
            <app-button icon="download" (click)="exportAll()">{{ t('Export my LifeHub data') }}</app-button>
          </div>
        </app-card>

        <app-card>
          <h2 class="text-base font-semibold text-ink">{{ t('Notifications') }}</h2>
          <div class="mt-5 space-y-5">
            <div class="flex items-center justify-between gap-4">
              <div class="min-w-0">
                <p class="text-sm font-medium text-ink">{{ t('Task reminders') }}</p>
                <p class="mt-0.5 text-sm text-ink-soft">{{ t('Notify before tasks are due.') }}</p>
              </div>
              <app-toggle [model]="form.notifications.taskReminders" [label]="t('Task reminders')"
                (change)="setNotif('taskReminders', $event)" />
            </div>
            <div class="flex items-center justify-between gap-4">
              <div class="min-w-0">
                <p class="text-sm font-medium text-ink">{{ t('Bill reminders') }}</p>
                <p class="mt-0.5 text-sm text-ink-soft">{{ t('Remind me about recurring bills.') }}</p>
              </div>
              <app-toggle [model]="form.notifications.billReminders" [label]="t('Bill reminders')"
                (change)="setNotif('billReminders', $event)" />
            </div>
            <div class="flex items-center justify-between gap-4">
              <div class="min-w-0">
                <p class="text-sm font-medium text-ink">{{ t('Habit reminders') }}</p>
                <p class="mt-0.5 text-sm text-ink-soft">{{ t('Keep your streaks going.') }}</p>
              </div>
              <app-toggle [model]="form.notifications.habitReminders" [label]="t('Habit reminders')"
                (change)="setNotif('habitReminders', $event)" />
            </div>
            <div class="flex items-center justify-between gap-4">
              <div class="min-w-0">
                <p class="text-sm font-medium text-ink">{{ t('Email updates') }}</p>
                <p class="mt-0.5 text-sm text-ink-soft">{{ t('Occasional product news.') }}</p>
              </div>
              <app-toggle [model]="form.notifications.emailUpdates" [label]="t('Email updates')"
                (change)="setNotif('emailUpdates', $event)" />
            </div>
          </div>
        </app-card>

        <div class="flex justify-end">
          <app-button icon="check" [loading]="saving()" (click)="save()">{{ t('Save changes') }}</app-button>
        </div>
      </div>
    }
  `,
})
export class SettingsComponent implements OnInit {
  private settingService = inject(SettingService);
  private themeService = inject(ThemeService);
  private i18n = inject(I18nService);
  private toast = inject(ToastService);
  private api = inject(ApiService);

  protected readonly t = this.i18n.t.bind(this.i18n);

  protected shortcuts(): { keys: string; action: string }[] {
    return [
      { keys: 'Ctrl K', action: this.t('Global search') },
      { keys: '/', action: this.t('Global search') },
      { keys: 'N', action: this.t('New task (quick add)') },
      { keys: 'D', action: this.t('Go to dashboard') },
      { keys: 'T', action: this.t('Go to tasks') },
      { keys: 'G', action: this.t('Go to goals') },
    ];
  }

  protected readonly loading = this.settingService.loading;
  protected readonly dark = this.themeService.dark;
  protected readonly saving = signal(false);

  /**
   * Theme & language start from the values that are live right now (topbar
   * toggle / OS preference / applied language) instead of hardcoded defaults.
   * This is done synchronously at construction so the very first render is
   * already correct — the backend merge below deliberately never overrides
   * these three fields (that used to flip the theme on page load and caused an
   * ExpressionChangedAfterItHasBeenCheckedError).
   */
  protected form: Setting = {
    theme: this.themeService.dark() ? 'dark' : 'light',
    darkMode: this.themeService.dark(),
    language: this.i18n.lang(),
    notifications: {
      taskReminders: true,
      billReminders: true,
      habitReminders: true,
      emailUpdates: false,
    },
  };

  protected readonly noop = (): void => {};

  protected readonly themeOptions = () => [
    { value: 'light', label: this.t('Light') },
    { value: 'dark', label: this.t('Dark') },
    { value: 'system', label: this.t('System') },
  ];

  protected readonly languageOptions = () => [
    { value: 'en', label: 'English' },
    { value: 'id', label: 'Bahasa Indonesia' },
  ];

  protected setLanguage(lang: Lang): void {
    this.form.language = lang;
    this.i18n.setLang(lang);
  }

  ngOnInit(): void {
    this.settingService.load();
    this.settingService.get().subscribe({
      next: (s) => {
        // Merge the persisted preferences, but keep theme / darkMode / language
        // pointing at the values the user is actually seeing right now.
        const { theme: _theme, darkMode: _darkMode, language: _language, ...rest } = s;
        this.form = {
          ...this.form,
          ...rest,
          notifications: { ...this.form.notifications, ...s.notifications },
        };
      },
      error: () => {},
    });
  }

  protected toggleDark(value: boolean): void {
    this.form.darkMode = value;
    this.form.theme = value ? 'dark' : 'light';
    this.themeService.set(value);
  }

  protected syncTheme(): void {
    if (this.form.theme === 'system') {
      // "System" should follow the OS, not silently fall back to light.
      const system = window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false;
      this.form.darkMode = system;
      this.themeService.set(system);
    } else {
      this.form.darkMode = this.form.theme === 'dark';
      this.themeService.set(this.form.darkMode);
    }
  }

  protected setNotif(key: keyof Setting['notifications'], value: boolean): void {
    this.form.notifications[key] = value;
  }

  protected save(): void {
    this.saving.set(true);
    this.settingService.update(this.form).subscribe({
      next: () => {
        this.saving.set(false);
        this.toast.success(this.t('Settings saved'));
      },
      error: (err: Error) => {
        this.saving.set(false);
        this.toast.error(err.message);
      },
    });
  }

  protected exportCsv(kind: 'transactions' | 'tasks'): void {
    this.api.download(`/export/${kind}`).subscribe({
      next: (blob) => this.saveBlob(blob, `lifehub-${kind}-${Date.now()}.csv`),
      error: (err: Error) => this.toast.error(err.message),
    });
  }

  protected exportAll(): void {
    this.api.download('/export/all').subscribe({
      next: (blob) => this.saveBlob(blob, `lifehub-data-${Date.now()}.json`),
      error: (err: Error) => this.toast.error(err.message),
    });
  }

  private saveBlob(blob: Blob, filename: string): void {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    this.toast.success(this.t('Download started'));
  }
}
