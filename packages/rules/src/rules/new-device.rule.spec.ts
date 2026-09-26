import { describe, expect, it } from 'vitest';
import { newDeviceRule } from './new-device.rule.js';

describe('NEW_DEVICE rule', () => {
  it('declares its code and the documented maximum of 21 points', () => {
    expect(newDeviceRule.code).toBe('NEW_DEVICE');
    expect(newDeviceRule.maxPoints).toBe(21);
  });

  it.todo('scores 21 when the device is not known and was first seen under 24 hours ago');
  it.todo('scores nothing for a device first seen 24 hours ago or earlier');
  it.todo('scores nothing for a device in knownDeviceIds');
});
