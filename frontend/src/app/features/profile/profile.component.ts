import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CardComponent } from '../../layout/components/card.component';
import { PageHeaderComponent } from '../../layout/components/page-header.component';
import { ButtonComponent } from '../../layout/components/button.component';
import { IconComponent } from '../../layout/components/icon.component';
import { AvatarComponent } from './components/avatar.component';
import { FieldComponent } from '../../layout/components/field.component';
import { ToastService } from '../../core/services/toast.service';
import { AuthService } from '../../core/services/auth.service';
import { formatDate } from '../../core/utils/format';

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
    <app-page-header title="Profile" subtitle="Manage your personal information."
      actionLabel="" [action]="noop"></app-page-header>

    <div class="grid grid-cols-1 gap-6 lg:grid-cols-3">
      <app-card class="lg:col-span-1" [padding]="'none'">
        <div class="flex flex-col items-center p-6 text-center">
          <div class="relative">
            <app-avatar [name]="user()?.name ?? 'User'" [src]="user()?.avatar ?? ''" [size]="96" />
            <button
              class="absolute -bottom-1 -right-1 flex h-9 w-9 items-center justify-center rounded-full border-2 border-surface bg-primary text-ink shadow-soft transition-transform hover:scale-105"
              [attr.aria-label]="'Change avatar'"
              (click)="avatarOpen.set(!avatarOpen())"
            >
              <app-icon name="camera" [size]="16" />
            </button>
          </div>
          <h2 class="mt-4 text-lg font-bold text-ink">{{ user()?.name }}</h2>
          <p class="text-sm text-ink-soft">{{ user()?.email }}</p>
          @if (user()?.createdAt) {
            <p class="mt-2 text-xs text-ink-faint">Member since {{ formatDate(user()!.createdAt, 'medium') }}</p>
          }

          @if (avatarOpen()) {
            <form
              (ngSubmit)="saveAvatar()"
              class="mt-4 w-full space-y-2 rounded-card border-2 border-line bg-surface-2 p-3 text-left"
            >
              <label class="block text-xs font-bold text-ink">Avatar URL</label>
              <input
                type="url"
                name="avatar"
                [(ngModel)]="avatarUrl"
                placeholder="https://example.com/avatar.jpg"
                class="h-10 w-full rounded-field border-2 border-ink bg-surface px-3 text-sm text-ink placeholder:text-ink-faint focus:border-primary focus:outline-none"
              />
              <div class="flex justify-end gap-2">
                <app-button
                  type="button"
                  size="sm"
                  variant="ghost"
                  (click)="avatarUrl = ''; saveAvatar()"
                >
                  Remove
                </app-button>
                <app-button type="submit" size="sm" [loading]="savingAvatar()">Save</app-button>
              </div>
            </form>
          }
        </div>
      </app-card>

      <div class="space-y-6 lg:col-span-2">
        <app-card>
          <h2 class="text-base font-semibold text-ink">Personal information</h2>
          <form (ngSubmit)="saveProfile()" class="mt-5 space-y-4">
            <app-field label="Full name" placeholder="Your name" [required]="true"
              [(ngModel)]="profileForm.name" name="name" />
            <app-field label="Email" type="email" placeholder="you@example.com"
              [disabled]="true" [ngModel]="user()?.email" name="email" />
            <div class="flex justify-end">
              <app-button type="submit" icon="check" [loading]="savingProfile()">Save</app-button>
            </div>
          </form>
        </app-card>

        <app-card>
          <h2 class="text-base font-semibold text-ink">Change password</h2>
          <form (ngSubmit)="changePassword()" class="mt-5 space-y-4">
            <app-field label="Current password" type="password" autocomplete="current-password"
              [(ngModel)]="passwordForm.current" name="current" />
            <app-field label="New password" type="password" autocomplete="new-password"
              [(ngModel)]="passwordForm.next" name="next" />
            <div class="flex justify-end">
              <app-button type="submit" icon="lock" [loading]="savingPassword()">Update password</app-button>
            </div>
          </form>
        </app-card>
      </div>
    </div>
  `,
})
export class ProfileComponent {
  private auth = inject(AuthService);
  private toast = inject(ToastService);

  protected readonly user = this.auth.user;
  protected readonly avatarOpen = signal(false);
  protected readonly savingProfile = signal(false);
  protected readonly savingPassword = signal(false);
  protected readonly savingAvatar = signal(false);
  protected avatarUrl = this.auth.user()?.avatar ?? '';

  protected readonly noop = (): void => {};

  protected readonly profileForm = { name: this.auth.user()?.name ?? '' };

  protected passwordForm = { current: '', next: '' };

  protected saveAvatar(): void {
    const url = this.avatarUrl.trim();
    if (url && !/^https?:\/\//i.test(url)) {
      this.toast.error('Please enter a valid URL (https://…).');
      return;
    }
    this.savingAvatar.set(true);
    this.auth.updateProfile({ avatar: url }).subscribe({
      next: () => {
        this.savingAvatar.set(false);
        this.avatarOpen.set(false);
        this.toast.success('Avatar updated');
      },
      error: (err: Error) => {
        this.savingAvatar.set(false);
        this.toast.error(err.message);
      },
    });
  }

  protected saveProfile(): void {
    if (!this.profileForm.name.trim()) {
      this.toast.error('Name cannot be empty.');
      return;
    }
    this.savingProfile.set(true);
    this.auth.updateProfile({ name: this.profileForm.name.trim() }).subscribe({
      next: () => {
        this.savingProfile.set(false);
        this.toast.success('Profile updated');
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
      this.toast.error('Fill in both password fields.');
      return;
    }
    if (this.passwordForm.next.length < 6) {
      this.toast.error('New password must be at least 6 characters.');
      return;
    }
    this.savingPassword.set(true);
    this.auth.changePassword(this.passwordForm.current, this.passwordForm.next).subscribe({
      next: () => {
        this.savingPassword.set(false);
        this.toast.success('Password updated');
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
