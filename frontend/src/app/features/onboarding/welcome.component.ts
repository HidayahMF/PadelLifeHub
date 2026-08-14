import { Component, effect, HostListener, inject, viewChild } from '@angular/core';
import type { ElementRef } from '@angular/core';
import { ButtonComponent } from '../../layout/components/button.component';
import { OnboardingService } from '../../core/services/onboarding.service';
import { I18nService } from '../../core/services/i18n.service';

/**
 * First-run welcome card — shown once after sign-in until the user starts or
 * skips the tour. Deliberately small: two actions, no walls of text.
 */
@Component({
  selector: 'app-welcome',
  standalone: true,
  imports: [ButtonComponent],
  template: `
    @if (onboarding.welcomeOpen()) {
      <div
        class="fixed inset-0 z-[70] flex items-center justify-center p-4"
        role="dialog"
        aria-modal="true"
        [attr.aria-label]="t('Welcome to LifeHub')"
      >
        <div class="absolute inset-0 bg-black/60 backdrop-blur-[2px] animate-fade-in"></div>
        <div
          #dialog
          tabindex="-1"
          class="relative z-10 w-full max-w-md rounded-dialog border-2 border-ink bg-surface p-8 shadow-pop animate-scale-in"
        >
          <div class="mx-auto flex h-16 w-16 items-center justify-center rounded-[18px] border-2 border-ink bg-primary shadow-soft">
            <img src="assets/logolifehub.png" alt="LifeHub logo" class="h-10 w-10 object-contain" />
          </div>
          <h2 class="mt-5 text-center font-display text-2xl leading-tight text-ink">
            {{ t('Welcome to LifeHub 👋') }}
          </h2>
          <p class="mt-2.5 text-center text-sm font-medium text-ink-soft">
            {{ t('Your personal space to manage productivity, finances, habits, and goals.') }}
          </p>
          <div class="mt-7 flex flex-col gap-3">
            <app-button size="lg" icon="play" [block]="true" (click)="onboarding.startTour()">
              {{ t('Start Tour') }}
            </app-button>
            <app-button variant="ghost" [block]="true" (click)="onboarding.skipWelcome()">
              {{ t('Skip for now') }}
            </app-button>
          </div>
        </div>
      </div>
    }
  `,
})
export class WelcomeComponent {
  protected readonly onboarding = inject(OnboardingService);
  private i18n = inject(I18nService);

  protected readonly t = this.i18n.t.bind(this.i18n);
  private readonly dialog = viewChild<ElementRef<HTMLDivElement>>('dialog');

  constructor() {
    // Move focus into the modal so keyboard & screen-reader users land inside it.
    effect(() => {
      if (this.onboarding.welcomeOpen()) {
        setTimeout(() => this.dialog()?.nativeElement.focus({ preventScroll: true }), 0);
      }
    });
  }

  @HostListener('document:keydown.escape')
  protected onEsc(): void {
    if (this.onboarding.welcomeOpen()) this.onboarding.skipWelcome();
  }
}
