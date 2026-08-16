import { Component, computed, inject, OnDestroy, signal } from '@angular/core';
import { CardComponent } from '../../layout/components/card.component';
import { ButtonComponent } from '../../layout/components/button.component';
import { ToastService } from '../../core/services/toast.service';
import { I18nService } from '../../core/services/i18n.service';
import { FocusSessionService } from '../../core/services/data.service';
import type { FocusSessionPayload } from '../../core/models/misc.model';

type Mode = 'focus' | 'short' | 'long';
const DURATIONS: Record<Mode, number> = { focus: 25 * 60, short: 5 * 60, long: 15 * 60 };
const CYCLE_BREAK_EVERY = 4;

// Interrupted runs shorter than this are ignored (accidental taps / quick resets).
const MIN_FOCUS_SECONDS = 30;

/** Random id per focus run — crypto.randomUUID() where available, else a fallback. */
function newRunId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

@Component({
  selector: 'app-pomodoro',
  standalone: true,
  imports: [CardComponent, ButtonComponent],
  template: `
    <div class="mx-auto max-w-lg">
      <div class="mb-6 text-center">
        <h1 class="text-2xl font-bold tracking-tight text-ink">{{ t('Pomodoro') }}</h1>
        <p class="mt-1 text-sm text-ink-soft">{{ t('Focus in sprints, rest between.') }}</p>
      </div>

      <app-card>
        <div class="mb-8 flex items-center justify-center gap-2">
          <app-button
            [variant]="mode() === 'focus' ? 'primary' : 'secondary'"
            size="sm"
            (click)="setMode('focus')"
          >
            {{ t('Focus') }}
          </app-button>
          <app-button
            [variant]="mode() === 'short' ? 'primary' : 'secondary'"
            size="sm"
            (click)="setMode('short')"
          >
            {{ t('Short break') }}
          </app-button>
          <app-button
            [variant]="mode() === 'long' ? 'primary' : 'secondary'"
            size="sm"
            (click)="setMode('long')"
          >
            {{ t('Long break') }}
          </app-button>
        </div>

        <div class="mb-6 flex flex-col items-center">
          <svg viewBox="0 0 200 200" class="h-56 w-56">
            <!-- Rotate only the rings so the progress starts at 12 o'clock; the text stays horizontal. -->
            <g transform="rotate(-90 100 100)">
              <circle cx="100" cy="100" r="86" fill="none" stroke="var(--color-surface-2)" stroke-width="10" />
              <circle
                cx="100"
                cy="100"
                r="86"
                fill="none"
                [attr.stroke]="mode() === 'focus' ? 'var(--color-primary)' : 'var(--color-success)'"
                stroke-width="10"
                stroke-linecap="round"
                [attr.stroke-dasharray]="circumference"
                [attr.stroke-dashoffset]="dashOffset()"
                style="transition: stroke-dashoffset 1s linear"
              />
            </g>
            <text
              x="100"
              y="100"
              text-anchor="middle"
              dominant-baseline="central"
              class="fill-ink"
              style="font-family:var(--font-display);font-size:38px;letter-spacing:0.02em"
            >
              {{ timeDisplay() }}
            </text>
            <text
              x="100"
              y="128"
              text-anchor="middle"
              class="fill-ink-soft"
              style="font-size:12px"
            >
              {{ modeLabel() }} · {{ t('session {n}/{m}', { n: session(), m: cycleLength() }) }}
            </text>
          </svg>
        </div>

        <div class="flex items-center justify-center gap-3">
          <app-button
            [icon]="running() ? 'pause' : 'play'"
            [size]="'lg'"
            (click)="toggle()"
          >
            {{ running() ? t('Pause') : t('Start') }}
          </app-button>
          <app-button size="icon" variant="secondary" icon="rotate-ccw"
            [attr.aria-label]="t('Reset timer')"
            (click)="reset()"></app-button>
        </div>

        @if (completedFocus()) {
          <p class="mt-6 text-center text-sm text-ink-soft">
            🎉 {{ t(completedFocus() === 1 ? '🎉 {n} focus session completed today' : '🎉 {n} focus sessions completed today', { n: completedFocus() }) }}
          </p>
        }
      </app-card>
    </div>
  `,
})
export class PomodoroComponent implements OnDestroy {
  private toast = inject(ToastService);
  private i18n = inject(I18nService);
  private focusSessions = inject(FocusSessionService);

  protected readonly t = this.i18n.t.bind(this.i18n);

  protected readonly mode = signal<Mode>('focus');
  protected readonly running = signal(false);
  protected readonly session = signal(1);
  protected readonly completedFocus = signal(0);

