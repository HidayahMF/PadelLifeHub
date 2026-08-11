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

  load(): void {
    this.loading.set(true);
    this.api.get<NotificationItem[]>('/notifications').subscribe({
      next: (res) => {
        // Diff for new items so we can surface browser notifications without spamming.
        const fresh = res.filter((n) => !this.lastIds.has(n._id));
        this.notifications.set(res);
        this.lastIds = new Set(res.map((n) => n._id));
        this.loading.set(false);
        if (fresh.length > 0) {
          this.maybeBrowserNotify(fresh);
        }
      },
      error: () => this.loading.set(false),
    });
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
