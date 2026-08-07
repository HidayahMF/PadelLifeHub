import { Routes } from '@angular/router';
import { authGuard, guestGuard } from './core/guards/auth.guard';

export const routes: Routes = [
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
    path: '',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./layout/layout.component').then((m) => m.LayoutComponent),
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'dashboard' },
      {
        path: 'dashboard',
        loadComponent: () =>
          import('./features/dashboard/dashboard.component').then((m) => m.DashboardComponent),
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
        path: 'settings',
        loadComponent: () =>
          import('./features/settings/settings.component').then((m) => m.SettingsComponent),
      },
      {
        path: 'profile',
        loadComponent: () =>
          import('./features/profile/profile.component').then((m) => m.ProfileComponent),
      },
    ],
  },
  { path: '**', redirectTo: 'dashboard' },
];