  // Remaining seconds is a signal so the computed display + progress ring react
  // to every tick (a plain property would leave the timer looking frozen).
  private readonly remaining = signal(DURATIONS.focus);
  private timer: ReturnType<typeof setInterval> | null = null;

  // Idempotency key for the current focus run. Created when a focus run starts
  // and consumed when the run is recorded (completed or interrupted), so a
  // retried/duplicated POST can never create two sessions.
  private focusRunClientId: string | null = null;

  protected readonly circumference = 2 * Math.PI * 86;

  protected readonly dashOffset = computed(() => {
    const total = DURATIONS[this.mode()];
    return this.circumference * (1 - this.remaining() / total);
  });

  protected readonly timeDisplay = computed(() => {
    const remaining = this.remaining();
    const m = Math.floor(remaining / 60);
    const s = remaining % 60;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  });

  protected readonly modeLabel = computed(() => {
    if (this.mode() === 'focus') return this.t('Focus');
    if (this.mode() === 'short') return this.t('Short break');
    return this.t('Long break');
  });

  protected readonly cycleLength = computed(() => CYCLE_BREAK_EVERY);

  setMode(mode: Mode): void {
    // Leaving a focus run early (switching to a break) is an interruption.
    // Re-selecting the current mode is not.
    if (mode !== this.mode()) this.persistInterrupted();
    this.stopTimer();
    this.mode.set(mode);
    this.remaining.set(DURATIONS[mode]);
    this.running.set(false);
  }

  toggle(): void {
    if (this.running()) {
      this.stopTimer();
      this.running.set(false);
      return;
    }
    if (this.mode() === 'focus' && this.focusRunClientId === null) {
      // A fresh focus run gets a fresh idempotency key.
      this.focusRunClientId = newRunId();
    }
    this.running.set(true);
    // Guard: only one interval may ever exist at a time.
    this.stopTimer();
    this.timer = setInterval(() => {
      this.remaining.update((r) => r - 1);
      if (this.remaining() <= 0) {
        this.onComplete();
      }
    }, 1000);
  }

  reset(): void {
    // Stopping a partially-run focus session is an interruption.
    this.persistInterrupted();
    this.stopTimer();
    this.remaining.set(DURATIONS[this.mode()]);
    this.running.set(false);
  }

  private stopTimer(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  private onComplete(): void {
    this.stopTimer();
    this.running.set(false);
    if (this.mode() === 'focus') {
      this.persistCompleted();
      this.completedFocus.update((c) => c + 1);
      this.toast.success(this.t('Focus session complete — take a break!'));
      if (this.session() % CYCLE_BREAK_EVERY === 0) {
        this.mode.set('long');
      } else {
        this.mode.set('short');
      }
      this.session.update((s) => s + 1);
    } else {
      this.toast.success(this.t('Break over — back to focus!'));
      this.mode.set('focus');
    }
    this.remaining.set(DURATIONS[this.mode()]);
  }

  ngOnDestroy(): void {
    // Leaving the page mid-focus is an interruption too.
    this.persistInterrupted();
    this.stopTimer();
  }

  /** Seconds of the current focus run already accumulated. */
  private elapsedFocus(): number {
    if (this.mode() !== 'focus') return 0;
    return DURATIONS.focus - this.remaining();
  }

  /** Record a fully completed focus session (full duration). */
  private persistCompleted(): void {
    const clientId = this.focusRunClientId;
    this.focusRunClientId = null;
    if (clientId === null) return;
    const duration = DURATIONS.focus;
    const end = new Date();
    this.saveSession({
      clientId,
      startTime: new Date(end.getTime() - duration * 1000).toISOString(),
      endTime: end.toISOString(),
      duration,
      status: 'completed',
    });
  }

  /** Record an interrupted focus session (partial duration), if meaningful. */
  private persistInterrupted(): void {
    const clientId = this.focusRunClientId;
    this.focusRunClientId = null;
    if (clientId === null) return;
    const elapsed = this.elapsedFocus();
    if (elapsed < MIN_FOCUS_SECONDS) return;
    const end = new Date();
    this.saveSession({
      clientId,
      startTime: new Date(end.getTime() - elapsed * 1000).toISOString(),
      endTime: end.toISOString(),
      duration: elapsed,
      status: 'interrupted',
    });
  }

  /** Fire-and-forget persistence — the timer UX must never depend on the network. */
  private saveSession(payload: FocusSessionPayload): void {
    this.focusSessions.create(payload).subscribe({
      error: (err: Error) => console.warn('[pomodoro] could not save focus session:', err?.message),
    });
  }
}
