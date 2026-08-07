import {
  Component,
  HostListener,
  computed,
  input,
  output,
} from '@angular/core';
import { NgClass } from '@angular/common';
import { IconComponent } from '../icon/icon.component';
import { ButtonComponent } from '../button/button.component';

export type DrawerSide = 'right' | 'left';

@Component({
  selector: 'app-drawer',
  standalone: true,
  imports: [NgClass, ButtonComponent],
  template: `
    @if (open()) {
      <div class="fixed inset-0 z-50" role="dialog" aria-modal="true" [attr.aria-label]="title()">
        <div
          class="absolute inset-0 bg-black/50 backdrop-blur-[2px] animate-fade-in"
          (click)="close()"
        ></div>
        <div
          class="absolute top-0 flex h-full w-full max-w-md flex-col bg-surface shadow-pop animate-slide-in-right"
          [ngClass]="{ 'right-0 border-l-2 border-ink': side() === 'right', 'left-0 border-r-2 border-ink': side() === 'left' }"
        >
          <div class="flex items-center justify-between gap-4 border-b-2 border-ink px-5 py-4">
            <h2 class="font-display text-base text-ink">{{ title() }}</h2>
            <app-button
              size="icon"
              variant="ghost"
              icon="x"
              [attr.aria-label]="'Close panel'"
              (click)="close()"
            ></app-button>
          </div>
          <div class="flex-1 overflow-y-auto p-5">
            <ng-content></ng-content>
          </div>
        </div>
      </div>
    }
  `,
})
export class DrawerComponent {
  readonly open = input(false);
  readonly title = input('');
  readonly side = input<DrawerSide>('right');
  readonly closed = output<void>();

  @HostListener('document:keydown.escape')
  protected onEsc(): void {
    if (this.open()) this.close();
  }

  protected close(): void {
    this.closed.emit();
  }
}
