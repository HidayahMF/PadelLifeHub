import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from './api.service';

export interface AiReply {
  success: boolean;
  reply: string;
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

  // NOTE: ApiService already prefixes environment.apiUrl which ends in /api,
  // so these paths must NOT repeat the /api segment.

  /** Free-form question answered against the user's own LifeHub data. */
  chat(message: string): Observable<AiReply> {
    return this.api.post<AiReply>('/ai/chat', { message });
  }

  /** READ ONLY — turn natural language into a transaction draft (no writes). */
  parseTransaction(message: string): Observable<QuickAddParseResult> {
    return this.api.post<QuickAddParseResult>('/ai/parse-transaction', { message });
  }

  /** THE WRITE — confirm a parsed draft; the backend re-validates everything. */
  createTransaction(draft: QuickAddDraft): Observable<QuickAddCreateResult> {
    return this.api.post<QuickAddCreateResult>('/ai/create-transaction', { draft });
  }

  /** Financial analysis of the current month vs the previous one. */
  financialInsight(): Observable<AiReply> {
    return this.api.post<AiReply>('/ai/financial-insight');
  }

  /** Recommended daily schedule built from today's tasks, habits and goals. */
  dailyPlan(): Observable<AiReply> {
    return this.api.post<AiReply>('/ai/daily-plan');
  }

  /** Habit consistency analysis (streaks, recent history, tips). */
  habitInsight(): Observable<AiReply> {
    return this.api.post<AiReply>('/ai/habit-insight');
  }

  /** Goal progress analysis (deadlines, risk, priorities). */
  goalInsight(): Observable<AiReply> {
    return this.api.post<AiReply>('/ai/goal-insight');
  }
}
