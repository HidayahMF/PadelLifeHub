import { Component, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CardComponent } from '../../layout/components/card.component';
import { PageHeaderComponent } from '../../layout/components/page-header.component';
import { ButtonComponent } from '../../layout/components/button.component';
import { SelectComponent } from '../../layout/components/select.component';
import { ToggleComponent } from './components/toggle.component';
import { SkeletonComponent } from '../../layout/components/skeleton.component';
import { SettingService } from '../../core/services/data.service';
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
    <app-page-header title="Settings" subtitle="Personalize your LifeHub experience."
      actionLabel="" [action]="noop"></app-page-header>

    @if (loading()) {
      <div class="max-w-2xl space-y-4">@for (_ of [1, 2, 3]; track $index) { <app-skeleton size="button" class="rounded-card" /> }</div>
    } @else {
      <div class="max-w-2xl space-y-6">
        <app-card>
          <h2 class="text-base font-semibold text-ink">Appearance</h2>
          <div class="mt-5 flex items-center justify-between gap-4">
            <div class="min-w-0">
              <p class="text-sm font-medium text-ink">Dark mode</p>
              <p class="mt-0.5 text-sm text-ink-soft">Reduce eye strain in low light.</p>
            </div>
            <app-toggle [model]="dark()" label="Toggle dark mode" (change)="toggleDark($event)" />
          </div>
          <div class="mt-5">
            <app-select label="Theme" [options]="themeOptions()" [(ngModel)]="form.theme"
              (ngModelChange)="form.theme = $event; syncTheme()"></app-select>
          </div>
          <div class="mt-5">
            <app-select label="Language" [options]="languageOptions()" [disabled]="true"
              [hint]="'Language switching is coming soon.'"
              [(ngModel)]="form.language"></app-select>
          </div>
        </app-card>

        <app-card>
          <h2 class="text-base font-semibold text-ink">Keyboard shortcuts</h2>
          <p class="mt-1 text-sm text-ink-soft">Active everywhere, except while typing in a field.</p>
          <div class="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2">
            @for (sc of shortcuts; track sc.keys) {
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
          <h2 class="text-base font-semibold text-ink">Export data</h2>
          <p class="mt-1 text-sm text-ink-soft">Download only your own data — no passwords or secrets.</p>
          <div class="mt-4 flex flex-wrap gap-2">
            <app-button variant="secondary" icon="receipt" (click)="exportCsv('transactions')">
              Transactions CSV
            </app-button>
            <app-button variant="secondary" icon="list-todo" (click)="exportCsv('tasks')">
              Tasks CSV
            </app-button>
            <app-button icon="download" (click)="exportAll()">Export my LifeHub data</app-button>
          </div>
        </app-card>

        <app-card>
          <h2 class="text-base font-semibold text-ink">Notifications</h2>
          <div class="mt-5 space-y-5">
            <div class="flex items-center justify-between gap-4">
              <div class="min-w-0">
                <p class="text-sm font-medium text-ink">Task reminders</p>
                <p class="mt-0.5 text-sm text-ink-soft">Notify before tasks are due.</p>
              </div>
              <app-toggle [model]="form.notifications.taskReminders" label="Task reminders"
                (change)="setNotif('taskReminders', $event)" />
            </div>
            <div class="flex items-center justify-between gap-4">
              <div class="min-w-0">
                <p class="text-sm font-medium text-ink">Bill reminders</p>
                <p class="mt-0.5 text-sm text-ink-soft">Remind me about recurring bills.</p>
              </div>
              <app-toggle [model]="form.notifications.billReminders" label="Bill reminders"
                (change)="setNotif('billReminders', $event)" />
            </div>
            <div class="flex items-center justify-between gap-4">
              <div class="min-w-0">
                <p class="text-sm font-medium text-ink">Habit reminders</p>
                <p class="mt-0.5 text-sm text-ink-soft">Keep your streaks going.</p>
              </div>
              <app-toggle [model]="form.notifications.habitReminders" label="Habit reminders"
                (change)="setNotif('habitReminders', $event)" />
            </div>
            <div class="flex items-center justify-between gap-4">
              <div class="min-w-0">
                <p class="text-sm font-medium text-ink">Email updates</p>
                <p class="mt-0.5 text-sm text-ink-soft">Occasional product news.</p>
              </div>
              <app-toggle [model]="form.notifications.emailUpdates" label="Email updates"
                (change)="setNotif('emailUpdates', $event)" />
            </div>
          </div>
        </app-card>

        <div class="flex justify-end">
          <app-button icon="check" [loading]="saving()" (click)="save()">Save changes</app-button>
        </div>
      </div>
    }
  `,
})
export class SettingsComponent implements OnInit {
  private settingService = inject(SettingService);
  private themeService = inject(ThemeService);
  private toast = inject(ToastService);
  private api = inject(ApiService);

  protected readonly shortcuts = [
    { keys: 'Ctrl K', action: 'Global search' },
    { keys: '/', action: 'Global search' },
    { keys: 'N', action: 'New task (quick add)' },
    { keys: 'D', action: 'Go to dashboard' },
    { keys: 'T', action: 'Go to tasks' },
    { keys: 'G', action: 'Go to goals' },
  ];

  protected readonly loading = this.settingService.loading;
  protected readonly dark = this.themeService.dark;
  protected readonly saving = signal(false);

  protected form: Setting = {
    theme: 'light',
    darkMode: false,
    language: 'en',
    notifications: {
      taskReminders: true,
      billReminders: true,
      habitReminders: true,
      emailUpdates: false,
    },
  };

  protected readonly noop = (): void => {};

  protected readonly themeOptions = () => [
    { value: 'light', label: 'Light' },
    { value: 'dark', label: 'Dark' },
    { value: 'system', label: 'System' },
  ];

  protected readonly languageOptions = () => [
    { value: 'en', label: 'English' },
    { value: 'id', label: 'Bahasa Indonesia' },
    { value: 'ms', label: 'Bahasa Melayu' },
  ];

  ngOnInit(): void {
    this.settingService.load();
    this.settingService.get().subscribe({
      next: (s) => {
        this.form = { ...this.form, ...s, notifications: { ...this.form.notifications, ...s.notifications } };
        this.themeService.set(s.darkMode);
      },
      error: () => {
        this.themeService.set(this.form.darkMode);
      },
    });
  }

  protected toggleDark(value: boolean): void {
    this.form.darkMode = value;
    this.form.theme = value ? 'dark' : 'light';
    this.themeService.set(value);
  }

  protected syncTheme(): void {
    this.form.darkMode = this.form.theme === 'dark';
    this.themeService.set(this.form.darkMode);
  }

  protected setNotif(key: keyof Setting['notifications'], value: boolean): void {
    this.form.notifications[key] = value;
  }

  protected save(): void {
    this.saving.set(true);
    this.settingService.update(this.form).subscribe({
      next: () => {
        this.saving.set(false);
        this.toast.success('Settings saved');
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
    this.toast.success('Download started');
  }
}
