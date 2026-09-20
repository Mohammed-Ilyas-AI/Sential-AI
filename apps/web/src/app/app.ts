import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';

@Component({
  selector: 'sn-root',
  imports: [RouterOutlet],
  template: `
    <header>
      <strong>SENTINEL AI</strong>
      <span>fraud operations control tower</span>
    </header>
    <main><router-outlet /></main>
  `,
  styles: `
    header {
      display: flex;
      align-items: baseline;
      gap: 0.75rem;
      padding: 0.9rem 1.25rem;
      border-bottom: 1px solid var(--sn-border);
    }
    header span { color: var(--sn-muted); font-size: 0.85rem; }
    main { padding: 1.25rem; }
  `,
})
export class App {}
