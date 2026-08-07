import { Component, computed, contentChildren, input } from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { TableCellDirective } from './table-cell.directive';

export interface TableColumn<T = unknown> {
  key: string;
  label: string;
  sortable?: boolean;
  class?: string;
}

@Component({
  selector: 'app-table',
  standalone: true,
  imports: [NgTemplateOutlet],
  template: `
    <div class="overflow-x-auto">
      <table class="w-full min-w-[560px] border-collapse text-sm">
        <thead>
          <tr class="border-b-2 border-ink">
            @for (col of columns(); track col.key) {
              <th
                class="whitespace-nowrap px-4 py-3 text-left text-[11px] font-bold uppercase tracking-wider text-ink-faint"
                [class]="col.class"
              >
                {{ col.label }}
              </th>
            }
          </tr>
        </thead>
        <tbody>
          @for (row of rows(); track rowKey()(row)) {
            <tr class="border-b border-ink/10 last:border-0 transition-colors hover:bg-primary/10">
              @for (col of columns(); track col.key) {
                <td class="whitespace-nowrap px-4 py-3 align-middle font-medium text-ink" [class]="col.class">
                  @if (cellMap().get(col.key); as tpl) {
                    <ng-container
                      [ngTemplateOutlet]="tpl.templateRef"
                      [ngTemplateOutletContext]="{
                        $implicit: field(row, col.key),
                        row: row,
                      }"
                    ></ng-container>
                  } @else {
                    {{ field(row, col.key) }}
                  }
                </td>
              }
            </tr>
          } @empty {
            <tr>
              <td [attr.colspan]="columns().length" class="px-4 py-10 text-center">
                <ng-content select="[empty]"></ng-content>
              </td>
            </tr>
          }
        </tbody>
      </table>
    </div>
  `,
})
export class TableComponent<T = unknown> {
  readonly columns = input.required<TableColumn<T>[]>();
  readonly rows = input.required<T[]>();
  readonly rowKey = input<(row: T) => string>((row) =>
    String((row as { _id?: string })._id ?? (row as { id?: string }).id)
  );

  protected readonly cellTemplates = contentChildren(TableCellDirective);

  protected readonly cellMap = computed(() => {
    const map = new Map<string, TableCellDirective>();
    for (const tpl of this.cellTemplates()) {
      map.set(tpl.appTableCell(), tpl);
    }
    return map;
  });

  protected field(row: unknown, key: string): unknown {
    const obj = row as Record<string, unknown>;
    const value = obj[key];
    if (typeof value === 'object' && value !== null) {
      return (value as Record<string, unknown>)['name'] ?? value;
    }
    return value;
  }
}
