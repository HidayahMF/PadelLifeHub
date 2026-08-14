import { computed, inject, Injectable, signal } from '@angular/core';
import { Router } from '@angular/router';
import { SettingService } from './data.service';
import { CommandService } from './command.service';
import type { Setting } from '../models/misc.model';

export type OnboardingStatus =
  | 'not_started'
  | 'in_progress'
  | 'completed'
  | 'skipped';

export interface TourStep {
  id: string;
  title: string;
  text: string;
  /** Route to visit before highlighting this step (skipped if already there). */
  route?: string;
  /** CSS selectors for the element to spotlight — the first visible one wins. */
  targets?: string[];
  /** True when the target lives in the sidebar (needs the mobile drawer on small screens). */
  drawer?: boolean;
  /** Final celebration card — no spotlight. */
  final?: boolean;
}

/**
 * The first-run tour. Kept short on purpose: it only teaches the shape of the
 * app (Today, Dashboard, Quick Add, Search, Tasks, Finance, Grow) so the user
 * knows where to start. Every other feature is covered in the Help page.
 */
const TOUR_STEPS: TourStep[] = [
  {
    id: 'today',
    title: 'Today',
    text: 'Start your day here. Today gives you a quick overview of tasks, habits, goals, and today\u2019s finances.',
    route: '/today',
    targets: ['a[href="/today"]'],
    drawer: true,
  },
  {
    id: 'dashboard',
    title: 'Dashboard',
    text: 'Dashboard gives you a complete overview of your productivity and finances.',
    route: '/dashboard',
    targets: ['a[href="/dashboard"]'],
    drawer: true,
  },
  {
    id: 'quick-add',
    title: 'Quick Add',
    text: 'Quickly create a task, transaction, note, goal, reminder, wishlist item, or need without leaving your current page. Press N to jump straight to a new task.',
    targets: [
      'app-topbar button[aria-label="Quick add"]',
      'app-quick-add button[aria-label="Quick add"]',
    ],
  },
  {
    id: 'search',
    title: 'Global Search',
    text: 'Search your LifeHub data from one place — tasks, notes, transactions, goals, habits and more. Press Ctrl/Cmd + K or / to open it.',
    targets: [
      'app-topbar button[aria-label="Open global search (Ctrl+K)"]',
      'app-topbar button[aria-label="Search"]',
    ],
  },
  {
    id: 'tasks',
    title: 'Tasks',
    text: 'Manage your tasks, deadlines, reminders, recurring tasks, categories, and tags.',
    route: '/tasks',
    targets: ['a[href="/tasks"]'],
    drawer: true,
  },
  {
    id: 'finance',
    title: 'Finance',
    text: 'Track your accounts, income, expenses, transfers, budgets, and spending.',
    route: '/finance',
    targets: ['a[href="/finance"]'],
    drawer: true,
  },
  {
    id: 'grow',
    title: 'Grow',
    text: 'Build better habits and track your goals over time.',
    route: '/goals',
    targets: ['a[href="/goals"]', 'a[href="/habits"]'],
    drawer: true,
  },
  {
    id: 'final',
    title: 'You\u2019re ready! \uD83C\uDF89',
    text: 'Start by creating your first task or transaction.',
    final: true,
  },
];

/**
 * First-run onboarding: welcome modal + interactive spotlight tour.
 *
 * Status is stored in the per-user Setting document (backend) so a user who
 * finished or skipped the tour never sees the welcome modal again, while
 * "Take a Tour Again" in Help can re-run it at any time.
 */
@Injectable({ providedIn: 'root' })
export class OnboardingService {
  private router = inject(Router);
  private settings = inject(SettingService);
  private command = inject(CommandService);

  readonly welcomeOpen = signal(false);
  readonly tourActive = signal(false);
  readonly currentIndex = signal(0);
  /** Requests the layout to open the mobile drawer (sidebar targets on small screens). */
  readonly needsDrawer = signal(false);

  readonly currentStep = computed(() =>
    this.tourActive() ? (TOUR_STEPS[this.currentIndex()] ?? null) : null
  );
  readonly totalSteps = TOUR_STEPS.length;

  private status: OnboardingStatus = 'not_started';
  private initialized = false;

  /** Load the persisted status once (called from the layout on sign-in). */
  init(): void {
    if (this.initialized) return;
    this.initialized = true;
    const cached = this.settings.settings();
    if (cached) {
      this.evaluate(cached);
      return;
    }
    this.settings.get().subscribe({
      next: (s) => this.evaluate(s),
      error: () => {},
    });
  }

  /** Start the tour from the beginning (first-time or replay). */
  startTour(): void {
    this.welcomeOpen.set(false);
    this.updateStatus('in_progress');
    this.currentIndex.set(0);
    this.tourActive.set(true);
    void this.navigateToStep(TOUR_STEPS[0]);
  }

  /** Dismiss the welcome modal without starting the tour. */
  skipWelcome(): void {
    this.welcomeOpen.set(false);
    this.updateStatus('skipped');
  }

  next(): void {
    const next = this.currentIndex() + 1;
    if (next >= TOUR_STEPS.length) {
      this.finish();
      return;
    }
    this.currentIndex.set(next);
    void this.navigateToStep(TOUR_STEPS[next]);
  }

  back(): void {
    const prev = this.currentIndex() - 1;
    if (prev < 0) return;
    this.currentIndex.set(prev);
    void this.navigateToStep(TOUR_STEPS[prev]);
  }

  /** Leave the tour early (Esc or Skip button). */
  skip(): void {
    this.tourActive.set(false);
    this.needsDrawer.set(false);
    this.updateStatus('skipped');
  }

  /** Complete the tour and land the user on Today. */
  finish(): void {
    this.tourActive.set(false);
    this.needsDrawer.set(false);
    this.updateStatus('completed');
    void this.router.navigate(['/today']);
  }

  /** Finish the tour and open Quick Add so the user can create their first item. */
  finishAndCreate(): void {
    this.tourActive.set(false);
    this.needsDrawer.set(false);
    this.updateStatus('completed');
    void this.router.navigate(['/today']).then(() => {
      // Defer until the page (and its quick-add host) is ready.
      setTimeout(() => this.command.openQuickAdd('task'), 350);
    });
  }

  private evaluate(setting: Setting): void {
    this.status = setting.onboarding?.status ?? 'not_started';
    if (this.status === 'not_started') {
      this.welcomeOpen.set(true);
    }
  }

  private updateStatus(next: OnboardingStatus): void {
    this.status = next;
    const onboarding: NonNullable<Setting['onboarding']> = { status: next };
    if (next === 'completed') {
      onboarding.completedAt = new Date().toISOString();
    }
    this.settings.update({ onboarding }).subscribe({ error: () => {} });
  }

  private async navigateToStep(step: TourStep): Promise<void> {
    if (!step.route) return;
    try {
      await this.router.navigate([step.route]);
    } catch {
      // Navigation failure must never break the tour.
    }
  }
}
