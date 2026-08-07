import { Component, computed, input } from '@angular/core';
import { initials } from '../../../core/utils/format';

@Component({
  selector: 'app-avatar',
  standalone: true,
  template: `
    <span
      class="inline-flex items-center justify-center rounded-full border-2 border-ink font-bold text-ink"
      [style.width.px]="sizePx()"
      [style.height.px]="sizePx()"
      [style.font-size.px]="fontPx()"
      [style.background]="bg()"
    >
      {{ displayText() }}
    </span>
  `,
})
export class AvatarComponent {
  readonly name = input<string>('');
  readonly size = input<number>(36);
  readonly src = input<string>();
  readonly color = input<string>();

  protected readonly sizePx = computed(() => this.size());
  protected readonly fontPx = computed(() => Math.round(this.size() * 0.4));
  protected readonly bg = computed(() => this.color() ?? 'var(--color-primary)');
  protected readonly displayText = computed(() => initials(this.name()));
}
