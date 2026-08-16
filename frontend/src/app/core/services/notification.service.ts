import { computed, inject, Injectable, signal } from '@angular/core';
import { ApiService } from './api.service';
import type { NotificationItem } from '../models/misc.model';

@Injectable({ providedIn: 'root' })
export class NotificationService {
  private api = inject(ApiService);

  readonly notifications = signal<NotificationItem[]>([]);
  readonly loading = signal(false);
  readonly unread = computed(() => this.notifications().filter((n) => !n.read).length);

  private lastIds = new Set<string>();
  private browserPermissionAsked = false;

  /** Key under which already-seen notification ids are kept across reloads. */
  private static readonly SEEN_KEY = 'lifehub.notif.seen';
  private static readonly SEEN_MAX = 200;

  load(): void {
    this.loading.set(true);
    this.api.get<NotificationItem[]>('/notifications').subscribe({
      next: (res) => {
        // Diff for new items so we can surface browser notifications without
        // spamming. Seen ids persist across reloads, so a page refresh never
        // re-triggers a popup for an unread notification that already fired
        // once (e.g. a stale 'Reminder — …' the user never dismissed).
        const fresh = res.filter((n) => !this.hasSeen(n._id));
        this.notifications.set(res);
        this.rememberSeen(res.map((n) => n._id));
        this.loading.set(false);
        if (fresh.length > 0) {
          this.maybeBrowserNotify(fresh);
        }
      },
      error: () => this.loading.set(false),
    });
  }

  private loadSeen(): string[] {
    if (typeof window === 'undefined') return [];
    try {
      const raw = window.localStorage.getItem(NotificationService.SEEN_KEY);
      const parsed = raw ? (JSON.parse(raw) as string[]) : [];
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  private hasSeen(id: string): boolean {
    return this.loadSeen().includes(id);
  }

  private rememberSeen(ids: string[]): void {
    if (typeof window === 'undefined' || ids.length === 0) return;
    try {
      const merged = [...new Set([...this.loadSeen(), ...ids])].slice(
        -NotificationService.SEEN_MAX
      );
      window.localStorage.setItem(NotificationService.SEEN_KEY, JSON.stringify(merged));
    } catch {
      // Storage full / disabled — popups may repeat, but that is non-fatal.
    }
  }

  markRead(id: string): void {
    this.api.put<NotificationItem>(`/notifications/${id}/read`).subscribe({
      next: (updated) => {
        this.notifications.update((list) =>
          list.map((n) => (n._id === updated._id ? { ...n, read: true } : n))
        );
      },
    });
  }

  markAllRead(): void {
    this.api.put<{ message: string }>('/notifications/read-all').subscribe({
      next: () => {
        this.notifications.update((list) => list.map((n) => ({ ...n, read: true })));
      },
    });
  }

  remove(id: string): void {
    this.api.delete<{ message: string }>(`/notifications/${id}`).subscribe({
      next: () => this.notifications.update((list) => list.filter((n) => n._id !== id)),
    });
  }

  /** Best-effort browser notification for new items, only when permitted. */
  private maybeBrowserNotify(items: NotificationItem[]): void {
    if (typeof window === 'undefined' || !('Notification' in window)) return;
    if (Notification.permission === 'granted') {
      for (const item of items) {
        new Notification(item.title, { body: item.message || 'You have a new notification.' });
      }
    } else if (Notification.permission === 'default' && !this.browserPermissionAsked) {
      this.browserPermissionAsked = true;
      Notification.requestPermission().catch(() => undefined);
    }
  }
}
