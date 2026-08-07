import { Component, computed, input } from '@angular/core';

@Component({
  selector: 'app-spinner',
  standalone: true,
  template: `
    <svg
      class="animate-spin"
      [style.width.px]="sizePx()"
      [style.height.px]="sizePx()"
      [style.color]="color() || null"
      [attr.role]="'status'"
      [attr.aria-label]="label()"
      viewBox="0 0 24 24"
      fill="none"
    >
      <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-opacity="0.2" stroke-width="3" />
      <path
        d="M22 12a10 10 0 0 0-10-10"
        stroke="currentColor"
        stroke-width="3"
        stroke-linecap="round"
      />
    </svg>
  `,
  host: {
    style: 'display:inline-flex; color: var(--color-ink-soft)',
  },
})
export class SpinnerComponent {
  readonly size = input<'sm' | 'md' | 'lg'>('md');
  readonly color = input<string>();
  readonly label = input('Loading');

  protected readonly sizePx = computed(() =>
    this.size() === 'sm' ? 16 : this.size() === 'lg' ? 32 : 22
  );
}
