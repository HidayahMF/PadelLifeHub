import { Component, input } from '@angular/core';
import { LucideDynamicIcon } from '@lucide/angular';

@Component({
  selector: 'app-icon',
  standalone: true,
  imports: [LucideDynamicIcon],
  template: `
    @if (name()) {
      <svg
        lucideIcon
        [lucideIcon]="name()"
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
  readonly name = input<string>('');
  readonly size = input<number | string>(20);
  readonly strokeWidth = input<number | string>(2);
  readonly color = input<string>();
}
