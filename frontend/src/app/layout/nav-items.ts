export interface NavItem {
  label: string;
  route: string;
  icon: string;
}

export const NAV_SECTIONS: { title: string; items: NavItem[] }[] = [
  {
    title: '',
    items: [
      { label: 'Today', route: '/app/today', icon: 'calendar-check' },
      { label: 'Dashboard', route: '/app/dashboard', icon: 'layout-dashboard' },
      { label: 'LifeHub AI', route: '/app/ai', icon: 'bot' },
    ],
  },
  {
    title: 'Manage',
    items: [
      { label: 'Tasks', route: '/app/tasks', icon: 'list-todo' },
      { label: 'Finance', route: '/app/finance', icon: 'wallet' },
      { label: 'Wishlist', route: '/app/wishlist', icon: 'gift' },
      { label: 'Needs', route: '/app/needs', icon: 'shopping-basket' },
      { label: 'Calendar', route: '/app/calendar', icon: 'calendar-days' },
    ],
  },
  {
    title: 'Grow',
    items: [
      { label: 'Goals', route: '/app/goals', icon: 'target' },
      { label: 'Habits', route: '/app/habits', icon: 'flame' },
      { label: 'Notes', route: '/app/notes', icon: 'sticky-note' },
      { label: 'Pomodoro', route: '/app/pomodoro', icon: 'timer' },
      { label: 'Statistics', route: '/app/statistics', icon: 'bar-chart-3' },
      { label: 'Weekly review', route: '/app/weekly-review', icon: 'refresh-cw' },
      { label: 'Monthly review', route: '/app/monthly-review', icon: 'calendar-range' },
    ],
  },
];

export const NAV_BOTTOM: NavItem[] = [
  { label: 'Settings', route: '/app/settings', icon: 'settings' },
  { label: 'Profile', route: '/app/profile', icon: 'user-round' },
  { label: 'Help', route: '/app/help', icon: 'book-open' },
];
