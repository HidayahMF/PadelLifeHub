import {
  ChangeDetectionStrategy,
  Component,
  HostListener,
  computed,
  input,
  output,
} from '@angular/core';
import { ButtonComponent } from './button.component';

@Component({
  selector: 'app-modal',
  standalone: true,
  imports: [ButtonComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (open()) {
      <div
        class="fixed inset-0 z-50 flex items-end justify-center p-0 sm:items-center sm:p-4"
        role="dialog"
        aria-modal="true"
        [attr.aria-label]="title()"
      >
        <div
          class="absolute inset-0 bg-black/60 animate-fade-in"
          (click)="close()"
        ></div>
        <div
          class="relative z-10 flex max-h-[92vh] w-full flex-col rounded-b-none rounded-t-dialog border-2 border-ink bg-surface shadow-pop animate-slide-up sm:rounded-dialog sm:w-auto transform-gpu will-change-transform"
          [style.max-width.px]="widthPx()"
        >
          @if (title()) {
            <div
              class="flex items-center justify-between gap-4 border-b-2 border-ink px-5 py-4 sm:px-6"
            >
              <h2 class="font-display text-lg text-ink">{{ title() }}</h2>
              <app-button
                size="icon"
                variant="ghost"
                icon="x"
                aria-label="Close dialog"
                (click)="close()"
              ></app-button>
            </div>
          }
          <div class="overflow-y-auto px-5 py-5 sm:px-6">
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
    this.width() > 1024 ? 1024 : this.width()
  );

  @HostListener('document:keydown.escape')
  protected onEsc(): void {
    if (this.open()) this.close();
  }

  protected close(): void {
    this.closed.emit();
  }
}
