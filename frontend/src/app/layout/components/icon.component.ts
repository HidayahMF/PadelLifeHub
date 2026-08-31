import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { LUCIDE_ICONS, LucideDynamicIcon } from '@lucide/angular';

@Component({
  selector: 'app-icon',
  standalone: true,
  imports: [LucideDynamicIcon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (safeIconName()) {
      <svg
        lucideIcon
        [lucideIcon]="safeIconName()!"
        [size]="size()"
        [strokeWidth]="strokeWidth()"
        [color]="color()"
        [attr.aria-hidden]="true"
      ></svg>
    }
  `,
  host: { class: 'inline-flex shrink-0' },
})
export class IconComponent {
  private icons = inject(LUCIDE_ICONS, { optional: true });

  readonly name = input<string>('');
  readonly size = input<number | string>(20);
  readonly strokeWidth = input<number | string>(2);
  readonly color = input<string>();

  protected readonly safeIconName = computed(() => {
    const n = this.name();
    if (!n) return null;
    if (!this.icons || (typeof this.icons === 'object' && n in this.icons)) {
      return n;
    }
    return null;
  });
}
