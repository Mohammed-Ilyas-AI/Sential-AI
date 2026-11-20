import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { Store } from '@ngrx/store';
import type { AdvisoryOutcome, CaseSummary, EvidenceBundle, InvestigationEvidence, RiskExplanation, SentinelSwarmReport } from '@sentinel/domain';
import { of, Subject } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { provideTestStore } from '../../../../../testing/provide-test-store';
import { demoAlert, demoFinalDecision, demoHold } from '../../../../../testing/ui-fixtures';
import { AlertsActions } from '../../../../state/alerts/alerts.actions';
import { TransactionsActions } from '../../../../state/transactions/transactions.actions';
import { InvestigationsApi } from '../../data-access/investigations-api';
import { InvestigationsFacade } from '../../data-access/investigations-facade';
import { InvestigationPage } from './investigation-page';
import { LOCAL_RUNTIME_CONFIG, provideRuntimeConfig } from '../../../../core/config/runtime-config';
import { CoreApiClient } from '../../../../core/http/api-client/core-api-client';

const decision = demoFinalDecision();
const evidence: EvidenceBundle = {
  account: { accountId: decision.accountId, institutionId: 'BANK_A', openedAt: '2019-03-01T00:00:00.000Z', protected: true },
  assessment: decision.assessment,
  drain: decision.assessment.drain,
  recentTransactions: [
    {
      id: decision.transactionId,
      ts: decision.occurredAt,
      sourceAccountId: decision.accountId,
      destAccountId: 'acct_tok_mule',
      payeeId: 'ben_tok_mule',
      deviceId: 'dev_tok_new',
      amount: decision.amount,
      channel: 'APP',
      type: 'TRANSFER',
      institutionId: 'BANK_A',
      destInstitutionId: 'BANK_C',
    },
  ],
  deviceHistory: [{ deviceId: 'dev_tok_new', eventType: 'NEW_DEVICE', occurredAt: '2026-09-24T00:58:00.000Z' }],
  payeeHistory: [{ payeeId: 'ben_tok_mule', eventType: 'PAYEE_ADDED', occurredAt: '2026-09-24T00:58:30.000Z' }],
  priorAlerts: [],
  interventions: [demoHold()],
  neighbourhood: { rootId: decision.accountId, hopDepth: 2, nodes: [], edges: [], truncated: false },
};

const summary: AdvisoryOutcome<CaseSummary> = {
  status: 'GENERATED',
  attempts: 1,
  droppedClaims: 1,
  advisory: {
    hypothesis: 'Probable account takeover: a new device and payee preceded a 65.4% drain.',
    confidence: 'HIGH',
    evidence: [{ claim: 'The drain crossed SG-RD-50', sourceField: 'drain.thresholdMet', value: 'true' }],
    recommendedActions: ['Contact the customer on the number held on file'],
    escalate: true,
  },
};

const mockSwarmReport: SentinelSwarmReport = {
  assessmentId: decision.assessmentId,
  evaluatedAt: '2026-09-24T11:32:00.000Z',
  overallThreatLevel: 'CRITICAL',
  agents: {
    ato: {
      isTakeoverLikely: true,
      deviceRisk: 'UNSEEN_COMPROMISED',
      authenticationLineage: 'Compromised device signature dev-x92 detected',
      atoConfidenceScore: 94,
    },
    beneficiary: {
      payeeRiskTier: 'KNOWN_MULE',
      dormantPayeeActivated: false,
      counterpartyAssessment: 'Payee flagged in syndicate mule repository',
    },
    scamIntent: {
      scamTypology: 'GOVERNMENT_IMPERSONATION',
      coercionIndex: 'ACUTE_COERCION',
      behavioralAnomalySummary: 'High urgency off-hours account drain velocity',
    },
    muleTrace: {
      observedHops: 2,
      identifiedMuleRing: true,
      pathEntities: ['acct_tok_mule', 'ben_tok_mule'],
      observabilityStopReason: 'Inter-bank boundary reached',
    },
    verification: {
      channelUsed: 'AUTOMATED_CALL',
      callOutcome: 'NO_ANSWER',
      recommendedImmediateAction: 'KILL_SWITCH',
      verificationScript: 'Automated call unanswered; escalating to containment',
    },
    recovery: {
      killSwitchEngaged: true,
      cascadedHoldsPlaced: 1,
      interbankRecallStatus: 'DISPATCHED_TO_BANK_B',
      estimatedSalvagedMinorUnits: 5200000,
    },
    reporting: {
      reportVersion: 1,
      executiveSummary: 'MAS SRF Section 4.2.5 compliant audit dossier compiled',
      cadReportDossier: 'CAD FORM 1 STATUTORY FILING\nSUSPECT: MULE RING 44',
      isReadyForSignOff: true,
    },
  },
};

