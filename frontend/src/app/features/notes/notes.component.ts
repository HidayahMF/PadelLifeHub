import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NgIf } from '@angular/common';
import { ButtonComponent } from '../../layout/components/button.component';
import { IconComponent } from '../../layout/components/icon.component';
import { ModalComponent } from '../../layout/components/modal.component';
import { FieldComponent } from '../../layout/components/field.component';
import { TextareaComponent } from './components/textarea.component';
import { NoteService } from '../../core/services/data.service';
import { ToastService } from '../../core/services/toast.service';
import type { Note } from '../../core/models/misc.model';
import { formatDateTime, toDate } from '../../core/utils/format';

@Component({
  selector: 'app-notes',
  standalone: true,
  imports: [
    FormsModule,
    NgIf,
    ButtonComponent,
    IconComponent,
    ModalComponent,
    FieldComponent,
    TextareaComponent,
  ],
  template: `
    <div class="mb-6 flex flex-wrap items-center justify-between gap-4">
      <div>
        <h1 class="text-2xl font-bold tracking-tight text-ink">Notes</h1>
        <p class="mt-1 text-sm text-ink-soft">Capture ideas before they slip away.</p>
      </div>
      <div class="flex items-center gap-2">
        <div class="relative">
          <app-icon name="search" [size]="16" class="pointer-events-none absolute top-1/2 -translate-y-1/2"
            [style.left.px]="10" [style.color]="'var(--color-ink-faint)'" />
          <input type="text" name="search" [value]="search()" (input)="search.set($any($event.target).value)"
            placeholder="Search notes…"
            class="h-10 w-56 rounded-field border border-line bg-surface pl-9 pr-3 text-sm text-ink placeholder:text-ink-faint focus:border-primary focus:outline-none" />
        </div>
        <app-button icon="plus" (click)="openCreate()">New note</app-button>
      </div>
    </div>

    @if (loading()) {
      <div class="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
        @for (_ of [1, 2, 3, 4, 5, 6]; track $index) {
          <div class="h-40 animate-pulse rounded-card bg-surface-2"></div>
        }
      </div>
    } @else if (filteredNotes().length === 0) {
      <div class="rounded-card border border-line bg-surface px-6 py-16 text-center">
        <app-icon name="sticky-note" [size]="36" [strokeWidth]="1.5" class="mx-auto text-ink-faint" />
        <p class="mt-3 text-sm font-semibold text-ink">No notes found</p>
        <p class="mt-1 text-sm text-ink-soft">Write something down to get started.</p>
      </div>
    } @else {
      <div class="columns-1 gap-4 sm:columns-2 xl:columns-3 [&>*]:mb-4">
        @for (note of filteredNotes(); track note._id) {
          <button
            (click)="openEdit(note)"
            class="group block w-full break-inside-avoid rounded-card border border-line bg-surface p-5 text-left shadow-card transition-all duration-150 hover:shadow-pop"
            [class.bg-primary/5]="note.pinned"
          >
            <div class="flex items-start justify-between gap-2">
              <h3 class="text-base font-semibold text-ink">{{ note.title || 'Untitled' }}</h3>
              <app-icon *ngIf="note.pinned" name="pin" [size]="16" class="mt-1 shrink-0 text-primary-strong" />
            </div>
            @if (note.content) {
              <p class="mt-2 line-clamp-6 break-words whitespace-pre-wrap text-sm text-ink-soft">{{ note.content }}</p>
            }
            <div class="mt-4 flex items-center justify-between border-t border-line pt-3">
              <span class="text-xs text-ink-faint">{{ formatDateTime(note.updatedAt) }}</span>
              <span class="flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                <app-button size="icon" variant="ghost" icon="pencil"
                  [attr.aria-label]="'Edit note'"
                  (click)="openEdit(note); $event.stopPropagation()"></app-button>
                <app-button size="icon" variant="ghost" icon="pin"
                  [attr.aria-label]="note.pinned ? 'Unpin note' : 'Pin note'"
                  (click)="togglePin(note); $event.stopPropagation()"></app-button>
                <app-button size="icon" variant="ghost" icon="trash-2"
                  [attr.aria-label]="'Delete note'"
                  (click)="remove(note); $event.stopPropagation()"></app-button>
              </span>
            </div>
          </button>
        }
      </div>
    }

    <app-modal
      [open]="modalOpen()"
      [title]="editing() ? 'Edit note' : 'New note'"
      (closed)="modalOpen.set(false)"
    >
      <form (ngSubmit)="save()" class="space-y-4">
        <app-field label="Title" placeholder="Note title" [(ngModel)]="form.title" name="title" />
        <app-textarea label="Content" placeholder="Start writing…" [rows]="6"
          [(ngModel)]="form.content" name="content" />
        <div class="flex justify-end gap-2 pt-2">
          <app-button type="button" variant="secondary" (click)="modalOpen.set(false)">Cancel</app-button>
          <app-button type="submit" [loading]="saving()">Save note</app-button>
        </div>
      </form>
    </app-modal>
  `,
})
export class NotesComponent implements OnInit {
  private service = inject(NoteService);
  private toast = inject(ToastService);

  protected readonly notes = this.service.notes;
  protected readonly loading = this.service.loading;

  protected readonly search = signal('');
  protected readonly modalOpen = signal(false);
  protected readonly editing = signal<Note | null>(null);
  protected readonly saving = signal(false);

  protected form: Partial<Note> = {};

  protected readonly filteredNotes = computed(() => {
    const q = this.search().toLowerCase().trim();
    const sorted = [...this.notes()].sort((a, b) => {
      if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
      return toDate(b.updatedAt).getTime() - toDate(a.updatedAt).getTime();
    });
    if (!q) return sorted;
    return sorted.filter(
      (n) => n.title.toLowerCase().includes(q) || (n.content ?? '').toLowerCase().includes(q)
    );
  });

  ngOnInit(): void {
    this.service.load();
  }

  protected openCreate(): void {
    this.editing.set(null);
    this.form = { title: '', content: '', pinned: false };
    this.modalOpen.set(true);
  }

  protected openEdit(note: Note): void {
    this.editing.set(note);
    this.form = { title: note.title, content: note.content, pinned: note.pinned };
    this.modalOpen.set(true);
  }

  protected save(): void {
    const payload: Partial<Note> = {
      title: this.form.title?.trim() || 'Untitled',
      content: this.form.content ?? '',
      pinned: this.form.pinned ?? false,
    };
    this.saving.set(true);
    const obs = this.editing()
      ? this.service.update(this.editing()!._id, payload)
      : this.service.create(payload);
    obs.subscribe({
      next: () => {
        this.saving.set(false);
        this.toast.success(this.editing() ? 'Note saved' : 'Note created');
        this.modalOpen.set(false);
        this.service.load();
      },
      error: (err: Error) => {
        this.saving.set(false);
        this.toast.error(err.message);
      },
    });
  }

  protected togglePin(note: Note): void {
    this.service.update(note._id, { pinned: !note.pinned }).subscribe({
      next: () => {
        this.toast.info(note.pinned ? 'Note unpinned' : 'Note pinned');
        this.service.load();
      },
      error: (err: Error) => this.toast.error(err.message),
    });
  }

  protected remove(note: Note): void {
    if (!confirm('Delete this note?')) return;
    this.service.remove(note._id).subscribe({
      next: () => {
        this.toast.success('Note deleted');
        this.service.load();
      },
      error: (err: Error) => this.toast.error(err.message),
    });
  }

  protected readonly formatDateTime = formatDateTime;
}
