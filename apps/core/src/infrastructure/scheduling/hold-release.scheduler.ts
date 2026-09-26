import type { InterventionWorkflow } from '../../modules/interventions/application/intervention-workflow.use-case.js';
import type { Clock } from '../../platform/time/clock.js';
import type { Logger } from '../telemetry/logger.js';

/**
 * Releases holds whose 24-hour cooling period has elapsed. Safe on several instances at once: a release only
 * applies to a transfer whose latest state is still HELD.
 */
export class HoldReleaseScheduler {
  private timer: NodeJS.Timeout | undefined;

  constructor(
    private readonly workflow: Pick<InterventionWorkflow, 'releaseDueHolds'>,
    private readonly clock: Clock,
    private readonly intervalMs: number,
    private readonly logger: Logger,
  ) {}

  start(): void {
    this.timer = setInterval(() => void this.tick(), this.intervalMs);
    this.timer.unref();
  }

  stop(): void {
    if (this.timer) clearInterval(this.timer);
  }

  async tick(): Promise<number> {
    try {
      const released = await this.workflow.releaseDueHolds(this.clock.now().toISOString());
      if (released > 0) this.logger.info({ released }, 'holds auto-released after the cooling period');
      return released;
    } catch (error) {
      this.logger.error({ err: error }, 'hold release sweep failed');
      return 0;
    }
  }
}
