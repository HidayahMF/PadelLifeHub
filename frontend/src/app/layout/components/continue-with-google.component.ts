import { Component, ElementRef, inject, OnInit, signal, viewChild } from '@angular/core';
import { Router } from '@angular/router';
import { SpinnerComponent } from './spinner.component';
import { GoogleAuthService } from '../../core/services/google-auth.service';
import { AuthService } from '../../core/services/auth.service';
import { ToastService } from '../../core/services/toast.service';
import { I18nService } from '../../core/services/i18n.service';

/**
 * Official "Continue with Google" button shared by the Login and Register
 * screens. Renders the GIS button, streams the ID token to the backend, and
 * follows the exact post-login behavior of the existing auth flows.
 */
@Component({
  selector: 'app-continue-with-google',
  standalone: true,
  imports: [SpinnerComponent],
  template: `
    @if (configured) {
      <div class="my-5 flex items-center gap-3">
        <span class="h-[2px] flex-1 bg-line"></span>
        <span class="text-xs font-bold uppercase tracking-widest text-ink-faint">
          {{ t('or') }}
        </span>
        <span class="h-[2px] flex-1 bg-line"></span>
      </div>

      <div class="relative min-h-12">
        <div #googleButton class="overflow-hidden rounded-button"></div>
        @if (loading()) {
          <div
            class="absolute inset-0 z-10 flex items-center justify-center rounded-button bg-surface/85"
            role="status"
            aria-label="Loading"
          >
            <app-spinner size="md" />
          </div>
        }
      </div>
    }
  `,
})
export class ContinueWithGoogleComponent implements OnInit {
  private google = inject(GoogleAuthService);
  private auth = inject(AuthService);
  private toast = inject(ToastService);
  private router = inject(Router);
  private i18n = inject(I18nService);

  private readonly buttonEl = viewChild<ElementRef<HTMLDivElement>>('googleButton');

  protected readonly t = this.i18n.t.bind(this.i18n);
  protected readonly configured = this.google.configured;
  protected readonly loading = signal(false);

  ngOnInit(): void {
    if (!this.google.configured) return;
    // Stream credentials for the lifetime of the screen; each callback starts
    // an independent login round-trip, so nothing needs re-arming after a
    // cancelled attempt.
    this.google.success$.subscribe((idToken) => this.completeLogin(idToken));
    this.google.failure$.subscribe((message) => this.toast.error(this.t(message)));

    // Defer until the container is in the DOM, then render the official button.
    setTimeout(() => {
      const el = this.buttonEl()?.nativeElement;
      if (el) void this.google.renderButton(el);
    });
  }

  private completeLogin(idToken: string): void {
    if (this.loading()) return; // guard against duplicate submissions
    this.loading.set(true);
    this.auth.googleLogin(idToken).subscribe({
      next: () => {
        this.loading.set(false);
        this.toast.success(this.t('Welcome back!'));
        // Same landing route as the existing email login flow.
        this.router.navigate(['/dashboard']);
      },
      error: (err: Error) => {
        this.loading.set(false);
        this.toast.error(err.message);
      },
    });
  }
}
