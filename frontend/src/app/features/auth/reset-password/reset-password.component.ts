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
  selector: 'app-reset-password',
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
              <app-icon name="lock" [size]="20" />
            </span>
            <div>
              <h2 class="font-display text-xl text-ink">{{ t('Set a new password') }}</h2>
              <p class="mt-0.5 text-xs font-medium text-ink-soft">{{ t('Choose a strong password to get back into LifeHub.') }}</p>
            </div>
          </div>

          @if (!done()) {
            <form class="mt-6 space-y-4" (ngSubmit)="reset()">
              @if (tokenError()) {
                <div class="rounded-card border-2 border-danger bg-danger/10 p-3 text-sm font-medium text-danger">
                  {{ tokenError() }}
                </div>
              }
              <app-field
                [label]="t('New password')"
                type="password"
                [placeholder]="t('At least 6 characters')"
                [required]="true"
                autocomplete="new-password"
                [(ngModel)]="newPassword"
                name="newPassword"
              />
              <app-field
                [label]="t('Confirm password')"
                type="password"
                [placeholder]="t('Repeat your new password')"
                [required]="true"
                autocomplete="new-password"
                [(ngModel)]="confirmPassword"
                name="confirmPassword"
              />
              <app-button type="submit" [block]="true" [loading]="submitting()" icon="lock">
                {{ t('Update password') }}
              </app-button>
            </form>
          } @else {
            <div class="mt-5 rounded-card border-2 border-line bg-surface-2 p-4 text-sm text-ink">
              <p class="font-medium">{{ t('Password updated. You can now sign in with your new password.') }}</p>
            </div>
            <div class="mt-5">
              <app-button [block]="true" (click)="goToLogin()" icon="log-in">
                {{ t('Back to sign in') }}
              </app-button>
            </div>
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
export class ResetPasswordComponent {
  private api = inject(ApiService);
  private toast = inject(ToastService);
  private router = inject(Router);
  private i18n = inject(I18nService);

  protected readonly t = this.i18n.t.bind(this.i18n);

  protected token = '';
  protected newPassword = '';
  protected confirmPassword = '';
  protected submitting = signal(false);
  protected done = signal(false);
  protected tokenError = signal('');

  constructor() {
    const params = new URLSearchParams(this.router.url.split('?')[1] ?? '');
    this.token = params.get('token') ?? '';
  }

  protected reset(): void {
    if (!this.token.trim()) {
      this.tokenError.set(this.t('This reset link is missing its token. Please request a new password reset.'));
      return;
    }
    if (this.newPassword.length < 6) {
      this.toast.error(this.t('New password must be at least 6 characters.'));
      return;
    }
    if (this.newPassword !== this.confirmPassword) {
      this.toast.error(this.t('Passwords do not match.'));
      return;
    }
    this.submitting.set(true);
    this.api.post<{ message: string }>('/auth/reset-password', {
      token: this.token.trim(),
      newPassword: this.newPassword,
    }).subscribe({
      next: () => {
        this.submitting.set(false);
        this.done.set(true);
        this.toast.success(this.t('Password updated — you can sign in now.'));
      },
      error: (err: Error) => {
        this.submitting.set(false);
        this.toast.error(err.message);
      },
    });
  }

  protected goToLogin(): void {
    this.router.navigate(['/login']);
  }
}
