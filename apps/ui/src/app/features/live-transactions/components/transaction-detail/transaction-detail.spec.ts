import { TestBed } from '@angular/core/testing';
import { DEFAULT_RAPID_DRAIN_POLICY } from '@sentinel/domain';
import { describe, expect, it } from 'vitest';
import { demoFinalDecision } from '../../../../../testing/ui-fixtures';
import { processTransactionBatch } from '../../../../workers/transaction-batch.processor';
import { TransactionDetail } from './transaction-detail';

describe('TransactionDetail', () => {
  async function render() {
    await TestBed.configureTestingModule({ imports: [TransactionDetail] }).compileComponents();
    const fixture = TestBed.createComponent(TransactionDetail);
    const decision = demoFinalDecision();
    const [row] = processTransactionBatch([decision]).rows;
    fixture.componentRef.setInput('row', row);
    fixture.componentRef.setInput('status', 'HELD');
    await fixture.whenStable();
    return { fixture, decision, host: fixture.nativeElement as HTMLElement };
  }
  const text = (element: Element | null) => (element?.textContent ?? '').replace(/\s+/g, ' ').trim();

  it('shows the gate’s own decision, rule, versions and drain arithmetic for the transaction', async () => {
    const { host, decision } = await render();
    const box = text(host.querySelector('.decision-box'));
    expect(box).toContain('Deterministic decision · rules engine');
    expect(box).toContain('HOLD');
    for (const code of decision.reasonCodes) expect(box).toContain(code);
    expect(box).toContain(`Policy ${decision.policyVersion}`);
    const drain = text(host.querySelector('.drain'));
    expect(drain).toContain(`${decision.assessment.drain.drainPct.toFixed(1)}%`);
    expect(drain).toContain(`threshold ${DEFAULT_RAPID_DRAIN_POLICY.gatePercent}%`);
    expect(text(host.querySelector('.facts'))).toContain('Held');
  });

  it('asks to open the investigation for the transaction’s account', async () => {
    const { fixture, host, decision } = await render();
    const opened: string[] = [];
    fixture.componentInstance.investigate.subscribe((accountId) => opened.push(accountId));
    (host.querySelector('button.primary') as HTMLButtonElement).click();
    expect(opened).toEqual([decision.accountId]);
  });
});
