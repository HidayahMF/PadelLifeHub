import { Component, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CardComponent } from '../../layout/components/card.component';
import { PageHeaderComponent } from '../../layout/components/page-header.component';
import { ButtonComponent } from '../../layout/components/button.component';
import { IconComponent } from '../../layout/components/icon.component';
import { AvatarComponent } from './components/avatar.component';
import { FieldComponent } from '../../layout/components/field.component';
import { ToastService } from '../../core/services/toast.service';
import { AuthService } from '../../core/services/auth.service';
import { I18nService } from '../../core/services/i18n.service';
import { formatDate } from '../../core/utils/format';
import type { ProfileJourney } from '../../core/models/user.model';

@Component({
  selector: 'app-profile',
  standalone: true,
  imports: [
    FormsModule,
    CardComponent,
    PageHeaderComponent,
    ButtonComponent,
    IconComponent,
    AvatarComponent,
    FieldComponent,
  ],
  template: `
    <app-page-header [title]="t('Profile')" [subtitle]="t('Manage your personal information.')"
      actionLabel="" [action]="noop"></app-page-header>

    <div class="grid grid-cols-1 items-start gap-6 lg:grid-cols-3">
      <div class="contents w-full lg:col-span-1 lg:flex lg:w-full lg:flex-col lg:gap-6">
      <app-card class="order-1 w-full self-start lg:order-none" [padding]="'none'">
        <div class="flex flex-col items-center p-6 text-center">
          <div class="relative">
            <app-avatar [name]="user()?.name ?? t('User')" [src]="user()?.avatar ?? ''" [size]="96" />
            <button
              class="absolute -bottom-1 -right-1 flex h-9 w-9 items-center justify-center rounded-full border-2 border-surface bg-primary text-ink shadow-soft transition-transform hover:scale-105"
              [attr.aria-label]="t('Change avatar')"
              (click)="avatarOpen.set(!avatarOpen())"
            >
              <app-icon name="camera" [size]="16" />
            </button>
          </div>
          <h2 class="mt-4 text-lg font-bold text-ink">{{ user()?.name }}</h2>
          <p class="text-sm text-ink-soft">{{ user()?.email }}</p>
          @if (user()?.createdAt) {
            <p class="mt-2 text-xs text-ink-faint">{{ t('Member since {date}', { date: formatDate(user()!.createdAt, 'medium') }) }}</p>
          }

          @if (avatarOpen()) {
            <div
              class="mt-4 w-full space-y-3 rounded-card border-2 border-line bg-surface-2 p-3 text-left"
            >
              <div class="flex items-center gap-3">
                <span
                  class="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-full border-2 border-ink bg-surface"
                >
                  @if (avatarPreview()) {
                    <img [src]="avatarPreview()" [alt]="t('Avatar preview')" class="h-full w-full object-cover" />
                  } @else if (user()?.avatar) {
                    <img [src]="user()!.avatar" [alt]="t('Avatar')" class="h-full w-full object-cover" />
                  } @else {
                    <app-icon name="user-round" [size]="24" class="text-ink-faint" />
                  }
                </span>
                <div class="min-w-0 flex-1">
                  <app-button
                    type="button"
                    size="sm"
                    variant="secondary"
                    icon="image"
                    (click)="fileInput.click()"
                  >
                    {{ t('Choose image') }}
                  </app-button>
                  <input
                    #fileInput
                    type="file"
                    accept="image/jpeg,image/png,image/webp,image/gif"
                    class="hidden"
                    (change)="onFileSelected($event)"
                  />
                  <p class="mt-1.5 text-[11px] font-medium text-ink-faint">
                    {{ t('JPG, PNG, WebP or GIF · max 3MB') }}
                  </p>
                </div>
              </div>
              @if (avatarPreview()) {
                <div class="flex justify-end gap-2">
                  <app-button type="button" size="sm" variant="ghost" (click)="cancelAvatar()">{{ t('Cancel') }}</app-button>
                  <app-button type="button" size="sm" [loading]="savingAvatar()" (click)="uploadAvatar()">{{ t('Save') }}</app-button>
                </div>
              } @else if (user()?.avatar) {
                <div class="flex justify-end">
                  <app-button type="button" size="sm" variant="ghost" [loading]="removingAvatar()" (click)="removeAvatar()">{{ t('Remove') }}</app-button>
                </div>
              }
            </div>
          }
        </div>
      </app-card>

      <app-card class="order-4 w-full lg:order-none">
          <h2 class="text-base font-semibold text-ink">{{ t('Personal information') }}</h2>
          <form (ngSubmit)="saveProfile()" class="mt-5 space-y-4">
            <app-field [label]="t('Full name')" [placeholder]="t('Your name')" [required]="true"
              [(ngModel)]="profileForm.name" name="name" />
            <app-field [label]="t('Email')" type="email" placeholder="you@example.com"
              [disabled]="true" [ngModel]="user()?.email" name="email" />
            <div class="flex justify-end">
              <app-button type="submit" icon="check" [loading]="savingProfile()">{{ t('Save') }}</app-button>
            </div>
          </form>
        </app-card>

        @if (user()?.hasPassword !== false) {
          <app-card class="order-5 w-full lg:order-none">
            <h2 class="text-base font-semibold text-ink">{{ t('Change password') }}</h2>
            <form (ngSubmit)="changePassword()" class="mt-5 space-y-4">
              <app-field [label]="t('Current password')" type="password" autocomplete="current-password"
                [(ngModel)]="passwordForm.current" name="current" />
              <app-field [label]="t('New password')" type="password" autocomplete="new-password"
                [(ngModel)]="passwordForm.next" name="next" />
              <div class="flex justify-end">
                <app-button type="submit" icon="lock" [loading]="savingPassword()">{{ t('Update password') }}</app-button>
              </div>
            </form>
          </app-card>
        } @else {
          <app-card class="order-5 w-full lg:order-none">
            <h2 class="text-base font-semibold text-ink">{{ t('Sign-in method') }}</h2>
            <p class="mt-3 text-sm font-medium text-ink-soft">
              {{ t('This account uses Google sign-in and does not have a password.') }}
            </p>
          </app-card>
        }
      </div>

      <div class="contents lg:col-span-2 lg:flex lg:flex-col lg:gap-6">
        <app-card class="order-2 lg:order-none">
          <div class="flex items-start justify-between gap-4">
            <div>
              <h2 class="text-base font-semibold text-ink">{{ t('My Life Journey') }}</h2>
              <p class="mt-1 text-sm text-ink-soft">{{ t('Every journey has a story.') }}</p>
            </div>
            <app-icon name="history" [size]="20" class="text-primary" />
          </div>

          @if (journeyLoading()) {
            <div class="mt-5 grid gap-3 sm:grid-cols-3">
              @for (_ of [1, 2, 3]; track $index) {
                <div class="h-28 animate-pulse rounded-card bg-surface-2"></div>
              }
            </div>
          } @else if (journeyError()) {
            <p class="mt-5 rounded-card bg-danger/10 px-4 py-3 text-sm text-danger">{{ t('Journey data could not be loaded.') }}</p>
          } @else if (journey(); as data) {
            <div class="mt-5 grid gap-3 sm:grid-cols-3">
              <div class="rounded-card border border-line bg-surface-2 p-4">
                <app-icon name="calendar-days" [size]="18" class="text-primary" />
                <p class="mt-3 text-lg font-bold text-ink">{{ formatDate(data.joinedAt, 'long') }}</p>
                <p class="mt-1 text-sm font-semibold text-ink">{{ t('Joined LifeHub') }}</p>
                <p class="mt-1 text-xs text-ink-soft">{{ t('The day your LifeHub journey began.') }}</p>
              </div>
              <div class="rounded-card border border-line bg-surface-2 p-4">
                <app-icon name="sticky-note" [size]="18" class="text-success" />
                @if (data.firstActivityAt) {
                  <p class="mt-3 text-lg font-bold text-ink">{{ formatDate(data.firstActivityAt, 'long') }}</p>
                  <p class="mt-1 text-sm font-semibold text-ink">{{ t('First Life Entry') }}</p>
                  <p class="mt-1 text-xs text-ink-soft">{{ t('The first day you started recording your journey.') }}</p>
                  @if (data.firstActivitySource === 'reconstructed') {
                    <p class="mt-2 text-[11px] text-ink-faint">{{ t('Based on the oldest available activity.') }}</p>
                  }
                } @else {
                  <p class="mt-3 text-sm font-semibold text-ink">{{ t('No first entry yet') }}</p>
                  <p class="mt-1 text-xs text-ink-soft">{{ t('Your journey has no first entry yet. Start with a note, task, or goal.') }}</p>
                }
              </div>
              <div class="rounded-card border border-line bg-surface-2 p-4">
                <app-icon name="flame" [size]="18" class="text-warning" />
                @if (journeyDays() === 0) {
                  <p class="mt-3 text-lg font-bold text-ink">{{ t('First Journey Day') }}</p>
                  <p class="mt-1 text-sm font-semibold text-ink">{{ t('Journey Duration') }}</p>
                  <p class="mt-1 text-xs text-ink-soft">{{ t('Today you started your journey.') }}</p>
                } @else if (journeyDays() !== null) {
                  <p class="mt-3 text-lg font-bold text-ink">{{ journeyDays() }} {{ t('Days of Journey') }}</p>
                  <p class="mt-1 text-sm font-semibold text-ink">{{ t('Journey Duration') }}</p>
                  <p class="mt-1 text-xs text-ink-soft">{{ t('It has been {days} since you started your journey.', { days: journeyDays() ?? 0 }) }}</p>
                } @else {
                  <p class="mt-3 text-sm font-semibold text-ink">{{ t('Journey Duration') }}</p>
                  <p class="mt-1 text-xs text-ink-soft">{{ t('Your journey duration will appear after your first entry.') }}</p>
                }
              </div>
            </div>
          }
        </app-card>

        <app-card class="order-3 lg:order-none">
          <div class="flex items-start justify-between gap-4">
            <div>
              <h2 class="text-base font-semibold text-ink">{{ t('Your Life in Numbers') }}</h2>
              <p class="mt-1 text-sm text-ink-soft">{{ t('A view of your journey while using LifeHub.') }}</p>
            </div>
            <app-icon name="bar-chart-3" [size]="20" class="text-primary" />
          </div>
          @if (journeyLoading()) {
            <div class="mt-5 h-24 animate-pulse rounded-card bg-surface-2"></div>
          } @else if (journeyError()) {
            <p class="mt-5 text-sm text-danger">{{ t('Statistics could not be loaded.') }}</p>
          } @else if (journey(); as data) {
            <div class="mt-5 grid grid-cols-2 gap-3 xl:grid-cols-4">
              <div class="rounded-card bg-surface-2 p-4"><p class="text-2xl font-bold text-ink">{{ data.statistics.notesCreated }}</p><p class="mt-1 text-xs font-medium text-ink-soft">{{ t('Notes Created') }}</p></div>
              <div class="rounded-card bg-surface-2 p-4"><p class="text-2xl font-bold text-ink">{{ data.statistics.tasksCompleted }}</p><p class="mt-1 text-xs font-medium text-ink-soft">{{ t('Tasks Completed') }}</p></div>
              <div class="rounded-card bg-surface-2 p-4"><p class="text-2xl font-bold text-ink">{{ data.statistics.goalsCompleted }}</p><p class="mt-1 text-xs font-medium text-ink-soft">{{ t('Goals Achieved') }}</p></div>
              <div class="rounded-card bg-surface-2 p-4"><p class="text-2xl font-bold text-ink">{{ data.statistics.activeDays }}</p><p class="mt-1 text-xs font-medium text-ink-soft">{{ t('Active Days') }}</p></div>
            </div>
            <p class="mt-4 text-xs text-ink-faint">{{ t('Active days combine verifiable activity dates across notes, tasks, goals, habits, finance, and focus sessions.') }}</p>
          }
        </app-card>
      </div>
    </div>
  `,
})
export class ProfileComponent implements OnInit {
  private auth = inject(AuthService);
  private toast = inject(ToastService);
  private i18n = inject(I18nService);

