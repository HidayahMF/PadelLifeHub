export interface NavItem {
  label: string;
  route: string;
  icon: string;
}

export const NAV_SECTIONS: { title: string; items: NavItem[] }[] = [
  {
    title: '',
    items: [
      { label: 'Today', route: '/today', icon: 'calendar-check' },
      { label: 'Dashboard', route: '/dashboard', icon: 'layout-dashboard' },
      { label: 'LifeHub AI', route: '/ai', icon: 'bot' },
    ],
  },
  {
    title: 'Manage',
    items: [
      { label: 'Tasks', route: '/tasks', icon: 'list-todo' },
      { label: 'Finance', route: '/finance', icon: 'wallet' },
      { label: 'Wishlist', route: '/wishlist', icon: 'gift' },
      { label: 'Needs', route: '/needs', icon: 'shopping-basket' },
      { label: 'Calendar', route: '/calendar', icon: 'calendar-days' },
    ],
  },
  {
    title: 'Grow',
    items: [
      { label: 'Goals', route: '/goals', icon: 'target' },
      { label: 'Habits', route: '/habits', icon: 'flame' },
      { label: 'Notes', route: '/notes', icon: 'sticky-note' },
      { label: 'Pomodoro', route: '/pomodoro', icon: 'timer' },
      { label: 'Statistics', route: '/statistics', icon: 'bar-chart-3' },
      { label: 'Weekly review', route: '/weekly-review', icon: 'refresh-cw' },
    ],
  },
];

export const NAV_BOTTOM: NavItem[] = [
  { label: 'Settings', route: '/settings', icon: 'settings' },
  { label: 'Profile', route: '/profile', icon: 'user-round' },
  { label: 'Help', route: '/help', icon: 'book-open' },
];
