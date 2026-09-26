import type { RollingWindow } from '@sentinel/domain';
import { NotYetImplementedError } from '@sentinel/domain';
import type { ComputeRollingWindow } from './compute-rolling-window.use-case.js';
import type { OutflowWindowSource } from './ports/outflow-window-source.port.js';

/** Cached per account and invalidated on every outflow, so the control path never waits on an aggregation. */
export class RollingWindowService implements ComputeRollingWindow {
  constructor(private readonly outflows: OutflowWindowSource) {}

  windowFor(): Promise<RollingWindow> {
    throw new NotYetImplementedError('24-hour rolling window', 'scheduled for build order step 3');
  }
}
