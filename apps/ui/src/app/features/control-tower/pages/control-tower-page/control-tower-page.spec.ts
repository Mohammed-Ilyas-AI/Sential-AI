import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';
import { ControlTowerPage } from './control-tower-page';

describe('ControlTowerPage', () => {
  it('composes the tape, alert queue, right rail and intervention panel from their owning features', async () => {
    await TestBed.configureTestingModule({ imports: [ControlTowerPage] }).compileComponents();
    const fixture = TestBed.createComponent(ControlTowerPage);
    await fixture.whenStable();
    const host = fixture.nativeElement as HTMLElement;
    for (const selector of [
      'sentinel-live-metrics',
      'sentinel-transaction-tape',
      'sentinel-alert-queue',
      'sentinel-account-risk-panel',
      'sentinel-policy-hold',
      'sentinel-customer-notification',
    ]) {
      expect(host.querySelector(selector), selector).not.toBeNull();
    }
  });
});
