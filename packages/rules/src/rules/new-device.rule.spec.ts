import { describe, expect, it } from 'vitest';
import { accountFixture, transactionFixture, windowFixture } from '../testing/risk-inputs.fixture.js';
import { newDeviceRule } from './new-device.rule.js';

const pointsAt = (deviceAgeHours: number | null): number | undefined =>
  newDeviceRule.evaluate(transactionFixture(), accountFixture(), windowFixture({ features: { deviceAgeHours } }))?.points;

describe('NEW_DEVICE rule', () => {
  it('declares its code and the documented maximum of 21 points', () => {
    expect(newDeviceRule.code).toBe('NEW_DEVICE');
    expect(newDeviceRule.maxPoints).toBe(21);
  });

  it('scores 21 when the device was first seen under 24 hours ago', () => {
    expect(pointsAt(0)).toBe(21);
    expect(pointsAt(0.07)).toBe(21);
    expect(pointsAt(23.99)).toBe(21);
  });

  it('scores nothing at 24 hours or for an established device', () => {
    expect(pointsAt(24)).toBeUndefined();
    expect(pointsAt(null)).toBeUndefined();
  });
});
