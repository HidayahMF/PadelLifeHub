import { Component, effect, inject, SecurityContext, signal, viewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { NgClass } from '@angular/common';
import { CardComponent } from '../../layout/components/card.component';
import { ButtonComponent } from '../../layout/components/button.component';
import { IconComponent } from '../../layout/components/icon.component';
import { AiService } from '../../core/services/ai.service';
import type { ChatMessage } from '../../core/services/ai.service';
import { AuthService } from '../../core/services/auth.service';
import { I18nService } from '../../core/services/i18n.service';
import { renderMarkdown } from '../../core/utils/markdown';

type QuickActionKey = 'financial' | 'daily' | 'habit' | 'goal';

interface QuickAction {
  key: QuickActionKey;
  label: string;
  icon: string;
}

const QUICK_ACTIONS: QuickAction[] = [
  { key: 'financial', label: 'Analyze my finances', icon: 'wallet' },
  { key: 'daily', label: 'Plan my day', icon: 'calendar-check' },
  { key: 'habit', label: 'Analyze my habits', icon: 'flame' },
  { key: 'goal', label: 'Review my goals', icon: 'target' },
];

type LastAttempt = { kind: 'chat'; text: string } | { kind: 'action'; key: QuickActionKey };

@Component({
  selector: 'app-ai',
  standalone: true,
  imports: [FormsModule, NgClass, CardComponent, ButtonComponent, IconComponent],
  template: `
    <div class="space-y-6">
      <!-- Header -->
      <div>
        <h1 class="flex items-center gap-3 font-display text-3xl leading-tight text-ink">
          <img
            src="assets/LifeHubAI.png"
            alt="LifeHub AI"
            class="h-11 w-11 shrink-0 rounded-lg border-2 border-ink bg-surface object-contain p-1 shadow-soft"
          />
          LifeHub AI
        </h1>
        <p class="mt-2.5 text-sm font-medium text-ink-soft">
          {{ t('Your personal productivity and financial assistant.') }}
        </p>
      </div>

      <!-- Quick actions -->
      <div class="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        @for (action of quickActions; track action.key) {
          <button
            type="button"
            (click)="runAction(action.key)"
            [disabled]="sending()"
            class="flex items-center gap-3 rounded-card border-2 border-ink bg-surface p-4 text-left shadow-soft transition-all duration-150 hover:-translate-y-0.5 hover:bg-primary hover:text-ink disabled:pointer-events-none disabled:opacity-60"
          >
            <span
              class="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border-2 border-ink bg-surface-2"
            >
              <app-icon [name]="action.icon" [size]="18" />
            </span>
            <span class="text-sm font-bold text-ink">{{ t(action.label) }}</span>
          </button>
        }
      </div>

      <!-- Chat -->
      <app-card [padding]="'none'">
        <div class="flex h-[520px] max-h-[65vh] flex-col">
          <div
            class="flex items-center justify-between border-b-2 border-ink px-5 py-3"
          >
            <h2 class="flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-ink-soft">
              <app-icon name="message-square" [size]="16" />
              {{ t('Chat with LifeHub AI') }}
            </h2>
            @if (messages().length > 0) {
              <button
                type="button"
                (click)="clearChat()"
                class="flex items-center gap-1.5 rounded-button border-2 border-ink bg-surface px-2.5 py-1 text-xs font-semibold text-ink transition-colors hover:bg-surface-2"
              >
                <app-icon name="trash-2" [size]="13" />
                {{ t('Clear chat') }}
              </button>
            }
          </div>

          <div
            #chatList
            role="log"
            aria-live="polite"
            class="flex-1 space-y-4 overflow-y-auto p-5"
          >
            @if (messages().length === 0 && !sending()) {
              <div class="flex h-full flex-col items-center justify-center gap-3 py-10 text-center">
                <img
                  src="assets/LifeHubAI.png"
                  alt="LifeHub AI"
                  class="h-14 w-14 shrink-0 rounded-lg border-2 border-ink bg-surface object-contain p-1 shadow-soft"
                />
                <div>
                  <p class="font-display text-lg text-ink">LifeHub AI</p>
                  <p class="mx-auto mt-1 max-w-md text-sm text-ink-soft">
                    {{ t('LifeHub AI analyzes your real data — tasks, finances, habits, and goals — to give you practical insights.') }}
                  </p>
                  <p class="mx-auto mt-1 max-w-md text-xs text-ink-faint">
                    {{ t('Try one of the quick actions above, or type a question like “How was my spending this month?”') }}
                  </p>
                </div>
              </div>
            }

            @for (msg of messages(); track $index) {
              @if (msg.role === 'user') {
                <div class="ml-auto max-w-[88%] rounded-card border-2 border-ink bg-primary px-4 py-2.5 shadow-soft sm:max-w-[70%]">
                  <p class="whitespace-pre-wrap text-sm font-medium text-ink">{{ msg.content }}</p>
                </div>
              } @else {
                <div class="flex max-w-[95%] items-start gap-3 sm:max-w-[85%]">
                  <img
                    src="assets/LifeHubAI.png"
                    alt="LifeHub AI"
                    class="mt-0.5 h-8 w-8 shrink-0 rounded-lg border-2 border-ink bg-surface object-contain p-0.5"
                  />
                  <div class="min-w-0 flex-1 rounded-card border-2 border-ink bg-surface-2 px-4 py-3">
                    <div
                      class="ai-markdown text-sm leading-relaxed text-ink"
                      [innerHTML]="render(msg.content)"
                    ></div>
                  </div>
                </div>
              }
            }

            @if (sending()) {
              <div class="flex max-w-[95%] items-start gap-3 sm:max-w-[85%]">
                <img
                  src="assets/LifeHubAI.png"
                  alt="LifeHub AI"
                  class="mt-0.5 h-8 w-8 shrink-0 rounded-lg border-2 border-ink bg-surface object-contain p-0.5"
                />
                <div class="flex items-center gap-2 rounded-card border-2 border-ink bg-surface-2 px-4 py-3">
                  <span class="flex gap-1">
                    @for (i of [0, 1, 2]; track i) {
                      <span
                        class="h-2 w-2 animate-bounce rounded-full bg-ink-faint"
                        [class.animation-delay-200]="i === 1"
                        [class.animation-delay-400]="i === 2"
                      ></span>
                    }
                  </span>
                  <span class="text-sm font-medium text-ink-soft">{{ t('Thinking…') }}</span>
                </div>
              </div>
            }
          </div>

          @if (error()) {
            <div class="border-t-2 border-ink px-5 py-3">
              <div
                class="flex flex-wrap items-center gap-3 rounded-card border-2 border-danger/60 bg-danger/5 px-4 py-3"
              >
                <app-icon name="alert-circle" [size]="18" class="shrink-0 text-danger" />
                <p class="min-w-0 flex-1 text-sm font-medium text-danger">{{ error() }}</p>
                <app-button size="sm" variant="secondary" icon="refresh-cw" (click)="retry()">
                  {{ t('Try again') }}
                </app-button>
              </div>
            </div>
          }

          <div class="border-t-2 border-ink p-4">
            <form (ngSubmit)="send()" class="flex items-end gap-2">
              <input
                [(ngModel)]="input"
                name="aiMessage"
                type="text"
                autocomplete="off"
                [attr.aria-label]="t('Ask LifeHub AI…')"
                [placeholder]="t('Ask LifeHub AI…')"
                [disabled]="sending()"
                class="h-12 min-w-0 flex-1 rounded-button border-2 border-ink bg-surface px-4 text-sm font-medium text-ink placeholder:text-ink-faint focus:outline-2 focus:outline-offset-2 focus:outline-ink disabled:opacity-60"
              />
              <app-button
                type="submit"
                size="lg"
                icon="send"
                [disabled]="sending() || !input.trim()"
                [attr.aria-label]="t('Send message')"
              >
                {{ t('Send') }}
              </app-button>
            </form>
          </div>
        </div>
      </app-card>
    </div>
  `,
  styles: [
    `
      .ai-markdown h1,
      .ai-markdown h2,
      .ai-markdown h3 {
        margin: 0.75rem 0 0.35rem;
        font-weight: 800;
        line-height: 1.25;
      }
      .ai-markdown h1 {
        font-size: 1.125rem;
      }
      .ai-markdown h2 {
        font-size: 1rem;
      }
      .ai-markdown h3 {
        font-size: 0.9rem;
      }
      .ai-markdown p {
        margin: 0.4rem 0;
      }
      .ai-markdown p:first-child,
      .ai-markdown h1:first-child,
      .ai-markdown h2:first-child,
      .ai-markdown h3:first-child {
        margin-top: 0;
      }
      .ai-markdown ul,
      .ai-markdown ol {
        margin: 0.4rem 0;
        padding-left: 1.25rem;
      }
      .ai-markdown ul {
        list-style: disc;
      }
      .ai-markdown ol {
        list-style: decimal;
      }
      .ai-markdown li {
        margin: 0.2rem 0;
      }
      .ai-markdown code {
        border-radius: 0.375rem;
        border: 1px solid var(--color-ink);
        padding: 0.05rem 0.35rem;
        font-size: 0.8em;
        background: var(--color-surface);
      }
      .animation-delay-200 {
        animation-delay: 0.2s;
      }
      .animation-delay-400 {
        animation-delay: 0.4s;
      }
    `,
  ],
})
export class AiComponent {
  private ai = inject(AiService);
  private i18n = inject(I18nService);
  private route = inject(ActivatedRoute);
  private sanitizer = inject(DomSanitizer);
  private auth = inject(AuthService);

  protected readonly t = this.i18n.t.bind(this.i18n);
  protected readonly quickActions = QUICK_ACTIONS;

  protected readonly messages = this.ai.messages;
  protected readonly sending = signal(false);
  protected readonly error = signal<string | null>(null);
  protected input = '';

  private lastAttempt: LastAttempt | null = null;

  private readonly chatList = viewChild<{ nativeElement: HTMLElement }>('chatList');

  private currentUserId: string | undefined;

  constructor() {
    // Restore this user's persisted chat (survives tab switches & reloads),
    // and swap to that user's history when the signed-in user changes.
    effect(() => {
      const id = this.auth.user()?._id;
      if (id !== this.currentUserId) {
        this.currentUserId = id;
        this.ai.loadChat(id);
      }
    });

    // Entry points can deep-link with ?mode=… (e.g. Today → daily-plan,
    // Dashboard → financial) to auto-run the matching quick action.
    const mode = this.route.snapshot.queryParamMap.get('mode');
    const key: QuickActionKey | null =
      mode === 'financial' ? 'financial' : mode === 'daily-plan' ? 'daily' : mode === 'habit' ? 'habit' : mode === 'goal' ? 'goal' : null;
    if (key) {
      setTimeout(() => this.runAction(key), 150);
    }
  }

  protected send(): void {
    const text = this.input.trim();
    if (!text || this.sending()) return;
    this.lastAttempt = { kind: 'chat', text };
    this.pushUser(text);
    this.input = '';
    this.sending.set(true);
    this.error.set(null);
    this.ai.chat(text).subscribe({
      next: (res) => {
        this.pushAi(res.reply);
        this.sending.set(false);
      },
      error: (err: Error) => {
        this.sending.set(false);
        this.error.set(this.friendlyError(err));
      },
    });
  }

  protected runAction(key: QuickActionKey): void {
    if (this.sending()) return;
    const action = QUICK_ACTIONS.find((a) => a.key === key);
    if (!action) return;
    this.lastAttempt = { kind: 'action', key };
    this.pushUser(this.t(action.label));
    this.sending.set(true);
    this.error.set(null);

    const call =
      key === 'financial'
        ? this.ai.financialInsight()
        : key === 'daily'
          ? this.ai.dailyPlan()
          : key === 'habit'
            ? this.ai.habitInsight()
            : this.ai.goalInsight();

    call.subscribe({
      next: (res) => {
        this.pushAi(res.reply);
        this.sending.set(false);
      },
      error: (err: Error) => {
        this.sending.set(false);
        this.error.set(this.friendlyError(err));
      },
    });
  }

  protected retry(): void {
    const attempt = this.lastAttempt;
    if (!attempt || this.sending()) return;
    if (attempt.kind === 'chat') {
      this.input = attempt.text;
      this.send();
    } else {
      this.runAction(attempt.key);
    }
  }

  protected clearChat(): void {
    this.ai.clearChat(this.currentUserId);
    this.error.set(null);
    this.lastAttempt = null;
  }

  protected render(text: string): SafeHtml {
    return this.sanitizer.sanitize(SecurityContext.HTML, renderMarkdown(text)) ?? '';
  }

  private friendlyError(err: Error): string {
    const msg = err?.message ?? '';
    if (msg.includes('not configured')) return this.t('AI service is not configured');
    if (msg.includes('limit reached')) return this.t('AI request limit reached. Please try again later.');
    return this.t('AI service is temporarily unavailable.');
  }

  private pushUser(text: string): void {
    this.ai.messages.update((list) => [...list, { role: 'user', content: text }]);
    this.ai.saveChat(this.currentUserId);
  }

  private pushAi(text: string): void {
    this.ai.messages.update((list) => [...list, { role: 'ai', content: text }]);
    this.ai.saveChat(this.currentUserId);
  }
}
