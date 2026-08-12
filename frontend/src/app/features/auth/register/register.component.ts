import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { FieldComponent } from '../../../layout/components/field.component';
import { ButtonComponent } from '../../../layout/components/button.component';
import { IconComponent } from '../../../layout/components/icon.component';
import { AuthService } from '../../../core/services/auth.service';
import { ToastService } from '../../../core/services/toast.service';

@Component({
  selector: 'app-register',
  standalone: true,
  imports: [FormsModule, RouterLink, FieldComponent, ButtonComponent, IconComponent],
  template: `
    <div class="relative min-h-dvh overflow-hidden bg-bg">
      <div class="neo-dots pointer-events-none absolute inset-0 opacity-40"></div>

      <!-- Decorative brutal shapes -->
      <div aria-hidden="true" class="pointer-events-none absolute inset-0 hidden lg:block">
        <div class="absolute left-[9%] top-[14%] h-16 w-16 -rotate-6 rounded-full border-2 border-ink bg-secondary shadow-soft"></div>
        <div class="absolute left-[14%] bottom-[18%] h-20 w-20 rotate-12 rounded-[16px] border-2 border-ink bg-primary shadow-soft"></div>
        <div class="absolute left-[42%] bottom-[10%] h-3 w-3 rounded-full border-2 border-ink bg-accent"></div>
        <div class="absolute right-[9%] top-[9%] h-5 w-5 rotate-45 rounded-[6px] border-2 border-ink bg-success"></div>
        <div
          class="absolute right-[13%] top-[22%] rotate-3 rounded-[14px] border-2 border-ink bg-primary px-4 py-2 font-bold text-sm text-ink shadow-soft animate-float"
          style="--tilt: 3deg"
        >
          ✦ START TODAY
        </div>
        <div
          class="absolute right-[17%] bottom-[24%] -rotate-3 rounded-[14px] border-2 border-ink bg-secondary px-4 py-2 font-bold text-sm text-ink shadow-soft animate-float-slow"
          style="--tilt: -3deg"
        >
          ✦ NO EXCUSES
        </div>
        <div class="neo-stripes absolute bottom-[9%] left-[30%] h-6 w-24 -rotate-6 border-2 border-ink"></div>
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
              <img src="assets/logolifehub.png" alt="LifeHub logo" class="h-7 w-7 object-contain" />
            </span>
            <div>
              <p class="font-display text-xl leading-none text-ink">LIFEHUB</p>
              <p class="mt-1 text-xs font-bold uppercase tracking-widest text-ink-faint">
                Productivity & finance
              </p>
            </div>
          </div>

          <h1 class="mt-10 font-display text-5xl leading-[1.04] tracking-tight text-ink sm:text-6xl">
            BUILD YOUR
            <span class="relative inline-block">
              <span
                class="absolute -inset-x-1 -inset-y-1 rotate-1 border-2 border-ink bg-secondary shadow-[5px_5px_0_0_var(--color-ink)]"
              ></span>
              <span class="relative px-2">BEST SELF</span>
            </span>
            ONE TASK AT A TIME.
          </h1>

          <p class="mt-6 max-w-md text-base font-medium text-ink-soft">
            Track money, habits and goals. Everything you need to level up, in one dashboard.
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
            <h2 class="font-display text-2xl text-ink">CREATE ACCOUNT</h2>
            <p class="mt-1.5 text-sm font-medium text-ink-soft">
              Start organizing your tasks and finances.
            </p>

            <form class="mt-6 space-y-4" (ngSubmit)="onSubmit()">
              <app-field
                label="Full name"
                placeholder="Jane Doe"
                [required]="true"
                autocomplete="name"
                [(ngModel)]="name"
                name="name"
              />
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
                  placeholder="At least 6 characters"
                  [required]="true"
                  autocomplete="new-password"
                  [(ngModel)]="password"
                  name="password"
                />
                <button
                  type="button"
                  (click)="showPassword.set(!showPassword())"
                  class="absolute right-3 top-[40px] text-ink-faint transition-colors hover:text-ink"
                  [attr.aria-label]="showPassword() ? 'Hide password' : 'Show password'"
                >
                  <app-icon [name]="showPassword() ? 'eye-off' : 'eye'" [size]="18" />
                </button>
              </div>

              <app-button type="submit" [block]="true" [loading]="loading()" icon="user-plus">
                Create account
              </app-button>

              <p class="text-center text-sm font-medium text-ink-soft">
                Already have an account?
                <a routerLink="/login" class="font-bold text-ink underline decoration-primary decoration-2 underline-offset-4 hover:bg-primary">Sign in</a>
              </p>
            </form>
          </div>
        </div>
      </div>
    </div>
  `,
})
export class RegisterComponent {
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

  protected name = '';
  protected email = '';
  protected password = '';
  protected showPassword = signal(false);
  protected loading = signal(false);

  protected onSubmit(): void {
    if (!this.name.trim() || !this.email.trim() || !this.password) {
      this.toast.error('Please fill in all fields.');
      return;
    }
    if (this.password.length < 6) {
      this.toast.error('Password must be at least 6 characters.');
      return;
    }
    this.loading.set(true);
    this.auth
      .register({ name: this.name.trim(), email: this.email.trim(), password: this.password })
      .subscribe({
        next: () => {
          this.loading.set(false);
          this.toast.success('Account created — welcome to LifeHub!');
          this.router.navigate(['/dashboard']);
        },
        error: (err: Error) => {
          this.loading.set(false);
          this.toast.error(err.message);
        },
      });
  }
}