  protected readonly t = this.i18n.t.bind(this.i18n);

  protected readonly user = this.auth.user;
  protected readonly avatarOpen = signal(false);
  protected readonly savingProfile = signal(false);
  protected readonly savingPassword = signal(false);
  protected readonly savingAvatar = signal(false);
  protected readonly removingAvatar = signal(false);
  protected readonly avatarPreview = signal('');
  protected readonly journey = signal<ProfileJourney | null>(null);
  protected readonly journeyLoading = signal(true);
  protected readonly journeyError = signal(false);
  protected avatarFile: File | null = null;

  protected readonly noop = (): void => {};

  protected readonly profileForm = { name: this.auth.user()?.name ?? '' };

  protected passwordForm = { current: '', next: '' };

  ngOnInit(): void {
    this.loadJourney();
  }

  private loadJourney(): void {
    this.journeyLoading.set(true);
    this.journeyError.set(false);
    this.auth.getJourney().subscribe({
      next: (data) => {
        this.journey.set(data);
        this.journeyLoading.set(false);
      },
      error: () => {
        this.journeyLoading.set(false);
        this.journeyError.set(true);
      },
    });
  }

  protected journeyDays(): number | null {
    const first = this.journey()?.firstActivityAt;
    if (!first) return null;
    const start = new Date(first);
    const today = new Date();
    const calendarDay = (date: Date): number => {
      const parts = new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Asia/Jakarta',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      }).formatToParts(date);
      const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
      return Date.UTC(Number(values['year']), Number(values['month']) - 1, Number(values['day']));
    };
    const startDay = calendarDay(start);
    const todayDay = calendarDay(today);
    return Math.max(0, Math.round((todayDay - startDay) / 86_400_000));
  }

