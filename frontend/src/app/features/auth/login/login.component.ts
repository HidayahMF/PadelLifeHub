import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { FieldComponent } from '../../../shared/components/field/field.component';
import { ButtonComponent } from '../../../shared/components/button/button.component';
import { IconComponent } from '../../../shared/components/icon/icon.component';
import { AuthService } from '../../../core/services/auth.service';
import { ToastService } from '../../../core/services/toast.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [FormsModule, RouterLink, FieldComponent, ButtonComponent, IconComponent],
  template: `
    <div class="relative min-h-dvh overflow-hidden bg-bg">
      <div class="neo-dots pointer-events-none absolute inset-0 opacity-40"></div>

      <!-- Decorative brutal shapes -->
      <div aria-hidden="true" class="pointer-events-none absolute inset-0 hidden lg:block">
        <div class="absolute left-[7%] top-[12%] h-20 w-20 rotate-6 rounded-[16px] border-2 border-ink bg-primary shadow-soft"></div>
        <div class="absolute left-[16%] bottom-[16%] h-14 w-14 -rotate-12 rounded-full border-2 border-ink bg-secondary shadow-soft"></div>
        <div class="absolute left-[40%] top-[9%] h-4 w-4 rounded-full border-2 border-ink bg-accent"></div>
        <div class="absolute left-[45%] bottom-[9%] h-3 w-3 rounded-full border-2 border-ink bg-success"></div>
        <div class="neo-stripes absolute right-[8%] top-[10%] h-6 w-24 rotate-3 border-2 border-ink"></div>
        <div
          class="absolute right-[12%] top-[24%] -rotate-3 rounded-[14px] border-2 border-ink bg-success px-4 py-2 font-bold text-sm text-ink shadow-soft animate-float"
          style="--tilt: -3deg"
        >
          ✦ PRODUCTIVITY
        </div>
        <div
          class="absolute right-[18%] bottom-[22%] rotate-3 rounded-[14px] border-2 border-ink bg-primary px-4 py-2 font-bold text-sm text-ink shadow-soft animate-float-slow"
          style="--tilt: 3deg"
        >
          ✦ FINANCE
        </div>
        <div class="absolute bottom-[8%] right-[38%] h-10 w-10 rotate-45 rounded-[8px] border-2 border-ink bg-secondary shadow-soft"></div>
      </div>

      <div
        class="relative mx-auto grid min-h-dvh w-full max-w-6xl items-center gap-10 px-4 py-10 lg:grid-cols-2 lg:gap-16 lg:px-8"
      >
        <!-- Hero -->
        <div class="lg:pr-6">
          <div class="flex items-center gap-3">
            <span
              class="flex h-12 w-12 items-center justify-center rounded-[14px] border-2 border-ink bg-primary text-ink shadow-soft"
            >
              <app-icon name="zap" [size]="26" [strokeWidth]="2.6" />
            </span>
            <div>
              <p class="font-display text-xl leading-none text-ink">LIFEHUB</p>
              <p class="mt-1 text-xs font-bold uppercase tracking-widest text-ink-faint">
                Productivity & finance
              </p>
            </div>
          </div>

          <h1 class="mt-10 font-display text-5xl leading-[1.04] tracking-tight text-ink sm:text-6xl">
            ORGANIZE YOUR
            <span class="relative inline-block">
              <span
                class="absolute -inset-x-1 -inset-y-1 -rotate-1 border-2 border-ink bg-primary shadow-[5px_5px_0_0_var(--color-ink)]"
              ></span>
              <span class="relative px-2">WHOLE LIFE</span>
            </span>
            IN ONE PLACE.
          </h1>

          <p class="mt-6 max-w-md text-base font-medium text-ink-soft">
            Tasks, finance, habits, goals &amp; more — a brutal-simple dashboard to run your day.
          </p>

          <ul class="mt-8 flex flex-wrap gap-2.5">
            @for (chip of chips; track chip) {
              <li
                class="rounded-[10px] border-2 border-ink bg-surface px-3 py-1.5 text-xs font-bold text-ink shadow-[2px_2px_0_0_var(--color-ink)]"
              >
                {{ chip }}
              </li>
            }
          </ul>
        </div>

        <!-- Form -->
        <div class="w-full max-w-md justify-self-center lg:justify-self-end">
          <div class="rounded-card border-2 border-ink bg-surface p-8 shadow-pop">
            <h2 class="font-display text-2xl text-ink">WELCOME BACK</h2>
            <p class="mt-1.5 text-sm font-medium text-ink-soft">
              Sign in to LifeHub to continue your journey.
            </p>

            <form class="mt-6 space-y-4" (ngSubmit)="onSubmit()">
              <app-field
                label="Email"
                type="email"
                placeholder="you@example.com"
                [required]="true"
                autocomplete="email"
                [(ngModel)]="email"
                name="email"
              />
              <div class="relative">
                <app-field
                  label="Password"
                  [type]="showPassword() ? 'text' : 'password'"
                  placeholder="Your password"
                  [required]="true"
                  autocomplete="current-password"
                  [(ngModel)]="password"
                  name="password"
                />
                <button
                  type="button"
                  (click)="showPassword.set(!showPassword())"
                  class="absolute right-3 top-[34px] text-ink-faint transition-colors hover:text-ink"
                  [attr.aria-label]="showPassword() ? 'Hide password' : 'Show password'"
                >
                  <app-icon [name]="showPassword() ? 'eye-off' : 'eye'" [size]="18" />
                </button>
              </div>

              <div class="flex items-center justify-between text-sm">
                <a routerLink="/register" class="font-bold text-ink underline decoration-primary decoration-2 underline-offset-4 hover:bg-primary">
                  Create an account
                </a>
                <a href="#" class="font-medium text-ink-faint hover:text-ink-soft">Forgot password?</a>
              </div>

              <app-button type="submit" [block]="true" [loading]="loading()" icon="log-in">
                Sign in
              </app-button>
            </form>
          </div>
        </div>
      </div>
    </div>
  `,
})
export class LoginComponent {
  private auth = inject(AuthService);
  private toast = inject(ToastService);
  private router = inject(Router);

  protected readonly chips = [
    '✅ Task manager',
    '💰 Finance tracker',
    '🎯 Goals & habits',
    '⏱ Pomodoro focus',
    '📝 Notes',
  ];

  protected email = '';
  protected password = '';
  protected showPassword = signal(false);
  protected loading = signal(false);

  protected onSubmit(): void {
    if (!this.email.trim() || !this.password) {
      this.toast.error('Please fill in your email and password.');
      return;
    }
    this.loading.set(true);
    this.auth.login(this.email.trim(), this.password).subscribe({
      next: () => {
        this.loading.set(false);
        this.toast.success('Welcome back!');
        this.router.navigate(['/dashboard']);
      },
      error: (err: Error) => {
        this.loading.set(false);
        this.toast.error(err.message);
      },
    });
  }
}
