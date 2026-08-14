import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NgIf } from '@angular/common';
import { ButtonComponent } from '../../layout/components/button.component';
import { IconComponent } from '../../layout/components/icon.component';
import { ModalComponent } from '../../layout/components/modal.component';
import { FieldComponent } from '../../layout/components/field.component';
import { TextareaComponent } from './components/textarea.component';
import { SegmentedComponent } from '../../layout/components/segmented.component';
import { NoteService } from '../../core/services/data.service';
import { ToastService } from '../../core/services/toast.service';
import { I18nService } from '../../core/services/i18n.service';
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
    SegmentedComponent,
  ],
  template: `
    <div class="mb-6 flex flex-wrap items-center justify-between gap-4">
      <div>
        <h1 class="text-2xl font-bold tracking-tight text-ink">{{ t('Notes') }}</h1>
        <p class="mt-1 text-sm text-ink-soft">{{ t('Capture ideas before they slip away.') }}</p>
      </div>
      <div class="flex items-center gap-2">
        <app-segmented [options]="viewOptions()" [model]="view()" (change)="setView($event)" />
        <div class="relative">
          <app-icon name="search" [size]="16" class="pointer-events-none absolute top-1/2 -translate-y-1/2"
            [style.left.px]="10" [style.color]="'var(--color-ink-faint)'" />
          <input type="text" name="search" [value]="search()" (input)="search.set($any($event.target).value)"
            [placeholder]="t('Search notes…')"
            class="h-10 w-56 rounded-field border border-line bg-surface pl-9 pr-3 text-sm text-ink placeholder:text-ink-faint focus:border-primary focus:outline-none" />
        </div>
        @if (view() === 'active') {
          <app-button icon="plus" (click)="openCreate()">{{ t('New note') }}</app-button>
        }
      </div>
    </div>

    @if (allTags().length > 0 && view() !== 'trash') {
      <div class="mb-4 flex flex-wrap items-center gap-1.5">
        <button
          (click)="tagFilter.set('')"
          class="rounded-md border-2 border-ink px-2 py-0.5 text-xs font-bold transition-colors"
          [class]="tagFilter() === '' ? 'bg-primary text-ink' : 'bg-surface text-ink-soft hover:text-ink'"
        >
          {{ t('All') }}
        </button>
        @for (tag of allTags(); track tag) {
          <button
            (click)="tagFilter.set(tagFilter() === tag ? '' : tag)"
            class="rounded-md border-2 border-ink px-2 py-0.5 text-xs font-bold transition-colors"
            [class]="tagFilter() === tag ? 'bg-primary text-ink' : 'bg-surface text-ink-soft hover:text-ink'"
          >
            #{{ tag }}
          </button>
        }
      </div>
    }

    @if (loading()) {
      <div class="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
        @for (_ of [1, 2, 3, 4, 5, 6]; track $index) {
          <div class="h-40 animate-pulse rounded-card bg-surface-2"></div>
        }
      </div>
    } @else if (filteredNotes().length === 0) {
      <div class="rounded-card border border-line bg-surface px-6 py-16 text-center">
        <app-icon name="sticky-note" [size]="36" [strokeWidth]="1.5" class="mx-auto text-ink-faint" />
        <p class="mt-3 text-sm font-semibold text-ink">{{ t('No notes found') }}</p>
        <p class="mt-1 text-sm text-ink-soft">{{ t('Write something down to get started.') }}</p>
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
              <h3 class="text-base font-semibold text-ink">{{ note.title || t('Untitled') }}</h3>
              <app-icon *ngIf="note.pinned" name="pin" [size]="16" class="mt-1 shrink-0 text-primary-strong" />
            </div>
            @if (note.content) {
              <p class="mt-2 line-clamp-6 break-words whitespace-pre-wrap text-sm text-ink-soft">{{ note.content }}</p>
            }
            @if (note.tags?.length) {
              <div class="mt-2.5 flex flex-wrap gap-1">
                @for (tag of note.tags; track tag) {
                  <span class="rounded-md border border-line bg-surface-2 px-1.5 py-0.5 text-[10px] font-bold text-ink-soft">#{{ tag }}</span>
                }
              </div>
            }
            <div class="mt-4 flex items-center justify-between border-t border-line pt-3">
              <span class="text-xs text-ink-faint">{{ formatDateTime(note.updatedAt) }}</span>
              <span class="flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                @if (view() === 'active') {
                  <app-button size="icon" variant="ghost" icon="pencil"
                    [attr.aria-label]="t('Edit note')"
                    (click)="openEdit(note); $event.stopPropagation()"></app-button>
                  <app-button size="icon" variant="ghost" icon="pin"
                    [attr.aria-label]="note.pinned ? t('Unpin note') : t('Pin note')"
                    (click)="togglePin(note); $event.stopPropagation()"></app-button>
                  <app-button size="icon" variant="ghost" icon="archive"
                    [attr.aria-label]="t('Archive note')"
                    (click)="setFlag(note, { archived: true }); $event.stopPropagation()"></app-button>
                  <app-button size="icon" variant="ghost" icon="trash-2"
                    [attr.aria-label]="t('Move to trash')"
                    (click)="setFlag(note, { trashed: true, archived: false }); $event.stopPropagation()"></app-button>
                } @else if (view() === 'archived') {
                  <app-button size="icon" variant="ghost" icon="rotate-ccw"
                    [attr.aria-label]="t('Restore note')"
                    (click)="setFlag(note, { archived: false }); $event.stopPropagation()"></app-button>
                  <app-button size="icon" variant="ghost" icon="trash-2"
                    [attr.aria-label]="t('Move to trash')"
                    (click)="setFlag(note, { trashed: true, archived: false }); $event.stopPropagation()"></app-button>
                } @else {
                  <app-button size="icon" variant="ghost" icon="rotate-ccw"
                    [attr.aria-label]="t('Restore note')"
                    (click)="setFlag(note, { trashed: false }); $event.stopPropagation()"></app-button>
                  <app-button size="icon" variant="danger" icon="trash-2"
                    [attr.aria-label]="t('Delete permanently')"
                    (click)="remove(note); $event.stopPropagation()"></app-button>
                }
              </span>
            </div>
          </button>
        }
      </div>
    }

    <app-modal
      [open]="modalOpen()"
      [title]="editing() ? t('Edit note') : t('New note')"
      (closed)="modalOpen.set(false)"
    >
      <form (ngSubmit)="save()" class="space-y-4">
        <app-field [label]="t('Title')" [placeholder]="t('Note title')" [(ngModel)]="form.title" name="title" />
        <app-textarea [label]="t('Content')" [placeholder]="t('Start writing…')" [rows]="6"
          [(ngModel)]="form.content" name="content" />
        <app-field
          [label]="t('Tags')"
          [placeholder]="t('work, personal, ideas… (comma separated)')"
          [(ngModel)]="tagsText"
          name="tags"
        />
        <div class="flex justify-end gap-2 pt-2">
          <app-button type="button" variant="secondary" (click)="modalOpen.set(false)">{{ t('Cancel') }}</app-button>
          <app-button type="submit" [loading]="saving()">{{ t('Save note') }}</app-button>
        </div>
      </form>
    </app-modal>
  `,
})
export class NotesComponent implements OnInit {
  private service = inject(NoteService);
  private toast = inject(ToastService);
  private i18n = inject(I18nService);