  protected onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    const allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
    if (!allowed.includes(file.type)) {
      this.toast.error(this.t('Only JPG, PNG, WebP or GIF images are allowed.'));
      input.value = '';
      return;
    }
    if (file.size > 3 * 1024 * 1024) {
      this.toast.error(this.t('Image is too large (max 3MB).'));
      input.value = '';
      return;
    }
    this.avatarFile = file;
    const reader = new FileReader();
    reader.onload = () => this.avatarPreview.set(String(reader.result ?? ''));
    reader.readAsDataURL(file);
  }

  protected uploadAvatar(): void {
    if (!this.avatarFile) return;
    this.savingAvatar.set(true);
    this.auth.uploadAvatar(this.avatarFile).subscribe({
      next: () => {
        this.savingAvatar.set(false);
        this.avatarOpen.set(false);
        this.resetAvatar();
        this.toast.success(this.t('Avatar updated'));
      },
      error: (err: Error) => {
        this.savingAvatar.set(false);
        this.toast.error(err.message);
      },
    });
  }

  protected removeAvatar(): void {
    this.removingAvatar.set(true);
    this.auth.updateProfile({ avatar: '' }).subscribe({
      next: () => {
        this.removingAvatar.set(false);
        this.avatarOpen.set(false);
        this.toast.success(this.t('Avatar removed'));
      },
      error: (err: Error) => {
        this.removingAvatar.set(false);
        this.toast.error(err.message);
      },
    });
  }

  protected cancelAvatar(): void {
    this.resetAvatar();
  }

  private resetAvatar(): void {
    this.avatarFile = null;
    this.avatarPreview.set('');
  }

  protected saveProfile(): void {
    if (!this.profileForm.name.trim()) {
      this.toast.error(this.t('Name cannot be empty.'));
      return;
    }
    this.savingProfile.set(true);
    this.auth.updateProfile({ name: this.profileForm.name.trim() }).subscribe({
      next: () => {
        this.savingProfile.set(false);
        this.toast.success(this.t('Profile updated'));
        this.profileForm.name = this.auth.user()?.name ?? '';
      },
      error: (err: Error) => {
        this.savingProfile.set(false);
        this.toast.error(err.message);
      },
    });
  }

  protected changePassword(): void {
    if (!this.passwordForm.current || !this.passwordForm.next) {
      this.toast.error(this.t('Fill in both password fields.'));
      return;
    }
    if (this.passwordForm.next.length < 6) {
      this.toast.error(this.t('New password must be at least 6 characters.'));
      return;
    }
    this.savingPassword.set(true);
    this.auth.changePassword(this.passwordForm.current, this.passwordForm.next).subscribe({
      next: () => {
        this.savingPassword.set(false);
        this.toast.success(this.t('Password updated'));
        this.passwordForm = { current: '', next: '' };
      },
      error: (err: Error) => {
        this.savingPassword.set(false);
        this.toast.error(err.message);
      },
    });
  }

  protected readonly formatDate = formatDate;
}
