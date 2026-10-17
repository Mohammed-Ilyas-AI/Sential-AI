import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, input, output, signal } from '@angular/core';
import type { CaseSignOff } from '../../models/case-list-item';

const DISPOSITIONS = [
  { id: 'ESCALATE', label: 'Escalate to fraud investigations' },
  { id: 'MONITOR', label: 'Keep open and monitor' },
  { id: 'CLOSE_LEGITIMATE', label: 'Close: customer activity confirmed legitimate' },
] as const;

/** Humans authorize: the analyst attests to the report. A sign-off never releases a hold. */
@Component({
  selector: 'sentinel-sign-off',
  imports: [DatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (signed(); as signed) {
      <p class="done">Signed by <b>{{ signed.analystIdentity }}</b> at {{ signed.signedAt | date: 'dd MMM HH:mm:ss' : 'UTC' }} UTC · {{ signed.disposition }}</p>
      @if (signed.note) {
        <p class="sentinel-muted">{{ signed.note }}</p>
      }
    } @else {
      <fieldset>
        <legend class="sentinel-muted">Disposition</legend>
        @for (option of dispositions; track option.id) {
          <label><input type="radio" name="disposition" [checked]="disposition() === option.id" (change)="disposition.set(option.id)" /> {{ option.label }}</label>
        }
      </fieldset>
      <textarea rows="2" placeholder="Analyst note (optional)" aria-label="Analyst note" (input)="note.set($any($event.target).value)"></textarea>
      <label class="attest"><input type="checkbox" (change)="attested.set($any($event.target).checked)" /> I have reviewed the recorded facts and the advisory summary.</label>
      <button type="button" class="sentinel-button" [disabled]="!attested() || !analystIdentity()" (click)="sign.emit({ disposition: disposition(), note: note() })">
        Sign as {{ analystIdentity() ?? '—' }}
      </button>
    }
    <p class="sentinel-muted small">A sign-off records the analyst's determination for this session; it never releases a hold. The case store is designed and not yet built.</p>
  `,
  styles: `
    fieldset { display: grid; gap: var(--sentinel-space-1); margin: 0 0 var(--sentinel-space-2); padding: 0; border: 0; font-size: var(--sentinel-font-size-caption); }
    label { display: flex; gap: var(--sentinel-space-2); align-items: center; font-size: var(--sentinel-font-size-caption); }
    textarea { width: 100%; margin-bottom: var(--sentinel-space-2); padding: var(--sentinel-space-2); border: 1px solid var(--sentinel-color-border); border-radius: var(--sentinel-radius-small); background: var(--sentinel-color-surface); color: var(--sentinel-color-text); font: inherit; font-size: var(--sentinel-font-size-caption); box-sizing: border-box; }
    .attest { margin-bottom: var(--sentinel-space-2); }
    .done { margin: 0; color: var(--sentinel-color-success); font-size: var(--sentinel-font-size-caption); }
    .small { margin: var(--sentinel-space-2) 0 0; font-size: var(--sentinel-font-size-micro); }
  `,
})
export class SignOff {
  readonly signed = input<CaseSignOff | null>(null);
  readonly analystIdentity = input<string | null>(null);
  readonly sign = output<{ readonly disposition: CaseSignOff['disposition']; readonly note: string }>();
  protected readonly dispositions = DISPOSITIONS;
  protected readonly disposition = signal<CaseSignOff['disposition']>('ESCALATE');
  protected readonly note = signal('');
  protected readonly attested = signal(false);
}
