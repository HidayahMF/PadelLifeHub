import {
  Component,
  effect,
  ElementRef,
  HostListener,
  inject,
  viewChild,
} from '@angular/core';
import { Router } from '@angular/router';
import { OnboardingService, type TourStep } from '../../core/services/onboarding.service';
import { I18nService } from '../../core/services/i18n.service';
import { ButtonComponent } from '../../layout/components/button.component';
import { IconComponent } from '../../layout/components/icon.component';

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

/** An element counts as a tour target only when it is actually on screen. */
function isVisible(el: HTMLElement): boolean {
  const rect = el.getBoundingClientRect();
  if (rect.width === 0 || rect.height === 0) return false;
  const style = getComputedStyle(el);
  return style.display !== 'none' && style.visibility !== 'hidden';
}

function fitScore(x: number, y: number, w: number, h: number, vw: number, vh: number): number {
  let score = 0;
  if (x >= 8 && x + w <= vw - 8) score += 2;
  if (y >= 8 && y + h <= vh - 8) score += 2;
  if (x < 0 || x + w > vw) score -= 2;
  if (y < 0 || y + h > vh) score -= 2;
  return score;
}

/**
 * Spotlight product tour overlay. Shows a dimmed full-screen layer with a
 * "hole" (spotlight) around the real UI element and a compact tooltip. The
 * layout coordinates the mobile drawer so sidebar targets stay reachable on
 * small screens, and everything uses the theme's CSS variables so light and
 * dark mode both look right.
 */
@Component({
  selector: 'app-tour-overlay',
  standalone: true,
  imports: [ButtonComponent, IconComponent],
  styles: [
    `
      .tour-spotlight {
        box-shadow: 0 0 0 9999px rgba(0, 0, 0, 0.62);
      }
    `,
  ],
  template: `
    @if (onboarding.tourActive()) {
      <div
        class="fixed inset-0 z-[80] overflow-hidden"
        role="dialog"
        aria-modal="true"
        [attr.aria-label]="t('LifeHub interactive tour')"
      >
        @if (step(); as step) {
          @if (!step.final) {
            <div
              #spotlight
              class="tour-spotlight pointer-events-none absolute rounded-[12px] border-2 border-primary animate-fade-in"
              style="display:none"
            ></div>
          } @else {
            <div class="absolute inset-0 bg-black/60 animate-fade-in"></div>
          }

          @if (!step.final) {
            <div
              #tooltip
              class="absolute z-10 w-[min(360px,calc(100vw-24px))] rounded-dialog border-2 border-ink bg-surface p-5 shadow-pop animate-scale-in"
              role="tooltip"
              tabindex="-1"
              style="visibility:hidden"
              [attr.aria-labelledby]="'tour-title-' + step.id"
            >
              <div class="flex items-center justify-between gap-3">
                <span
                  class="rounded-md border-2 border-ink bg-primary px-2 py-0.5 font-display text-[11px] font-bold text-ink"
                >
                  {{ currentIndex() + 1 }} / {{ totalSteps }}
                </span>
                <button
                  (click)="skip()"
                  class="text-xs font-bold text-ink-faint transition-colors hover:text-ink"
                  [attr.aria-label]="t('Skip tour')"
                >
                  {{ t('Skip tour') }}
                </button>
              </div>
              <h2 [id]="'tour-title-' + step.id" class="mt-3 font-display text-lg text-ink">
                {{ t(step.title) }}
              </h2>
              <p class="mt-1.5 text-sm leading-relaxed text-ink-soft">{{ t(step.text) }}</p>
              <div class="mt-5 flex items-center justify-between gap-2">
                <button
                  (click)="back()"
                  [disabled]="isFirst()"
                  class="flex h-10 items-center gap-1.5 rounded-button border-2 border-ink bg-surface px-3.5 text-sm font-bold text-ink shadow-soft transition-all duration-100 hover:bg-surface-2 hover:-translate-y-[1px] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none disabled:pointer-events-none disabled:opacity-40 disabled:shadow-none"
                  [attr.aria-label]="t('Previous step')"
                >
                  <app-icon name="arrow-left" [size]="15" [strokeWidth]="2.6" />
                  {{ t('Back') }}
                </button>
                <button
                  (click)="next()"
                  class="flex h-10 items-center gap-1.5 rounded-button border-2 border-ink bg-primary px-4 text-sm font-bold text-ink shadow-soft transition-all duration-100 hover:bg-primary-strong hover:-translate-y-[1px] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none"
                >
                  {{ t('Next') }}
                  <app-icon name="arrow-right" [size]="15" [strokeWidth]="2.6" />
                </button>
              </div>
            </div>
          } @else {
            <div class="absolute inset-0 z-10 flex items-center justify-center p-4">
              <div
                data-tour-final
                tabindex="-1"
                class="w-full max-w-md rounded-dialog border-2 border-ink bg-surface p-8 text-center shadow-pop animate-scale-in"
              >
                <span
                  class="mx-auto flex h-16 w-16 items-center justify-center rounded-full border-2 border-ink bg-primary text-3xl shadow-soft"
                  >🎉</span
                >
                <h2 class="mt-5 font-display text-2xl text-ink">{{ t(step.title) }}</h2>
                <p class="mt-2.5 text-sm font-medium text-ink-soft">{{ t(step.text) }}</p>
                <div class="mt-7 flex flex-col gap-3 sm:flex-row sm:justify-center">
                  <app-button size="lg" icon="plus" (click)="finishAndCreate()">
                    {{ t('Get Started') }}
                  </app-button>
                  <app-button variant="secondary" size="lg" (click)="finish()">
                    {{ t('Explore LifeHub') }}
                  </app-button>
                </div>
              </div>
            </div>
          }
        }
      </div>
    }
  `,
})
export class TourOverlayComponent {
  protected readonly onboarding = inject(OnboardingService);
  private router = inject(Router);
  private i18n = inject(I18nService);

