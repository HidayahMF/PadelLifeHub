import { Component, input } from '@angular/core';

@Component({
  selector: 'app-card',
  standalone: true,
  template: `
    <div
      class="rounded-card border-2 border-ink bg-surface shadow-card transition-transform duration-200 hover:-translate-y-0.5"
    >
      <ng-content></ng-content>
    </div>
  `,
})
export class CardComponent {}
