import { Component, forwardRef, input } from '@angular/core';
import {
  ControlValueAccessor,
  FormsModule,
  NG_VALUE_ACCESSOR,
} from '@angular/forms';
import { NgClass, NgIf } from '@angular/common';
import { IconComponent } from './icon.component';

export interface SelectOption {
  value: string;
  label: string;
}

@Component({
  selector: 'app-select',
  standalone: true,
  imports: [FormsModule, IconComponent],
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => SelectComponent),
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
        <select
          [value]="modelValue"
          [disabled]="disabledState"
          (change)="onChange($any($event.target).value)"
          (blur)="onBlur()"
          class="h-11 w-full appearance-none rounded-field border-2 border-ink bg-surface pl-3.5 pr-10 text-sm font-medium text-ink transition-all duration-150 focus:border-primary focus:shadow-soft focus:outline-none disabled:cursor-not-allowed disabled:bg-surface-2"
        >
          @if (placeholder()) {
            <option value="" disabled>{{ placeholder() }}</option>
          }
          @for (opt of options(); track opt.value) {
            <option [value]="opt.value">{{ opt.label }}</option>
          }
        </select>
        <app-icon
          name="chevron-down"
          [size]="17"
          class="pointer-events-none absolute top-1/2 -translate-y-1/2"
          [style.right.px]="13"
          [style.color]="'var(--color-ink-faint)'"
        />
      </div>
      @if (hint()) {
        <p class="text-xs font-medium text-ink-soft">{{ hint() }}</p>
      }
    </div>
  `,
})
export class SelectComponent implements ControlValueAccessor {
  readonly label = input('');
  readonly placeholder = input('');
  readonly options = input.required<SelectOption[]>();
  readonly required = input(false);
  readonly hint = input('');

  modelValue = '';
  protected disabledState = false;
  protected onChangeCb: (value: string) => void = () => {};
  protected onTouched: () => void = () => {};

  writeValue(value: string): void {
    this.modelValue = value ?? '';
  }
  registerOnChange(fn: (value: string) => void): void {
    this.onChangeCb = fn;
  }
  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }
  setDisabledState(isDisabled: boolean): void {
    this.disabledState = isDisabled;
  }
  protected onChange(value: string): void {
    this.modelValue = value;
    this.onChangeCb(value);
  }
  protected onBlur(): void {
    this.onTouched();
  }
}
