import type { ConnectionRegistry } from '../connections/client-connection.js';
import type { Logger } from '../telemetry/logger.js';
import type { ChangeFeed } from './change-feed.js';

const RESTART_DELAY_MS = 1_000;

/** Broadcasts every change to every connected client; restarts the feed if the change stream drops. */
export class ChangeFeedPump {
  private running = false;

  constructor(
    private readonly feed: ChangeFeed,
    private readonly registry: ConnectionRegistry,
    private readonly logger: Logger,
  ) {}

  start(): void {
    this.running = true;
    void this.run();
  }

  async stop(): Promise<void> {
    this.running = false;
    await this.feed.close();
  }

  private async run(): Promise<void> {
    while (this.running) {
      try {
        for await (const message of this.feed.messages()) this.registry.broadcast(message);
      } catch (error) {
        if (!this.running) return;
        this.logger.error({ err: error }, 'change stream interrupted; restarting');
        await new Promise((resolve) => setTimeout(resolve, RESTART_DELAY_MS));
      }
    }
  }
}
