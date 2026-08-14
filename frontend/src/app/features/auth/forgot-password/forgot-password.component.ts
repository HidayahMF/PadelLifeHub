import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { FieldComponent } from '../../../layout/components/field.component';
import { ButtonComponent } from '../../../layout/components/button.component';
import { IconComponent } from '../../../layout/components/icon.component';
import { ApiService } from '../../../core/services/api.service';
import { I18nService } from '../../../core/services/i18n.service';
import { ToastService } from '../../../core/services/toast.service';

@Component({
  selector: 'app-forgot-password',
  standalone: true,
  imports: [FormsModule, RouterLink, FieldComponent, ButtonComponent, IconComponent],
  template: `
    <div class="relative min-h-dvh overflow-hidden bg-bg">
      <div class="neo-dots pointer-events-none absolute inset-0 opacity-40"></div>
      <div
        class="relative mx-auto flex min-h-dvh w-full max-w-md items-center justify-center px-4 py-10"
      >
        <div class="w-full rounded-card border-2 border-ink bg-surface p-8 shadow-pop">
          <div class="flex items-center gap-3">
            <span class="flex h-10 w-10 items-center justify-center rounded-[12px] border-2 border-ink bg-primary text-ink shadow-soft">
              <app-icon name="key-round" [size]="20" />
            </span>
            <div>
              <h2 class="font-display text-xl text-ink">{{ t('RESET PASSWORD') }}</h2>
              <p class="mt-0.5 text-xs font-medium text-ink-soft">{{ t('Get back into LifeHub.') }}</p>
            </div>
          </div>

          @if (!requested()) {
            <form class="mt-6 space-y-4" (ngSubmit)="requestReset()">
              <app-field
                [label]="t('Email')"
                type="email"
                placeholder="you@example.com"
                [required]="true"
                autocomplete="email"
                [(ngModel)]="email"
                name="email"
              />
              <p class="text-xs font-medium text-ink-soft">
                {{ t('Enter the email linked to your account. If the account exists, a reset token will be issued so you can set a new password.') }}
              </p>
              <app-button type="submit" [block]="true" [loading]="sending()" icon="mail">
                {{ t('Request reset') }}
              </app-button>
            </form>
          } @else {
            <div class="mt-5 rounded-card border-2 border-line bg-surface-2 p-4 text-sm text-ink">
              <p class="font-medium">{{ infoMessage() }}</p>
            </div>

            <form class="mt-5 space-y-4" (ngSubmit)="doReset()">
              <app-field
                [label]="t('Reset token')"
                [placeholder]="t('Paste the reset token')"
                [required]="true"
                [(ngModel)]="token"
                name="token"
              />
              <app-field
                [label]="t('New password')"
                type="password"
                [placeholder]="t('At least 6 characters')"
                [required]="true"
                autocomplete="new-password"
                [(ngModel)]="newPassword"
                name="newPassword"
              />
              <app-button type="submit" [block]="true" [loading]="resetting()" icon="lock">
                {{ t('Set new password') }}
              </app-button>
            </form>
          }

          <p class="mt-6 text-center text-sm font-medium text-ink-soft">
            {{ t('Remembered it?') }}
            <a routerLink="/login" class="font-bold text-ink underline decoration-primary decoration-2 underline-offset-4 hover:bg-primary">
              {{ t('Back to sign in') }}
            </a>
          </p>
        </div>
      </div>
    </div>
  `,
})
export class ForgotPasswordComponent {
  private api = inject(ApiService);
  private toast = inject(ToastService);
  private router = inject(Router);
  private i18n = inject(I18nService);

  protected readonly t = this.i18n.t.bind(this.i18n);

  protected email = '';
  protected token = '';
  protected newPassword = '';
  protected requested = signal(false);
  protected sending = signal(false);
  protected resetting = signal(false);
  protected infoMessage = signal('');

  protected requestReset(): void {
    if (!this.email.trim()) {
      this.toast.error(this.t('Please enter your email.'));
      return;
    }
    this.sending.set(true);
    this.api.post<{ message: string; resetToken?: string }>('/auth/forgot-password', {
      email: this.email.trim(),
    }).subscribe({
      next: (res) => {
        this.sending.set(false);
        this.requested.set(true);
        // The backend returns the reset token only in development mode (no
        // email service configured yet) — the flow is still fully testable.
        if (res.resetToken) {
          this.token = res.resetToken;
          this.infoMessage.set(
            this.t(
              'No email service is configured yet, so here is your reset token (development mode). Use it below to set a new password.'
            )
          );
        } else {
          this.infoMessage.set(
            res.message || this.t('If that email is registered, a reset was initiated.')
          );
        }
      },
      error: (err: Error) => {
        this.sending.set(false);
        this.toast.error(err.message);
      },
    });
  }

  protected doReset(): void {
    if (!this.token.trim() || !this.newPassword) {
      this.toast.error(this.t('Token and new password are required.'));
      return;
    }
    if (this.newPassword.length < 6) {
      this.toast.error(this.t('New password must be at least 6 characters.'));
      return;
    }
    this.resetting.set(true);
    this.api.post<{ message: string }>('/auth/reset-password', {
      token: this.token.trim(),
      newPassword: this.newPassword,
    }).subscribe({
      next: () => {
        this.resetting.set(false);
        this.toast.success(this.t('Password reset — sign in with your new password.'));
        this.router.navigate(['/login']);
      },
      error: (err: Error) => {
        this.resetting.set(false);
        this.toast.error(err.message);
      },
    });
  }
}
