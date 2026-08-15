import { Injectable, inject, signal } from '@angular/core';
import { SwUpdate } from '@angular/service-worker';
import { interval } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

/** Shape of the `beforeinstallprompt` event as exposed by Chromium. */
interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

const DISMISS_KEY = 'lifehub-install-dismissed';

/**
 * PWA plumbing: surfaces the browser install prompt (once, until the user
 * dismisses it) and nudges the user to reload when a new deployment lands.
 * No personal data is stored — the dismiss flag is just a boolean.
 */
@Injectable({ providedIn: 'root' })
export class PwaService {
  /** Optional: absent in test harnesses and development (provideServiceWorker is disabled). */
  private swUpdate = inject(SwUpdate, { optional: true });

  /** True while the browser offers an install prompt the user hasn't dismissed. */
  readonly canInstall = signal(false);
  /** True once a newer app version has been installed by the service worker. */
  readonly updateAvailable = signal(false);

  private deferred: BeforeInstallPromptEvent | null = null;

  constructor() {
    window.addEventListener('beforeinstallprompt', (event) => {
      if (localStorage.getItem(DISMISS_KEY)) return;
      event.preventDefault();
      this.deferred = event as BeforeInstallPromptEvent;
      this.canInstall.set(true);
    });

    window.addEventListener('appinstalled', () => {
      this.canInstall.set(false);
      this.deferred = null;
    });

    if (this.swUpdate?.isEnabled) {
      this.swUpdate.versionUpdates.subscribe((event) => {
        if (event.type === 'VERSION_READY') this.updateAvailable.set(true);
      });

      interval(30 * 60 * 1000)
        .pipe(takeUntilDestroyed())
        .subscribe(() => {
          this.swUpdate?.checkForUpdate().catch(() => undefined);
        });
    }
  }

  /** Ask the browser to show the native install dialog. */
  install(): void {
    this.deferred
      ?.prompt()
      .then(() => this.canInstall.set(false))
      .catch(() => undefined);
  }

  /** Hide the install banner and remember the dismissal. */
  dismiss(): void {
    this.canInstall.set(false);
    this.deferred = null;
    localStorage.setItem(DISMISS_KEY, '1');
  }

  /** Reload so the just-installed service worker takes over. */
  activateUpdate(): void {
    window.location.reload();
  }
}
