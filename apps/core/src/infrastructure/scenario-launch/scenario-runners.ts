import { spawn, type ChildProcess } from 'node:child_process';
import type { ScenarioLaunchCapability } from '@sentinel/domain';
import { GoogleAuth } from 'google-auth-library';
import type { ScenarioLaunchRequest, ScenarioRunner, ScenarioRunUpdate } from '../../modules/scenarios/application/ports/scenario-runner.port.js';
import type { Clock } from '../../platform/time/clock.js';

const noiseEnvironment = (request: ScenarioLaunchRequest): Record<string, string> =>
  request.noise
    ? {
        SIMULATOR_NOISE_ENABLED: 'true',
        SIMULATOR_NOISE_SEED: String(request.noise.seed),
        SIMULATOR_NOISE_RATE_PER_MINUTE: String(request.noise.ratePerMinute),
      }
    : { SIMULATOR_NOISE_ENABLED: 'false' };

/** The default: no launcher is configured, and the UI says so instead of offering a button that cannot work. */
export class DisabledScenarioRunner implements ScenarioRunner {
  readonly capability: ScenarioLaunchCapability = {
    available: false,
    launcher: 'DISABLED',
    reason: 'Scenario launch is not configured on this deployment (SCENARIO_LAUNCHER). Run `npm run simulate` or execute the sentinel-simulator Cloud Run Job.',
  };

  launch(): Promise<never> {
    return Promise.reject(new Error('Scenario launch is disabled'));
  }

  async status(): Promise<null> {
    return null;
  }
}

/**
 * Local development: the same simulator `npm run simulate` starts, as a child of sentinel-core, with run-scoped
 * environment only. The command is fixed; nothing from the request reaches it except the run ID and noise numbers.
 */
export class LocalProcessScenarioRunner implements ScenarioRunner {
  readonly capability: ScenarioLaunchCapability = { available: true, launcher: 'LOCAL_PROCESS' };
  private readonly children = new Map<string, ChildProcess>();
  private readonly finished = new Map<string, ScenarioRunUpdate>();

  constructor(
    private readonly settings: { readonly workdir: string; readonly coreBaseUrl: string },
    private readonly clock: Clock,
  ) {}

  launch(request: ScenarioLaunchRequest, onUpdate: (update: ScenarioRunUpdate) => Promise<void>): Promise<{ readonly executionName?: string }> {
    return new Promise((resolve, reject) => {
      const child = spawn('npm', ['run', 'dev', '--workspace', '@sentinel/simulator'], {
        cwd: this.settings.workdir,
        shell: process.platform === 'win32',
        stdio: 'ignore',
        env: {
          ...process.env,
          SIMULATOR_CORE_BASE_URL: this.settings.coreBaseUrl,
          SIMULATOR_EVENT_TRANSPORT: 'direct-push',
          SIMULATOR_TIMELINE: 'realtime',
          SIMULATOR_RUN_ID: request.runId,
          ...noiseEnvironment(request),
        },
      });
      this.children.set(request.runId, child);
      child.once('error', (error) => {
        this.children.delete(request.runId);
        reject(error);
      });
      child.once('spawn', () => resolve({}));
      child.once('exit', (code) => {
        this.children.delete(request.runId);
        const update: ScenarioRunUpdate =
          code === 0
            ? { status: 'COMPLETED', at: this.clock.now().toISOString() }
            : { status: 'FAILED', at: this.clock.now().toISOString(), failure: `The simulator exited with code ${code ?? 'unknown'}` };
        this.finished.set(request.runId, update);
        void onUpdate(update);
      });
    });
  }

  async status(runId: string): Promise<ScenarioRunUpdate | null> {
    if (this.children.has(runId)) return { status: 'RUNNING', at: this.clock.now().toISOString() };
    return this.finished.get(runId) ?? null;
  }
}

interface RunOperation {
  readonly metadata?: { readonly name?: string };
}

interface Execution {
  readonly succeededCount?: number;
  readonly failedCount?: number;
  readonly cancelledCount?: number;
  readonly completionTime?: string;
}

/**
 * Executes the existing sentinel-simulator Cloud Run Job through the Cloud Run Admin API with sentinel-core's own
 * service account (ADC), overriding only the run's environment. Not exercised against Google Cloud in this
 * repository's tests; it needs run.jobs.runWithOverrides and run.executions.get on the job.
 */
export class CloudRunJobScenarioRunner implements ScenarioRunner {
  readonly capability: ScenarioLaunchCapability = { available: true, launcher: 'CLOUD_RUN_JOB' };
  private readonly auth = new GoogleAuth({ scopes: ['https://www.googleapis.com/auth/cloud-platform'] });

  constructor(
    private readonly settings: { readonly projectId: string; readonly region: string; readonly job: string },
    private readonly clock: Clock,
  ) {}

  async launch(request: ScenarioLaunchRequest): Promise<{ readonly executionName?: string }> {
    const client = await this.auth.getClient();
    const { projectId, region, job } = this.settings;
    const env = Object.entries({ SIMULATOR_RUN_ID: request.runId, ...noiseEnvironment(request) }).map(([name, value]) => ({ name, value }));
    const response = await client.request<RunOperation>({
      url: `https://run.googleapis.com/v2/projects/${projectId}/locations/${region}/jobs/${job}:run`,
      method: 'POST',
      data: { overrides: { containerOverrides: [{ env }] } },
    });
    const executionName = response.data.metadata?.name;
    return executionName ? { executionName } : {};
  }

  async status(_runId: string, executionName: string | undefined): Promise<ScenarioRunUpdate | null> {
    if (!executionName) return { status: 'RUNNING', at: this.clock.now().toISOString() };
    const client = await this.auth.getClient();
    const { data } = await client.request<Execution>({ url: `https://run.googleapis.com/v2/${executionName}`, method: 'GET' });
    const at = this.clock.now().toISOString();
    if (!data.completionTime) return { status: 'RUNNING', at };
    if ((data.succeededCount ?? 0) > 0 && (data.failedCount ?? 0) === 0) return { status: 'COMPLETED', at };
    return { status: 'FAILED', at, failure: (data.cancelledCount ?? 0) > 0 ? 'The Cloud Run execution was cancelled' : 'The Cloud Run execution failed' };
  }
}
