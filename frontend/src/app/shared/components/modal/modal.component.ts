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

@Component({
  selector: 'app-modal',
  standalone: true,
  imports: [ButtonComponent],
  template: `
    @if (open()) {
      <div
        class="fixed inset-0 z-50 flex items-end justify-center p-0 sm:items-center sm:p-4"
        role="dialog"
        aria-modal="true"
        [attr.aria-label]="title()"
      >
        <div
          class="absolute inset-0 bg-black/50 backdrop-blur-[2px] animate-fade-in"
          (click)="close()"
        ></div>
        <div
          class="relative z-10 flex max-h-[92vh] w-full flex-col rounded-dialog border-2 border-ink bg-surface shadow-pop animate-slide-up sm:w-auto"
          [style.max-width.px]="widthPx()"
        >
          @if (title()) {
            <div
              class="flex items-center justify-between gap-4 border-b-2 border-ink px-6 py-4"
            >
              <h2 class="font-display text-lg text-ink">{{ title() }}</h2>
              <app-button
                size="icon"
                variant="ghost"
                icon="x"
                [attr.aria-label]="'Close dialog'"
                (click)="close()"
              ></app-button>
            </div>
          }
          <div class="overflow-y-auto px-6 py-5">
            <ng-content></ng-content>
          </div>
        </div>
      </div>
    }
  `,
})
export class ModalComponent {
  readonly open = input(false);
  readonly title = input('');
  readonly width = input(560);
  readonly closed = output<void>();

  protected readonly widthPx = computed(() =>
    this.width() > 600 ? 600 : this.width()
  );

  @HostListener('document:keydown.escape')
  protected onEsc(): void {
    if (this.open()) this.close();
  }

  protected close(): void {
    this.closed.emit();
  }
}
