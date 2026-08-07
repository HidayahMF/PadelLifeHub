import { Component, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CardComponent } from '../../shared/components/card/card.component';
import { PageHeaderComponent } from '../../shared/components/page-header/page-header.component';
import { ButtonComponent } from '../../shared/components/button/button.component';
import { SelectComponent } from '../../shared/components/select/select.component';
import { ToggleComponent } from '../../shared/components/toggle/toggle.component';
import { SkeletonComponent } from '../../shared/components/skeleton/skeleton.component';
import { SettingService } from '../../core/services/data.service';
import { ThemeService } from '../../core/services/theme.service';
import { ToastService } from '../../core/services/toast.service';
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
        <app-card class="p-6">
          <h2 class="text-base font-semibold text-ink">Appearance</h2>
          <div class="mt-5 flex items-center justify-between">
            <div>
              <p class="text-sm font-medium text-ink">Dark mode</p>
              <p class="text-sm text-ink-soft">Reduce eye strain in low light.</p>
            </div>
            <app-toggle [model]="dark()" label="Toggle dark mode" (change)="toggleDark($event)" />
          </div>
          <div class="mt-5">
            <app-select label="Theme" [options]="themeOptions()" [(ngModel)]="form.theme"
              (ngModelChange)="form.theme = $event; syncTheme()"></app-select>
          </div>
          <div class="mt-5">
            <app-select label="Currency" [options]="currencyOptions()" [(ngModel)]="form.currency"></app-select>
          </div>
          <div class="mt-5">
            <app-select label="Language" [options]="languageOptions()" [(ngModel)]="form.language"></app-select>
          </div>
        </app-card>

        <app-card class="p-6">
          <h2 class="text-base font-semibold text-ink">Notifications</h2>
          <div class="mt-5 space-y-5">
            <div class="flex items-center justify-between">
              <div>
                <p class="text-sm font-medium text-ink">Task reminders</p>
                <p class="text-sm text-ink-soft">Notify before tasks are due.</p>
              </div>
              <app-toggle [model]="form.notifications.taskReminders" label="Task reminders"
                (change)="setNotif('taskReminders', $event)" />
            </div>
            <div class="flex items-center justify-between">
              <div>
                <p class="text-sm font-medium text-ink">Bill reminders</p>
                <p class="text-sm text-ink-soft">Remind me about recurring bills.</p>
              </div>
              <app-toggle [model]="form.notifications.billReminders" label="Bill reminders"
                (change)="setNotif('billReminders', $event)" />
            </div>
            <div class="flex items-center justify-between">
              <div>
                <p class="text-sm font-medium text-ink">Habit reminders</p>
                <p class="text-sm text-ink-soft">Keep your streaks going.</p>
              </div>
              <app-toggle [model]="form.notifications.habitReminders" label="Habit reminders"
                (change)="setNotif('habitReminders', $event)" />
            </div>
            <div class="flex items-center justify-between">
              <div>
                <p class="text-sm font-medium text-ink">Email updates</p>
                <p class="text-sm text-ink-soft">Occasional product news.</p>
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

  protected readonly loading = this.settingService.loading;
  protected readonly dark = this.themeService.dark;
  protected readonly saving = signal(false);

  protected form: Setting = {
    theme: 'light',
    darkMode: false,
    language: 'en',
    currency: 'IDR',
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

  protected readonly currencyOptions = () => [
    { value: 'IDR', label: 'IDR — Indonesian Rupiah' },
    { value: 'USD', label: 'USD — US Dollar' },
    { value: 'MYR', label: 'MYR — Malaysian Ringgit' },
    { value: 'SGD', label: 'SGD — Singapore Dollar' },
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
}
