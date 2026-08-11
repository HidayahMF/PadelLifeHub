import { Component, input } from '@angular/core';
import { NgClass } from '@angular/common';

export type CardPadding = 'sm' | 'md' | 'none';

@Component({
  selector: 'app-card',
  standalone: true,
  imports: [NgClass],
  host: { class: 'block' },
  template: `
    <!--
      h-full: fills the host element so cards stretch to equal height inside CSS grid rows.
      In normal flow the host height is auto, so h-full resolves to auto and has no effect.
    -->
    <div
      class="h-full rounded-card border-2 border-ink bg-surface shadow-card transition-transform duration-200 hover:-translate-y-0.5"
      [ngClass]="padding() === 'none' ? '' : padding() === 'sm' ? 'p-4' : 'p-5'"
    >
      <ng-content></ng-content>
    </div>
  `,
})
export class CardComponent {
  /**
   * Internal padding of the card box.
   * - 'md' (default): p-5 — consistent internal spacing
   * - 'sm': p-4
   * - 'none': consumer manages its own inner padding (e.g. lists, grids)
   */
  readonly padding = input<CardPadding>('md');
}