  protected readonly t = this.i18n.t.bind(this.i18n);
  private host = inject(ElementRef<HTMLElement>);

  private readonly spotlight = viewChild<ElementRef<HTMLDivElement>>('spotlight');
  private readonly tooltip = viewChild<ElementRef<HTMLDivElement>>('tooltip');

  protected readonly step = this.onboarding.currentStep;
  protected readonly currentIndex = this.onboarding.currentIndex;
  protected readonly totalSteps = this.onboarding.totalSteps;

  private disposed = false;

  constructor() {
    // Re-position (and re-navigate) whenever the active step changes.
    effect(() => {
      const active = this.onboarding.tourActive();
      const step = this.onboarding.currentStep();
      if (!active || !step) return;
      void this.positionSequence(step);
    });

    // Lock page scrolling while the tour is up so the spotlight stays put.
    effect(() => {
      if (this.onboarding.tourActive()) {
        document.body.style.overflow = 'hidden';
      } else {
        document.body.style.overflow = '';
      }
    });
  }

  ngOnDestroy(): void {
    this.disposed = true;
    document.body.style.overflow = '';
  }

  protected isFirst(): boolean {
    return this.currentIndex() === 0;
  }

  protected next(): void {
    this.onboarding.next();
  }

  protected back(): void {
    this.onboarding.back();
  }

  protected skip(): void {
    this.onboarding.skip();
  }

  protected finish(): void {
    this.onboarding.finish();
  }

  protected finishAndCreate(): void {
    this.onboarding.finishAndCreate();
  }

  @HostListener('document:keydown', ['$event'])
  protected onKey(event: KeyboardEvent): void {
    if (!this.onboarding.tourActive()) return;
    if (event.key === 'Escape') {
      event.preventDefault();
      this.onboarding.skip();
      return;
    }
    if (event.key === 'Tab') {
      this.trapTab(event);
    }
  }

  @HostListener('window:resize')
  protected onResize(): void {
    if (!this.onboarding.tourActive()) return;
    const step = this.onboarding.currentStep();
    if (step) this.position(step);
  }

