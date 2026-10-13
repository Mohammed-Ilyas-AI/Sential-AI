import { ChangeDetectionStrategy, Component, afterNextRender, computed, inject, signal, viewChild, type ElementRef } from '@angular/core';
import { Router } from '@angular/router';
import { Store } from '@ngrx/store';
import { Icon } from '../../shared/ui/icon/icon';
import { AlertsActions } from '../../state/alerts/alerts.actions';
import { transactionsFeature } from '../../state/transactions/transactions.feature';
import { ShellState } from '../shell/shell-state';
import { matchingStaticCommands, recordCommands, type PaletteCommand } from './palette-commands';

/** Ctrl+K: jump to an account, a transaction or a workspace in two keystrokes. */
@Component({
  selector: 'sentinel-command-palette',
  imports: [Icon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="palette sentinel-panel sentinel-panel--elevated" role="dialog" aria-modal="true" aria-label="Command palette">
      <div class="field">
        <sentinel-icon name="search" [size]="18" />
        <input
          #queryInput
          type="text"
          role="combobox"
          aria-expanded="true"
          aria-controls="palette-results"
          aria-autocomplete="list"
          [attr.aria-activedescendant]="activeId()"
          placeholder="Search accounts, transactions, alerts…"
          [value]="query()"
          (input)="onInput($event)"
          (keydown)="onKeydown($event)"
        />
        <kbd class="sentinel-kbd">Esc</kbd>
      </div>
      <ul id="palette-results" role="listbox" class="sentinel-scroll" aria-label="Commands">
        @for (command of results(); track command.id; let index = $index) {
          @if (index === 0 || results()[index - 1]?.group !== command.group) {
            <li class="group" role="presentation">{{ command.group }}</li>
          }
          <li
            [id]="'palette-' + command.id"
            role="option"
            tabindex="-1"
            [attr.aria-selected]="index === activeIndex()"
            [class.active]="index === activeIndex()"
            (mousemove)="activeIndex.set(index)"
            (click)="run(command)"
            (keydown.enter)="run(command)"
          >
            <sentinel-icon [name]="command.icon" [size]="18" />
            <span class="label" [class.sentinel-mono]="command.group !== 'Navigate' && command.group !== 'Workspace'">{{ command.label }}</span>
            @if (command.hint) {
              <span class="hint">{{ command.hint }}</span>
            }
          </li>
        } @empty {
          <li class="empty" role="presentation">No matching account, transaction or command on this tape.</li>
        }
      </ul>
      <footer>
        <span><kbd class="sentinel-kbd">↑</kbd><kbd class="sentinel-kbd">↓</kbd> move</span>
        <span><kbd class="sentinel-kbd">Enter</kbd> open</span>
        <span class="scope">Searches the live tape in this session</span>
      </footer>
    </div>
  `,
  styleUrl: './command-palette.css',
})
export class CommandPalette {
  private readonly shell = inject(ShellState);
  private readonly router = inject(Router);
  private readonly store = inject(Store);
  private readonly tape = this.store.selectSignal(transactionsFeature.selectTape);
  private readonly input = viewChild.required<ElementRef<HTMLInputElement>>('queryInput');

  protected readonly query = signal('');
  protected readonly activeIndex = signal(0);
  protected readonly results = computed(() => [...recordCommands(this.query(), this.tape()), ...matchingStaticCommands(this.query())]);
  protected readonly activeId = computed(() => {
    const command = this.results()[this.activeIndex()];
    return command ? `palette-${command.id}` : null;
  });

  constructor() {
    afterNextRender(() => this.input().nativeElement.focus());
  }

  protected onInput(event: Event): void {
    this.query.set((event.target as HTMLInputElement).value);
    this.activeIndex.set(0);
  }

  protected onKeydown(event: KeyboardEvent): void {
    const count = this.results().length;
    if (event.key === 'ArrowDown' && count > 0) {
      event.preventDefault();
      this.activeIndex.update((index) => (index + 1) % count);
    } else if (event.key === 'ArrowUp' && count > 0) {
      event.preventDefault();
      this.activeIndex.update((index) => (index - 1 + count) % count);
    } else if (event.key === 'Enter') {
      const command = this.results()[this.activeIndex()];
      if (command) this.run(command);
    }
  }

  protected run(command: PaletteCommand): void {
    this.shell.close();
    const { action } = command;
    switch (action.kind) {
      case 'navigate':
        void this.router.navigateByUrl(action.route);
        break;
      case 'focus-account':
        this.store.dispatch(AlertsActions.accountSelected({ accountId: action.accountId }));
        void this.router.navigateByUrl('/control-tower');
        break;
      case 'open-settings':
        this.shell.open('settings');
        break;
      case 'toggle-sidebar':
        this.shell.toggleSidebar();
        break;
      case 'toggle-focus-mode':
        this.shell.toggleFocusMode();
        break;
    }
  }
}
