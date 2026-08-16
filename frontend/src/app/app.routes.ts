import { Routes } from '@angular/router';
import { authGuard, guestGuard } from './core/guards/auth.guard';

export const routes: Routes = [
  // ── Public marketing site ─────────────────────────────────────────
  {
    path: '',
    pathMatch: 'full',
    loadComponent: () =>
      import('./features/public/landing/landing.component').then((m) => m.LandingComponent),
  },
  {
    path: 'features',
    loadComponent: () =>
      import('./features/public/features/features.component').then((m) => m.FeaturesComponent),
  },
  {
    path: 'ai',
    loadComponent: () =>
      import('./features/public/ai-landing/ai-landing.component').then((m) => m.AiLandingComponent),
  },
  {
    path: 'about',
    loadComponent: () =>
      import('./features/public/about/about.component').then((m) => m.AboutComponent),
  },
  {
    path: 'contact',
    loadComponent: () =>
      import('./features/public/contact/contact.component').then((m) => m.ContactComponent),
  },

  // ── Auth (public, guests only) ───────────────────────────────────
  {
    path: 'login',
    canActivate: [guestGuard],
    loadComponent: () =>
      import('./features/auth/login/login.component').then((m) => m.LoginComponent),
  },
  {
    path: 'register',
    canActivate: [guestGuard],
    loadComponent: () =>
      import('./features/auth/register/register.component').then((m) => m.RegisterComponent),
  },
  {
    path: 'forgot-password',
    canActivate: [guestGuard],
    loadComponent: () =>
      import('./features/auth/forgot-password/forgot-password.component').then(
        (m) => m.ForgotPasswordComponent
      ),
  },
  {
    path: 'reset-password',
    canActivate: [guestGuard],
    loadComponent: () =>
      import('./features/auth/reset-password/reset-password.component').then(
        (m) => m.ResetPasswordComponent
      ),
  },

  // ── Authenticated application ────────────────────────────────────
  {
    path: 'app',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./layout/layout.component').then((m) => m.LayoutComponent),
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'today' },
      {
        path: 'today',
        loadComponent: () =>
          import('./features/today/today.component').then((m) => m.TodayComponent),
      },
      {
        path: 'dashboard',
        loadComponent: () =>
          import('./features/dashboard/dashboard.component').then((m) => m.DashboardComponent),
      },
      {
        path: 'ai',
        loadComponent: () => import('./features/ai/ai.component').then((m) => m.AiComponent),
      },
      {
        path: 'tasks',
        loadComponent: () =>
          import('./features/tasks/tasks.component').then((m) => m.TasksComponent),
      },
      {
        path: 'finance',
        loadComponent: () =>
          import('./features/finance/finance.component').then((m) => m.FinanceComponent),
      },
      {
        path: 'wishlist',
        loadComponent: () =>
          import('./features/wishlist/wishlist.component').then((m) => m.WishlistComponent),
      },
      {
        path: 'needs',
        loadComponent: () =>
          import('./features/needs/needs.component').then((m) => m.NeedsComponent),
      },
      {
        path: 'calendar',
        loadComponent: () =>
          import('./features/calendar/calendar.component').then((m) => m.CalendarComponent),
      },
      {
        path: 'goals',
        loadComponent: () =>
          import('./features/goals/goals.component').then((m) => m.GoalsComponent),
      },
      {
        path: 'habits',
        loadComponent: () =>
          import('./features/habits/habits.component').then((m) => m.HabitsComponent),
      },
      {
        path: 'notes',
        loadComponent: () =>
          import('./features/notes/notes.component').then((m) => m.NotesComponent),
      },
      {
        path: 'pomodoro',
        loadComponent: () =>
          import('./features/pomodoro/pomodoro.component').then((m) => m.PomodoroComponent),
      },
      {
        path: 'statistics',
        loadComponent: () =>
          import('./features/statistics/statistics.component').then((m) => m.StatisticsComponent),
      },
      {
        path: 'weekly-review',
        loadComponent: () =>
          import('./features/weekly-review/weekly-review.component').then(
            (m) => m.WeeklyReviewComponent
          ),
      },
      {
        path: 'monthly-review',
        loadComponent: () =>
          import('./features/monthly-review/monthly-review.component').then(
            (m) => m.MonthlyReviewComponent
          ),
      },
      {
        path: 'settings',
        loadComponent: () =>
          import('./features/settings/settings.component').then((m) => m.SettingsComponent),
      },
      {
        path: 'profile',
        loadComponent: () =>
          import('./features/profile/profile.component').then((m) => m.ProfileComponent),
      },
      {
        path: 'help',
        loadComponent: () =>
          import('./features/help/help.component').then((m) => m.HelpComponent),
      },
    ],
  },

  // Unknown URLs → public landing page.
  { path: '**', redirectTo: '' },
];
