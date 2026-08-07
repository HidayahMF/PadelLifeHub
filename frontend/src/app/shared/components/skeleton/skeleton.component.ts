import { Component, input } from '@angular/core';
import { NgClass } from '@angular/common';

@Component({
  selector: 'app-skeleton',
  standalone: true,
  imports: [NgClass],
  template: `
    <div
      class="animate-pulse rounded-md border-2 border-ink/15 bg-surface-2"
      [ngClass]="{
        'h-4': size() === 'text',
        'h-8': size() === 'title',
        'h-10': size() === 'field',
        'h-14': size() === 'button',
        'h-full w-full': size() === 'box',
      }"
    ></div>
  `,
})
export class SkeletonComponent {
  readonly size = input<'text' | 'title' | 'field' | 'button' | 'box'>('text');
}
