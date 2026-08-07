import { Directive, TemplateRef, input } from '@angular/core';

@Directive({
  selector: '[appTableCell]',
  standalone: true,
})
export class TableCellDirective {
  readonly appTableCell = input.required<string>();
  constructor(public readonly templateRef: TemplateRef<TableCellContext>) {}
}

export interface TableCellContext {
  $implicit: unknown;
  row: unknown;
}
