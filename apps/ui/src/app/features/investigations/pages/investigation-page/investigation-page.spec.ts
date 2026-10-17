import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { Store } from '@ngrx/store';
import type { AdvisoryOutcome, CaseSummary, EvidenceBundle, InvestigationEvidence, RiskExplanation } from '@sentinel/domain';
import { of, Subject } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { provideTestStore } from '../../../../../testing/provide-test-store';
import { demoAlert, demoFinalDecision, demoHold } from '../../../../../testing/ui-fixtures';
import { AlertsActions } from '../../../../state/alerts/alerts.actions';
import { TransactionsActions } from '../../../../state/transactions/transactions.actions';
import { InvestigationsApi } from '../../data-access/investigations-api';
import { InvestigationsFacade } from '../../data-access/investigations-facade';
import { InvestigationPage } from './investigation-page';

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

describe('InvestigationPage', () => {
  let api: { evidence: ReturnType<typeof vi.fn>; explain: ReturnType<typeof vi.fn>; summarise: ReturnType<typeof vi.fn> };

  beforeEach(async () => {
    api = {
      evidence: vi.fn(() => of<InvestigationEvidence>({ assessmentId: decision.assessmentId, evidence })),
      explain: vi.fn(),
      summarise: vi.fn(),
    };
    await TestBed.configureTestingModule({
      imports: [InvestigationPage],
      providers: [provideTestStore(), provideRouter([]), InvestigationsFacade, { provide: InvestigationsApi, useValue: api }],
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
    const { host } = await render();
    expect(api.evidence).toHaveBeenCalledWith(decision.assessmentId);
    expect(text(host.querySelector('sentinel-account-summary'))).toContain('HOLD');
    expect(host.querySelectorAll('sentinel-risk-attribution li')).toHaveLength(decision.assessment.contributions.length);
    expect(text(host.querySelector('sentinel-evidence-panel'))).toContain('Recent transactions (cap 50)');
    expect(host.querySelectorAll('sentinel-timeline li')).toHaveLength(4);
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

  it('says when sentinel-core has no Google credentials', async () => {
    focusDemoAccount();
    api.explain.mockReturnValue(of({ status: 'FALLBACK' as const, advisory: null, reason: 'MODEL_CREDENTIALS_UNAVAILABLE' as const, attempts: 1 }));
    const { host, settle } = await render();
    (host.querySelector('sentinel-gemini-advisory button') as HTMLButtonElement).click();
    await settle();
    expect(text(host.querySelector('sentinel-gemini-advisory [role="status"]'))).toContain('gcloud auth application-default login');
  });

  it('says plainly when Gemini is unavailable and keeps the attribution on screen', async () => {
    focusDemoAccount();
    const pending = new Subject<AdvisoryOutcome<RiskExplanation>>();
    api.explain.mockReturnValue(pending);
    const { host, settle } = await render();
    (host.querySelector('sentinel-gemini-advisory button') as HTMLButtonElement).click();
    await settle();
    expect(text(host.querySelector('sentinel-gemini-advisory button'))).toBe('Explaining…');
    pending.next({ status: 'FALLBACK', advisory: null, reason: 'MODEL_NOT_CONFIGURED', attempts: 1 });
    await settle();
    expect(text(host.querySelector('sentinel-gemini-advisory [role="status"]'))).toContain('No Gemini model is configured');
    expect(host.querySelectorAll('sentinel-risk-attribution li')).toHaveLength(decision.assessment.contributions.length);
  });
});
