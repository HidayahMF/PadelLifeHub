import { Component, computed, forwardRef, input } from '@angular/core';
import {
  ControlValueAccessor,
  FormsModule,
  NG_VALUE_ACCESSOR,
} from '@angular/forms';
import { NgClass, NgIf } from '@angular/common';
import { IconComponent } from './icon.component';

@Component({
  selector: 'app-field',
  standalone: true,
  imports: [FormsModule, NgClass, NgIf, IconComponent],
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => FieldComponent),
      multi: true,
    },
  ],
  host: { class: 'block' },
  template: `
    <div class="space-y-1.5">
      @if (label()) {
        <label class="block text-sm font-bold text-ink">{{ label() }}@if (required()) { * }</label>
      }
      <div class="relative">
        <app-icon
          *ngIf="leadingIcon()"
          [name]="leadingIcon() ?? ''"
          [size]="17"
          class="pointer-events-none absolute top-1/2 -translate-y-1/2"
          [style.left.px]="13"
          [style.color]="'var(--color-ink-faint)'"
        />
        <input
          #input
          [type]="type()"
          [value]="modelValue"
          [placeholder]="placeholder()"
          [disabled]="disabled()"
          [autocomplete]="autocomplete()"
          [attr.aria-label]="label() || placeholder()"
          (input)="onInput($any($event.target).value)"
          (blur)="onBlur()"
          class="h-11 w-full rounded-field border-2 bg-surface px-3.5 text-sm font-medium text-ink placeholder:font-normal placeholder:text-ink-faint transition-all duration-150 focus:outline-none disabled:cursor-not-allowed disabled:bg-surface-2"
          [ngClass]="fieldClass()"
        />
        <app-icon
          *ngIf="trailingIcon()"
          [name]="trailingIcon() ?? ''"
          [size]="17"
          class="pointer-events-none absolute top-1/2 -translate-y-1/2"
          [style.right.px]="13"
          [style.color]="'var(--color-ink-faint)'"
        />
      </div>
      @if (hint() && !invalid()) {
        <p class="text-xs font-medium text-ink-soft">{{ hint() }}</p>
      }
      @if (invalid()) {
        <p class="text-xs font-bold text-danger">{{ error() }}</p>
      }
    </div>
  `,
})
export class FieldComponent implements ControlValueAccessor {
  readonly label = input('');
  readonly placeholder = input('');
  readonly type = input('text');
  readonly required = input(false);
  readonly disabled = input(false);
  readonly autocomplete = input('off');
  readonly leadingIcon = input<string>();
  readonly trailingIcon = input<string>();
  readonly hint = input('');
  readonly invalid = input(false);
  readonly error = input('');

  protected readonly fieldClass = computed(() => {
    const padding: Record<string, boolean> = {
      'pl-10': !!this.leadingIcon(),
      'pr-10': !!this.trailingIcon(),
    };
    if (this.invalid()) {
      return {
        ...padding,
        'border-danger shadow-[3px_3px_0_0_var(--color-danger)] focus:border-danger': true,
      };
    }
    return {
      ...padding,
      'border-ink focus:border-primary focus:shadow-soft': true,
    };
  });

  modelValue = '';
  protected onChange: (value: string) => void = () => {};
  protected onTouched: () => void = () => {};

  writeValue(value: string): void {
    this.modelValue = value ?? '';
  }
  registerOnChange(fn: (value: string) => void): void {
    this.onChange = fn;
  }
  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }
  setDisabledState(isDisabled: boolean): void {
    this.disabledState = isDisabled;
  }

  protected disabledState = false;

  protected onInput(value: string): void {
    this.modelValue = value;
    this.onChange(value);
  }
  protected onBlur(): void {
    this.onTouched();
  }
}