  /** Keep focus inside the tour dialog (skip / back / next). */
  private trapTab(event: KeyboardEvent): void {
    const hostEl = this.host.nativeElement as HTMLElement;
    const focusables = Array.from(
      hostEl.querySelectorAll<HTMLElement>(
        'button:not([disabled]), [tabindex]:not([tabindex="-1"])'
      )
    );
    if (focusables.length === 0) return;
    const first = focusables[0];
    const last = focusables[focusables.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  /**
   * Full sequence for a step: request the mobile drawer when the target lives
   * in the sidebar, wait for route navigation + animations, then spotlight.
   */
  private async positionSequence(step: TourStep): Promise<void> {
    // Hide the tooltip/spotlight right away so stale content from the previous
    // step never flashes at the old position while we reposition.
    const tip = this.tooltip()?.nativeElement;
    const spot = this.spotlight()?.nativeElement;
    if (tip) tip.style.visibility = 'hidden';
    if (spot) spot.style.display = 'none';

    const mobile = window.innerWidth < 1024;
    if (step.final) {
      this.onboarding.needsDrawer.set(false);
    } else if (step.drawer && mobile) {
      this.onboarding.needsDrawer.set(true);
    } else {
      this.onboarding.needsDrawer.set(false);
    }

    if (step.route) {
      await this.waitForUrl(step.route);
    }

    await delay(step.drawer && mobile ? 450 : 320);

    if (this.disposed || !this.onboarding.tourActive()) return;

    // The drawer (mobile sidebar) can still be settling when we arrive. Wait
    // until the target is actually on screen before spotlighting it, so the
    // tour never points at thin air.
    for (let attempt = 0; attempt < 3; attempt++) {
      if (step.final || this.findVisibleTarget(step.targets ?? [])) break;
      await delay(150);
    }

    if (this.disposed || !this.onboarding.tourActive()) return;
    this.position(step);
  }

  /** Wait until the router has actually landed on the step's route. */
  private async waitForUrl(target: string): Promise<void> {
    const t = target.startsWith('/') ? target : `/${target}`;
    for (let i = 0; i < 50; i++) {
      if (this.router.url === t) return;
      await delay(50);
    }
  }

  /** Spotlight the step's target and place the tooltip next to it. */
  private position(step: TourStep): void {
    if (step.final) {
      const hostEl = this.host.nativeElement as HTMLElement;
      const card = hostEl.querySelector<HTMLElement>('[data-tour-final]');
      card?.focus({ preventScroll: true });
      return;
    }

    const spot = this.spotlight()?.nativeElement;
    const tip = this.tooltip()?.nativeElement;
    if (!spot || !tip) return;

    const target = this.findVisibleTarget(step.targets ?? []);
    if (!target) {
      // Graceful fallback: centered tooltip, no spotlight.
      spot.style.display = 'none';
      this.centerTooltip(tip);
      tip.focus({ preventScroll: true });
      return;
    }

    const rect = target.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const margin = 12;

    const left = clamp(rect.left, margin, vw - margin - 1);
    const top = clamp(rect.top, margin, vh - margin - 1);
    const right = clamp(rect.right, margin + 1, vw - margin);
    const bottom = clamp(rect.bottom, margin + 1, vh - margin);

    spot.style.display = 'block';
    spot.style.left = `${left}px`;
    spot.style.top = `${top}px`;
    spot.style.width = `${Math.max(right - left, 24)}px`;
    spot.style.height = `${Math.max(bottom - top, 24)}px`;

    this.placeTooltip(tip, rect);
    tip.focus({ preventScroll: true });
  }

  private placeTooltip(tip: HTMLElement, rect: DOMRect): void {
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const gap = 16;
    const tipW = tip.offsetWidth || 320;
    const tipH = tip.offsetHeight || 180;

    const candidates = [
      { x: rect.left + rect.width / 2 - tipW / 2, y: rect.bottom + gap }, // below
      { x: rect.left + rect.width / 2 - tipW / 2, y: rect.top - gap - tipH }, // above
      { x: rect.right + gap, y: rect.top + rect.height / 2 - tipH / 2 }, // right
      { x: rect.left - gap - tipW, y: rect.top + rect.height / 2 - tipH / 2 }, // left
    ].map((p) => ({
      ...p,
      score: fitScore(p.x, p.y, tipW, tipH, vw, vh),
    }));

    const best = candidates.reduce((a, b) => (b.score > a.score ? b : a));
    tip.style.left = `${clamp(best.x, 8, Math.max(8, vw - tipW - 8))}px`;
    tip.style.top = `${clamp(best.y, 8, Math.max(8, vh - tipH - 8))}px`;
    tip.style.visibility = 'visible';
  }

  private centerTooltip(tip: HTMLElement): void {
    const tipW = tip.offsetWidth || 320;
    const tipH = tip.offsetHeight || 180;
    tip.style.left = `${Math.max(8, (window.innerWidth - tipW) / 2)}px`;
    tip.style.top = `${Math.max(8, (window.innerHeight - tipH) / 2)}px`;
    tip.style.visibility = 'visible';
  }

  private findVisibleTarget(selectors: string[]): HTMLElement | null {
    for (const selector of selectors) {
      for (const el of Array.from(document.querySelectorAll<HTMLElement>(selector))) {
        if (isVisible(el)) return el;
      }
    }
    return null;
  }
}
