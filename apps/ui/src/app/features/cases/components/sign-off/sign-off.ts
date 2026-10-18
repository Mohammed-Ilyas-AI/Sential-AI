import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { CasesFacade } from '../../data-access/cases-facade';

/** Gemini drafts, the analyst signs off. The sign-off records the analyst identity. */
@Component({
  selector: 'sentinel-sign-off',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="actions surface" aria-labelledby="signoff-title">
      <h2 id="signoff-title">Analyst actions</h2>
      <label>
        <span>Analyst identity</span>
        <input
          type="text"
          autocomplete="off"
          maxlength="120"
          placeholder="Enter your recorded analyst identity"
          [value]="facade.analystIdentity()"
          (input)="facade.analystIdentity.set($any($event.target).value)"
        />
      </label>
      @if (facade.loading()) {
        <p role="status">Loading cases…</p>
      }
      @if (facade.busy()) {
        <p role="status">Saving…</p>
      }
      @if (facade.error()) {
        <p class="error" role="alert">{{ facade.error() }}</p>
      }
      @if (facade.notice()) {
        <p class="notice" role="status">{{ facade.notice() }}</p>
      }
      @if (facade.report()?.latest; as report) {
        @if (report.status === 'DRAFT') {
          <button type="button" [disabled]="facade.busy() || !facade.hasEdits()" (click)="facade.saveDraft()">Save draft edits</button>
          <button type="button" class="primary" [disabled]="facade.busy() || !facade.canSignOff()" (click)="facade.signOff()">Sign off immutable version</button>
          @if (facade.hasEdits()) {
            <p class="hint">Save all edits before signing off.</p>
          } @else if (!facade.canSignOff()) {
            <p class="hint">Complete the analyst recommendation and every report section before sign-off.</p>
          }
        } @else {
          <p class="notice">Signed off {{ report.signedOffAt | date: 'd MMM y, HH:mm' : 'UTC' }} UTC by {{ report.signedOffBy }}.</p>
          <button type="button" [disabled]="facade.busy()" (click)="facade.startRevision()">Start a new revision</button>
        }
        <button type="button" [disabled]="facade.busy()" (click)="facade.exportReport()">Export saved version</button>
      }
    </section>
  `,
  imports: [DatePipe],
  styles: [`
    :host { display: block; min-width: 0; }
    .actions { display: grid; align-content: start; gap: 10px; padding: 16px; border: 1px solid var(--sentinel-surface-panel-border); border-radius: 12px; background: var(--sentinel-color-surface); }
    h2 { margin: 0; font-size: 1rem; }
    label { display: grid; gap: 5px; font-size: .75rem; }
    input, button { min-height: 36px; padding: 0 10px; border: 1px solid var(--sentinel-surface-panel-border); border-radius: 8px; background: var(--sentinel-color-background); color: var(--sentinel-color-text); font: inherit; }
    button { background: transparent; font-size: .75rem; font-weight: 700; cursor: pointer; }
    button:disabled { opacity: .5; cursor: not-allowed; }
    button.primary { border-color: var(--sentinel-color-accent); background: var(--sentinel-color-accent); color: var(--sentinel-color-accent-text, white); }
    p { margin: 0; font-size: .75rem; }
    .hint { color: var(--sentinel-color-text-secondary); }
    .error { color: var(--sentinel-color-critical); }
    .notice { color: var(--sentinel-color-success); }
  `],
})
export class SignOff {
  protected readonly facade = inject(CasesFacade);
}