  protected readonly t = this.i18n.t.bind(this.i18n);

  protected readonly notes = this.service.notes;
  protected readonly loading = this.service.loading;

  protected readonly search = signal('');
  protected readonly tagFilter = signal('');
  protected readonly view = signal<'active' | 'archived' | 'trash'>('active');
  protected readonly modalOpen = signal(false);
  protected readonly editing = signal<Note | null>(null);
  protected readonly saving = signal(false);

  protected form: Partial<Note> = {};
  protected tagsText = '';

  protected readonly viewOptions = computed(() => [
    { value: 'active', label: this.t('Active') },
    { value: 'archived', label: this.t('Archived') },
    { value: 'trash', label: this.t('Trash') },
  ]);

  protected readonly allTags = computed(() =>
    [...new Set(this.notes().flatMap((n) => n.tags ?? []))].sort()
  );

  protected readonly filteredNotes = computed(() => {
    const q = this.search().toLowerCase().trim();
    const tag = this.tagFilter();
    const sorted = [...this.notes()].sort((a, b) => {
      if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
      return toDate(b.updatedAt).getTime() - toDate(a.updatedAt).getTime();
    });
    return sorted.filter((n) => {
      if (tag && !(n.tags ?? []).includes(tag)) return false;
      if (!q) return true;
      return n.title.toLowerCase().includes(q) || (n.content ?? '').toLowerCase().includes(q);
    });
  });

  ngOnInit(): void {
    this.reload();
  }

  protected setView(value: string): void {
    this.view.set(value as 'active' | 'archived' | 'trash');
    this.tagFilter.set('');
    this.reload();
  }

  private reload(): void {
    const params: Record<string, string> = {};
    if (this.view() === 'archived') params['archived'] = 'true';
    if (this.view() === 'trash') params['trashed'] = 'true';
    this.service.load(params);
  }

  protected openCreate(): void {
    this.editing.set(null);
    this.form = { title: '', content: '', pinned: false };
    this.tagsText = '';
    this.modalOpen.set(true);
  }

  protected openEdit(note: Note): void {
    this.editing.set(note);
    this.form = { title: note.title, content: note.content, pinned: note.pinned };
    this.tagsText = (note.tags ?? []).join(', ');
    this.modalOpen.set(true);
  }

  protected save(): void {
    const payload: Partial<Note> = {
      title: this.form.title?.trim() || this.t('Untitled'),
      content: this.form.content ?? '',
      pinned: this.form.pinned ?? false,
      tags: this.parseTags(this.tagsText),
    };
    this.saving.set(true);
    const obs = this.editing()
      ? this.service.update(this.editing()!._id, payload)
      : this.service.create(payload);
    obs.subscribe({
      next: () => {
        this.saving.set(false);
        this.toast.success(this.editing() ? this.t('Note saved') : this.t('Note created'));
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
        this.toast.info(note.pinned ? this.t('Note unpinned') : this.t('Note pinned'));
        this.service.load();
      },
      error: (err: Error) => this.toast.error(err.message),
    });
  }

  protected setFlag(note: Note, flags: Partial<Note>): void {
    this.service.update(note._id, flags).subscribe({
      next: () => {
        this.toast.success(flags.trashed ? this.t('Moved to trash') : flags.archived ? this.t('Note archived') : this.t('Note restored'));
        this.reload();
      },
      error: (err: Error) => this.toast.error(err.message),
    });
  }

  protected remove(note: Note): void {
    if (!confirm(this.t('Permanently delete "{title}"? This cannot be undone.', { title: note.title || this.t('Untitled') }))) return;
    this.service.remove(note._id).subscribe({
      next: () => {
        this.toast.success(this.t('Note deleted permanently'));
        this.reload();
      },
      error: (err: Error) => this.toast.error(err.message),
    });
  }

  protected parseTags(text: string): string[] {
    return [...new Set(text.split(',').map((t) => t.trim().toLowerCase()).filter(Boolean))].slice(0, 10);
  }

  protected readonly formatDateTime = formatDateTime;
}