describe('InvestigationPage', () => {
  let api: { evidence: ReturnType<typeof vi.fn>; explain: ReturnType<typeof vi.fn>; summarise: ReturnType<typeof vi.fn>; orchestrateSwarm: ReturnType<typeof vi.fn> };

  const core = {
    get: vi.fn((path: string) => (path.endsWith('/kill-switch') ? of({ accountId: decision.accountId, active: false, history: [] }) : of({ accountId: decision.accountId, contacts: [] }))),
    post: vi.fn(),
  };

  beforeEach(async () => {
    api = {
      evidence: vi.fn(() => of<InvestigationEvidence>({ assessmentId: decision.assessmentId, evidence })),
      explain: vi.fn(),
      summarise: vi.fn(),
      orchestrateSwarm: vi.fn(() => of(null)),
    };
    await TestBed.configureTestingModule({
      imports: [InvestigationPage],
      providers: [
        provideTestStore(),
        provideRouter([]),
        provideRuntimeConfig(LOCAL_RUNTIME_CONFIG),
        InvestigationsFacade,
        { provide: InvestigationsApi, useValue: api },
        { provide: CoreApiClient, useValue: core },
      ],
    }).compileComponents();
  });

  const focusDemoAccount = () => {
    const store = TestBed.inject(Store);
    store.dispatch(TransactionsActions.snapshotLoaded({ decisions: [decision], cursor: 'cursor-1' }));
    store.dispatch(AlertsActions.snapshotLoaded({ alerts: [demoAlert()] }));
  };

  async function render() {
    const fixture = TestBed.createComponent(InvestigationPage);
    await fixture.whenStable();
    const host = fixture.nativeElement as HTMLElement;
    return { host, settle: () => fixture.whenStable() };
  }

  const text = (element: Element | null | undefined) => (element?.textContent ?? '').replace(/\s+/g, ' ').trim();

  it('asks for an account when none is in focus, and calls nothing', async () => {
    const { host } = await render();
    expect(text(host.querySelector('.state'))).toContain('No account is in focus');
    expect(api.evidence).not.toHaveBeenCalled();
  });

  it('opens the bundle for the focused assessment with the deterministic attribution first', async () => {
    focusDemoAccount();
    const { host, settle } = await render();
    expect(api.evidence).toHaveBeenCalledWith(decision.assessmentId);
    expect(text(host.querySelector('sentinel-account-summary'))).toContain('HOLD');
    expect(host.querySelectorAll('sentinel-risk-attribution li')).toHaveLength(decision.assessment.contributions.length);
    expect(text(host.querySelector('sentinel-evidence-panel'))).toContain('Recent transactions (cap 50)');
    expect(host.querySelectorAll('sentinel-timeline li')).toHaveLength(4);
    // The transfer still on the live tape carries the gate's own score and decision; nothing else is inferred.
    expect([...host.querySelectorAll('sentinel-timeline .verdict')].map((verdict) => text(verdict))).toEqual(['95 HOLD']);
    expect(text(host.querySelector('sentinel-gemini-advisory'))).toContain('AI-generated · advisory only');
    expect(host.querySelector('sentinel-evidence-panel pre')).toBeNull();
    (host.querySelector('sentinel-evidence-panel button.view') as HTMLButtonElement).click();
    await settle();
    expect(text(host.querySelector('sentinel-evidence-panel pre'))).toContain(decision.transactionId);
    expect(api.summarise).not.toHaveBeenCalled();
  });

  it('shows a grounded summary with each claim’s sourceField and the count of removed claims', async () => {
    focusDemoAccount();
    api.summarise.mockReturnValue(of(summary));
    const { host, settle } = await render();
    const summarise = [...host.querySelectorAll('sentinel-gemini-advisory button')].find((button) => text(button) === 'Summarise case') as HTMLButtonElement;
    summarise.click();
    await settle();
    const advisory = text(host.querySelector('sentinel-gemini-advisory'));
    expect(advisory).toContain('Probable account takeover');
    expect(advisory).toContain('drain.thresholdMet = true');
    expect(advisory).toContain('1 ungrounded claim removed');
  });

  it('renders a generated explanation from the fast tier', async () => {
    focusDemoAccount();
    api.explain.mockReturnValue(
      of({
        status: 'GENERATED' as const,
        attempts: 1,
        droppedClaims: 0,
        advisory: {
          assessmentId: 'assessment-under-test',
          primaryReason: 'A 65.4% drain followed a new device and a new payee.',
          recommendedAction: 'Contact the customer on the number held on file.',
          generatedAt: '2026-09-24T11:32:00.000Z',
        },
      }),
    );
    const { host, settle } = await render();
    (host.querySelector('sentinel-gemini-advisory button') as HTMLButtonElement).click();
    await settle();
    const advisory = text(host.querySelector('sentinel-gemini-advisory'));
    expect(advisory).toContain('A 65.4% drain followed a new device and a new payee.');
    expect(advisory).toContain('Contact the customer on the number held on file.');
  });

  it('says when Gemini did not finish within the server limit, without inventing an answer', async () => {
    focusDemoAccount();
    api.explain.mockReturnValue(of({ status: 'FALLBACK' as const, advisory: null, reason: 'MODEL_TIMED_OUT' as const, attempts: 1 }));
    const { host, settle } = await render();
    (host.querySelector('sentinel-gemini-advisory button') as HTMLButtonElement).click();
    await settle();
    const advisory = text(host.querySelector('sentinel-gemini-advisory'));
    expect(advisory).toContain('did not finish within the server’s request limit');
    expect(advisory).not.toContain('Generated, schema-validated');
  });

  it('says when sentinel-core has no Google credentials', async () => {
    focusDemoAccount();
    api.explain.mockReturnValue(of({ status: 'FALLBACK' as const, advisory: null, reason: 'MODEL_CREDENTIALS_UNAVAILABLE' as const, attempts: 1 }));
    const { host, settle } = await render();
    (host.querySelector('sentinel-gemini-advisory button') as HTMLButtonElement).click();
    await settle();
    expect(text(host.querySelector('sentinel-gemini-advisory [role="status"]'))).toContain('gcloud auth application-default login');
  });

  it('opens the advisory in a dialog with a loader, then the real answer, and Escape closes it', async () => {
    focusDemoAccount();
    const pending = new Subject<AdvisoryOutcome<CaseSummary>>();
    api.summarise.mockReturnValue(pending);
    const { host, settle } = await render();
    const summarise = [...host.querySelectorAll('sentinel-gemini-advisory button')].find((button) => text(button) === 'Summarise case') as HTMLButtonElement;
    summarise.click();
    await settle();
    const dialog = () => host.querySelector('sentinel-advisory-dialog');
    expect(dialog()?.querySelector('[role="dialog"]')?.getAttribute('aria-modal')).toBe('true');
    expect(dialog()?.querySelector('sentinel-advisory-loader')).not.toBeNull();
    expect(text(dialog())).toContain('Gemini is correlating the evidence');
    // The deterministic decision stays in view as its own fact.
    expect(text(dialog()?.querySelector('footer') ?? null)).toContain('HOLD');

    pending.next(summary);
    await settle();
    expect(dialog()?.querySelector('sentinel-advisory-loader')).toBeNull();
    expect(text(dialog())).toContain('Probable account takeover');
    expect(text(dialog())).toContain('drain.thresholdMet = true');
    expect(text(dialog())).toContain('1 ungrounded claim removed');

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    await settle();
    expect(dialog()).toBeNull();
    // Closing never loses the answer: the inline card keeps it.
    expect(text(host.querySelector('sentinel-gemini-advisory'))).toContain('Probable account takeover');
  });

  it('shows a fallback in the dialog without inventing an answer, and offers to try again', async () => {
    focusDemoAccount();
    api.explain.mockReturnValue(of({ status: 'FALLBACK' as const, advisory: null, reason: 'MODEL_TIMED_OUT' as const, attempts: 1 }));
    const { host, settle } = await render();
    (host.querySelector('sentinel-gemini-advisory button') as HTMLButtonElement).click();
    await settle();
    const dialog = host.querySelector('sentinel-advisory-dialog');
    expect(text(dialog)).toContain('did not finish within the server’s request limit');
    expect(text(dialog)).not.toContain('Generated, schema-validated');
    (dialog?.querySelector('button.retry') as HTMLButtonElement).click();
    await settle();
    expect(api.explain).toHaveBeenCalledTimes(2);
  });

  it('says plainly when Gemini is unavailable and keeps the attribution on screen', async () => {
    focusDemoAccount();
    const pending = new Subject<AdvisoryOutcome<RiskExplanation>>();
    api.explain.mockReturnValue(pending);
    const { host, settle } = await render();
    (host.querySelector('sentinel-gemini-advisory button') as HTMLButtonElement).click();
    await settle();
    expect(text(host.querySelector('sentinel-gemini-advisory button'))).toBe('Explaining…');
    expect(text(host.querySelector('sentinel-gemini-advisory [role="status"]'))).toContain('Gemini is reasoning over the evidence bundle');
    pending.next({ status: 'FALLBACK', advisory: null, reason: 'MODEL_NOT_CONFIGURED', attempts: 1 });
    await settle();
    expect(text(host.querySelector('sentinel-gemini-advisory [role="status"]'))).toContain('No Gemini model is configured');
    expect(host.querySelectorAll('sentinel-risk-attribution li')).toHaveLength(decision.assessment.contributions.length);
  });
  it('puts the action centre on the page: hold exceptions, customer outreach and the kill switch', async () => {
    focusDemoAccount();
    const { host } = await render();
    const centre = host.querySelector('sentinel-action-centre');
    expect(centre?.textContent).toContain('Held transfer');
    expect(centre?.textContent).toContain('Automated call');
    expect(centre?.textContent).toContain('Email the customer');
    expect(centre?.textContent).toContain('Activate kill switch');
  });

  it('renders the 7-agent autonomous swarm orchestrator with all pipeline stages and agent findings', async () => {
    focusDemoAccount();
    api.orchestrateSwarm.mockReturnValue(of(mockSwarmReport));
    const { host, settle } = await render();
    await settle();

    const swarm = host.querySelector('sentinel-agent-swarm');
    expect(swarm).not.toBeNull();
    const swarmText = text(swarm);
    expect(swarmText).toContain('Google Cloud Vertex AI · 7-Agent Autonomous Swarm');
    expect(swarmText).toContain('Dual-Tier Gemini · 4-Stage Mesh');
    expect(swarmText).toContain('STAGE 1');
    expect(swarmText).toContain('Parallel Triage');
    expect(swarmText).toContain('STAGE 2');
    expect(swarmText).toContain('Customer Defense');
    expect(swarmText).toContain('STAGE 3');
    expect(swarmText).toContain('Capital Containment');
    expect(swarmText).toContain('STAGE 4');
    expect(swarmText).toContain('Regulatory Sign-Off');

    expect(swarmText).toContain('THREAT LEVEL: CRITICAL');
    expect(swarmText).toContain('1. ATO Investigation');
    expect(swarmText).toContain('2. Beneficiary Intel');
    expect(swarmText).toContain('3. Scam Intent');
    expect(swarmText).toContain('4. Mule Tracing');
    expect(swarmText).toContain('5. Customer Verify');
    expect(swarmText).toContain('6. Recovery & Recall');
    expect(swarmText).toContain('7. Regulatory STR Reporting (MAS SRF & CAD STRO)');

    // Toggle CAD STRO Dossier
    expect(host.querySelector('pre.dossier')).toBeNull();
    const dossierBtn = host.querySelector('.dossier-btn') as HTMLButtonElement;
    dossierBtn.click();
    await settle();
    expect(host.querySelector('pre.dossier')).not.toBeNull();
    expect(text(host.querySelector('pre.dossier'))).toContain('CAD FORM 1 STATUTORY FILING');
  });
});
