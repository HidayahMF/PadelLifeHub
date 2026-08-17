import { inject, Injectable, signal } from '@angular/core';
import { Observable, tap } from 'rxjs';
import { ApiService } from './api.service';

export interface AiReply {
  success: boolean;
  reply: string;
}

export interface ChatMessage {
  role: 'user' | 'ai';
  content: string;
}

/** Transaction draft produced by the AI parser (read-only) and echoed back on confirm. */
export interface QuickAddDraft {
  type: 'income' | 'expense' | 'transfer';
  amount: number;
  description?: string | null;
  categoryId?: string | null;
  categoryName?: string | null;
  accountId?: string | null;
  accountName?: string | null;
  fromAccountId?: string | null;
  fromAccountName?: string | null;
  toAccountId?: string | null;
  toAccountName?: string | null;
}

export interface QuickAddParseResult {
  success: boolean;
  intent: 'transaction' | 'question' | 'clarify';
  draft?: QuickAddDraft;
  reply?: string;
}

export interface QuickAddCreateResult {
  success: boolean;
  created: boolean;
  transaction?: unknown;
  reply?: string;
}

/** Client for the LifeHub AI endpoints (backend holds the Gemini key). */
@Injectable({ providedIn: 'root' })
export class AiService {
  private api = inject(ApiService);

  /**
   * Chat history. Lives in the root service (not the component) and is backed
   * by localStorage per user, so navigating between tabs/pages — or reloading
   * the app — never loses the conversation. Only "Clear chat" removes it.
   */
  readonly messages = signal<ChatMessage[]>([]);

  /** Whether an AI request is currently in-flight. Used for dedup. */
  readonly loading = signal(false);

  private static readonly CHAT_KEY_PREFIX = 'lifehub.ai.chat.';
  private static readonly CHAT_MAX_MESSAGES = 200;

  // NOTE: ApiService already prefixes environment.apiUrl which ends in /api,
  // so these paths must NOT repeat the /api segment.

  /**
   * Free-form question answered against the user's own LifeHub data.
   * The component's `sending()` guard prevents duplicate in-flight requests.
   */
  chat(message: string): Observable<AiReply> {
    this.loading.set(true);
    return this.api.post<AiReply>('/ai/chat', { message }).pipe(
      tap({
        next: () => this.loading.set(false),
        error: () => this.loading.set(false),
      }),
    );
  }

  /** READ ONLY — turn natural language into a transaction draft (no writes). */
  parseTransaction(message: string): Observable<QuickAddParseResult> {
    this.loading.set(true);
    return this.api.post<QuickAddParseResult>('/ai/parse-transaction', { message }).pipe(
      tap({
        next: () => this.loading.set(false),
        error: () => this.loading.set(false),
      }),
    );
  }

  /** THE WRITE — confirm a parsed draft; the backend re-validates everything. */
  createTransaction(draft: QuickAddDraft): Observable<QuickAddCreateResult> {
    this.loading.set(true);
    return this.api.post<QuickAddCreateResult>('/ai/create-transaction', { draft }).pipe(
      tap({
        next: () => this.loading.set(false),
        error: () => this.loading.set(false),
      }),
    );
  }

  /** Financial analysis of the current month vs the previous one. */
  financialInsight(): Observable<AiReply> {
    this.loading.set(true);
    return this.api.post<AiReply>('/ai/financial-insight').pipe(
      tap({
        next: () => this.loading.set(false),
        error: () => this.loading.set(false),
      }),
    );
  }

  /** Recommended daily schedule built from today's tasks, habits and goals. */
  dailyPlan(): Observable<AiReply> {
    this.loading.set(true);
    return this.api.post<AiReply>('/ai/daily-plan').pipe(
      tap({
        next: () => this.loading.set(false),
        error: () => this.loading.set(false),
      }),
    );
  }

  /** Habit consistency analysis (streaks, recent history, tips). */
  habitInsight(): Observable<AiReply> {
    this.loading.set(true);
    return this.api.post<AiReply>('/ai/habit-insight').pipe(
      tap({
        next: () => this.loading.set(false),
        error: () => this.loading.set(false),
      }),
    );
  }

  /** Goal progress analysis (deadlines, risk, priorities). */
  goalInsight(): Observable<AiReply> {
    this.loading.set(true);
    return this.api.post<AiReply>('/ai/goal-insight').pipe(
      tap({
        next: () => this.loading.set(false),
        error: () => this.loading.set(false),
      }),
    );
  }

  /** Load the persisted chat for a user into memory (no-op when empty). */
  loadChat(userId?: string): void {
    this.messages.set(this.readStored(userId));
  }

  /**
   * Persist the current in-memory chat for a user. Keeps only the most recent
   * CHAT_MAX_MESSAGES entries so the key never grows out of control.
   */
  saveChat(userId?: string): void {
    const capped = this.messages().slice(-AiService.CHAT_MAX_MESSAGES);
    this.messages.set(capped);
    if (typeof window === 'undefined') return;
    try {
      if (!userId) {
        window.localStorage.removeItem(AiService.CHAT_KEY_PREFIX);
        return;
      }
      window.localStorage.setItem(
        `${AiService.CHAT_KEY_PREFIX}${userId}`,
        JSON.stringify(capped)
      );
    } catch {
      // Storage full / disabled — chat survives in memory only. Non-fatal.
    }
  }

  /** Empty the in-memory chat and delete the persisted copy for a user. */
  clearChat(userId?: string): void {
    this.messages.set([]);
    if (typeof window === 'undefined') return;
    try {
      if (userId) {
        window.localStorage.removeItem(`${AiService.CHAT_KEY_PREFIX}${userId}`);
      }
    } catch {
      // Non-fatal.
    }
  }

  private readStored(userId?: string): ChatMessage[] {
    if (typeof window === 'undefined' || !userId) return [];
    try {
      const raw = window.localStorage.getItem(`${AiService.CHAT_KEY_PREFIX}${userId}`);
      if (!raw) return [];
      const parsed = JSON.parse(raw) as ChatMessage[];
      if (!Array.isArray(parsed)) return [];
      return parsed.filter(
        (m) =>
          m &&
          typeof m.content === 'string' &&
          (m.role === 'user' || m.role === 'ai')
      );
    } catch {
      return [];
    }
  }
}
