import { Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { IconComponent } from '../../../layout/components/icon.component';
import { ButtonComponent } from '../../../layout/components/button.component';

@Component({
  selector: 'app-empty-state',
  standalone: true,
  imports: [RouterLink, IconComponent, ButtonComponent],
  host: { class: 'block' },
  template: `
    <div class="flex flex-col items-center justify-center gap-3 py-12 text-center">
      <div
        class="flex h-16 w-16 items-center justify-center rounded-[14px] border-2 border-ink bg-primary/20 text-ink shadow-soft"
      >
        <app-icon [name]="icon()" [size]="28" [strokeWidth]="1.8" />
      </div>
      <div class="space-y-1">
        <p class="font-display text-lg text-ink">{{ title() }}</p>
        <p class="mx-auto max-w-xs text-sm font-medium text-ink-soft">{{ message() }}</p>
      </div>
      @if (actionLabel() && actionRoute()) {
        <app-button class="mt-2" [icon]="actionIcon()" [routerLink]="actionRoute()">
          {{ actionLabel() }}
        </app-button>
      }
    </div>
  `,
})
export class EmptyStateComponent {
  readonly icon = input('inbox');
  readonly title = input('Nothing here yet');
  readonly message = input('Add your first item to get started.');
  readonly actionLabel = input<string>();
  readonly actionRoute = input<string>();
  readonly actionIcon = input('plus');
}
