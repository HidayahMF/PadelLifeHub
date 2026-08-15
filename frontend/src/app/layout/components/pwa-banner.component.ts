import { Component, computed, inject, signal } from '@angular/core';
import { PwaService } from '../../core/services/pwa.service';
import { I18nService } from '../../core/services/i18n.service';

/**
 * Subtle install + update banners. The install banner only appears after the
 * browser fires `beforeinstallprompt` (i.e. the site is installable) and the
 * user hasn't dismissed it before. The update banner appears when a freshly
 * deployed version has been fetched by the service worker, so users are never
 * stuck on an old cached build.
 */
@Component({
  selector: 'app-pwa-banner',
  standalone: true,
  template: `
    @if (showInstall()) {
      <div
        class="fixed inset-x-4 bottom-4 z-50 mx-auto max-w-md rounded-card border-2 border-ink bg-surface p-4 shadow-card"
        role="dialog"
        aria-label="Install LifeHub"
      >
        <div class="flex items-start gap-3">
          <img
            src="assets/logolifehub.png"
            alt=""
            class="mt-0.5 h-9 w-9 shrink-0 rounded-lg border-2 border-ink bg-primary object-contain p-1"
          />
          <div class="min-w-0 flex-1">
            <p class="text-sm font-bold text-ink">{{ t('Install LifeHub') }}</p>
            <p class="mt-0.5 text-xs text-ink-soft">
              {{ t('Install LifeHub on your device for a faster, app-like experience.') }}
            </p>
            <div class="mt-3 flex items-center gap-2">
              <button
                (click)="install()"
                class="flex-1 rounded-button border-2 border-ink bg-primary px-3 py-2 text-sm font-bold text-ink shadow-soft transition-all duration-150 hover:bg-primary-strong active:translate-y-[1px] active:shadow-none"
              >
                {{ t('Install') }}
              </button>
              <button
                (click)="dismissInstall()"
                class="rounded-button border-2 border-line px-3 py-2 text-sm font-bold text-ink-soft transition-colors hover:text-ink"
              >
                {{ t('Later') }}
              </button>
            </div>
          </div>
        </div>
      </div>
    }

    @if (showUpdate()) {
      <div
        class="fixed inset-x-4 bottom-4 z-50 mx-auto max-w-md rounded-card border-2 border-ink bg-surface p-4 shadow-card"
        role="dialog"
        aria-label="Update LifeHub"
      >
        <div class="flex items-start gap-3">
          <div
            class="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border-2 border-ink bg-primary text-base font-black text-ink"
          >
            !
          </div>
          <div class="min-w-0 flex-1">
            <p class="text-sm font-bold text-ink">{{ t('A new version of LifeHub is available.') }}</p>
            <div class="mt-3 flex items-center gap-2">
              <button
                (click)="update()"
                class="flex-1 rounded-button border-2 border-ink bg-primary px-3 py-2 text-sm font-bold text-ink shadow-soft transition-all duration-150 hover:bg-primary-strong active:translate-y-[1px] active:shadow-none"
              >
                {{ t('Update') }}
              </button>
              <button
                (click)="hideUpdate()"
                class="rounded-button border-2 border-line px-3 py-2 text-sm font-bold text-ink-soft transition-colors hover:text-ink"
              >
                {{ t('Dismiss') }}
              </button>
            </div>
          </div>
        </div>
      </div>
    }
  `,
})
export class PwaBannerComponent {
  protected readonly pwa = inject(PwaService);
  private readonly i18n = inject(I18nService);
  protected readonly t = this.i18n.t.bind(this.i18n);

  private readonly updateHidden = signal(false);

  protected readonly showInstall = this.pwa.canInstall;
  protected readonly showUpdate = computed(() => this.pwa.updateAvailable() && !this.updateHidden());

  protected install(): void {
    this.pwa.install();
  }

  protected dismissInstall(): void {
    this.pwa.dismiss();
  }

  protected update(): void {
    this.pwa.activateUpdate();
  }

  protected hideUpdate(): void {
    this.updateHidden.set(true);
  }
}
