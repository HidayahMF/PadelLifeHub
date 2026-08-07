import { Component, forwardRef, input } from '@angular/core';
import {
  ControlValueAccessor,
  FormsModule,
  NG_VALUE_ACCESSOR,
} from '@angular/forms';
import { NgClass, NgIf } from '@angular/common';
import { IconComponent } from '../icon/icon.component';

@Component({
  selector: 'app-textarea',
  standalone: true,
  imports: [FormsModule],
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => TextareaComponent),
      multi: true,
    },
  ],
  template: `
    <div class="space-y-1.5">
      @if (label()) {
        <label class="block text-sm font-bold text-ink">{{ label() }}</label>
      }
      <textarea
        [value]="modelValue"
        [placeholder]="placeholder()"
        [rows]="rows()"
        [disabled]="disabledState"
        (input)="onInput($any($event.target).value)"
        (blur)="onBlur()"
        class="w-full resize-y rounded-field border-2 border-ink bg-surface px-3.5 py-2.5 text-sm font-medium text-ink placeholder:font-normal placeholder:text-ink-faint transition-all duration-150 focus:border-primary focus:shadow-soft focus:outline-none disabled:cursor-not-allowed disabled:bg-surface-2"
      ></textarea>
      @if (hint()) {
        <p class="text-xs font-medium text-ink-soft">{{ hint() }}</p>
      }
    </div>
  `,
})
export class TextareaComponent implements ControlValueAccessor {
  readonly label = input('');
  readonly placeholder = input('');
  readonly rows = input(3);
  readonly hint = input('');

  modelValue = '';
  protected disabledState = false;
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
  protected onInput(value: string): void {
    this.modelValue = value;
    this.onChange(value);
  }
  protected onBlur(): void {
    this.onTouched();
  }
}
