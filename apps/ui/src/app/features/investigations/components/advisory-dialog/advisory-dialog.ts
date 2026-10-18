import { ChangeDetectionStrategy, Component, DestroyRef, ElementRef, afterNextRender, computed, inject, input, output, viewChild } from '@angular/core';
import type { CaseSummary, DecisionRecord, RiskExplanation } from '@sentinel/domain';
import { Icon } from '../../../../shared/ui/icon/icon';
import type { AdvisoryState } from '../../models/investigation-view';
import { AdvisoryLoader } from '../advisory-loader/advisory-loader';
import { FALLBACK_REASON } from '../gemini-advisory/gemini-advisory';

export type AdvisoryKind = 'EXPLAIN' | 'SUMMARY';

/**
 * Gemini's advisory at reading size. Opens the moment Explain or Summarise is pressed, shows the loader until the
 * real answer (or an honest fallback) arrives, and keeps the deterministic decision in view as a separate,
 * unchanged fact. Closing it never cancels the request; the inline card keeps the result.
 */
@Component({
  selector: 'sentinel-advisory-dialog',
  imports: [Icon, AdvisoryLoader],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '(document:keydown.escape)': 'closed.emit()' },
  templateUrl: './advisory-dialog.html',
  styleUrl: './advisory-dialog.css',
})
export class AdvisoryDialog {
  readonly kind = input.required<AdvisoryKind>();
  readonly explanation = input.required<AdvisoryState<RiskExplanation>>();
  readonly summary = input.required<AdvisoryState<CaseSummary>>();
  readonly decision = input.required<DecisionRecord>();
  readonly closed = output<void>();
  readonly retry = output<AdvisoryKind>();

  protected readonly fallbackReason = FALLBACK_REASON;
  private readonly closeButton = viewChild.required<ElementRef<HTMLButtonElement>>('closeButton');

  protected readonly title = computed(() => (this.kind() === 'EXPLAIN' ? 'Score explanation' : 'Case summary'));
  protected readonly tier = computed(() => (this.kind() === 'EXPLAIN' ? 'fast tier' : 'deep tier'));
  protected readonly state = computed<AdvisoryState<RiskExplanation | CaseSummary>>(() =>
    this.kind() === 'EXPLAIN' ? this.explanation() : this.summary(),
  );
  protected readonly explained = computed(() => {
    const outcome = this.explanation().outcome;
    return outcome && outcome.status !== 'FALLBACK' ? outcome : null;
  });
  protected readonly summarised = computed(() => {
    const outcome = this.summary().outcome;
    return outcome && outcome.status !== 'FALLBACK' ? outcome : null;
  });

  constructor() {
    // Focus moves into the dialog, and back to whatever opened it when the dialog goes away.
    const opener = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement.ownerDocument.activeElement as HTMLElement | null;
    afterNextRender(() => this.closeButton().nativeElement.focus());
    inject(DestroyRef).onDestroy(() => opener?.focus());
  }
}
