import { Component, computed, ElementRef, inject, input } from '@angular/core';
import { NgClass, NgIf } from '@angular/common';
import { IconComponent } from './icon.component';
import { SpinnerComponent } from './spinner.component';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'accent';
export type ButtonSize = 'sm' | 'md' | 'lg' | 'icon';

@Component({
  selector: 'app-button',
  standalone: true,
  imports: [NgClass, NgIf, IconComponent, SpinnerComponent],
  template: `
    <button
      [type]="type()"
      [disabled]="disabled() || loading()"
      [attr.aria-label]="hostAriaLabel"
      [attr.title]="hostTitle"
      class="inline-flex select-none items-center justify-center gap-2 rounded-button font-bold transition-all duration-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink disabled:pointer-events-none disabled:opacity-50 disabled:shadow-none"
      [ngClass]="classes()"
    >
      <app-spinner
        *ngIf="loading()"
        size="sm"
        [color]="spinnerColor()"
      />
      <app-icon
        *ngIf="icon() && !loading()"
        [name]="icon() ?? ''"
        [size]="size() === 'lg' ? 20 : size() === 'sm' ? 15 : 18"
        [strokeWidth]="2.4"
      />
      <ng-content></ng-content>
    </button>
  `,
})
export class ButtonComponent {
  private host = inject(ElementRef);

  // Forward aria-label / title set on <app-button> to the real <button> so
  // icon buttons stay accessible (screen readers + tooltips). Without this,
  // the attributes sat uselessly on the custom element host.
  protected get hostAriaLabel(): string | null {
    return this.host.nativeElement.getAttribute('aria-label');
  }

  protected get hostTitle(): string | null {
    return this.host.nativeElement.getAttribute('title');
  }

  readonly variant = input<ButtonVariant>('primary');
  readonly size = input<ButtonSize>('md');
  readonly type = input<'button' | 'submit' | 'reset'>('button');
  readonly disabled = input(false);
  readonly loading = input(false);
  readonly icon = input<string>();
  readonly block = input(false);

  protected readonly spinnerColor = computed(() =>
    this.variant() === 'danger' || this.variant() === 'accent'
      ? 'rgba(255,255,255,0.95)'
      : 'var(--color-ink)'
  );

  protected readonly classes = computed(() => {
    const base: Record<string, boolean> = {};

    base['h-10 px-4 text-sm'] = this.size() === 'md';
    base['h-9 px-3 text-sm'] = this.size() === 'sm';
    base['h-12 px-5 text-base'] = this.size() === 'lg';
    base['h-10 w-10'] = this.size() === 'icon';
    base['w-full'] = this.block();

    const press = 'active:translate-x-[2px] active:translate-y-[2px] active:shadow-none';

    const outlined = 'border-2 border-ink';

    switch (this.variant()) {
      case 'primary':
        Object.assign(base, {
          [`${outlined} bg-primary text-ink shadow-soft hover:bg-primary-strong hover:-translate-y-[1px]`]: true,
          [press]: true,
        });
        break;
      case 'secondary':
        Object.assign(base, {
          [`${outlined} bg-surface text-ink shadow-soft hover:bg-surface-2 hover:-translate-y-[1px]`]: true,
          [press]: true,
        });
        break;
      case 'ghost':
        Object.assign(base, {
          'border-2 border-transparent bg-transparent text-ink-soft shadow-none hover:bg-surface-2 hover:text-ink': true,
        });
        break;
      case 'danger':
        Object.assign(base, {
          [`${outlined} bg-danger text-white shadow-soft hover:brightness-95 hover:-translate-y-[1px]`]: true,
          [press]: true,
        });
        break;
      case 'accent':
        Object.assign(base, {
          [`${outlined} bg-accent text-white shadow-soft hover:opacity-90 hover:-translate-y-[1px]`]: true,
          [press]: true,
        });
        break;
    }
    return base;
  });
}
