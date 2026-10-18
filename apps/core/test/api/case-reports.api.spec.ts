import { type CaseReport, type CaseReportVersion } from '@sentinel/domain';
import { INSTANT_TIMELINE, buildDemoTakeover01, playScenario, type PlaybackReport } from '@sentinel/scenarios';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { startCoreHarness, type CoreHarness } from '../support/harness/core-test-harness.js';
import { HttpBankConnector, callJson } from '../support/harness/http-bank-connector.js';
import { createInMemoryPersistence, type InMemoryPersistence } from '../support/in-memory-repositories/in-memory-persistence.js';

const EPOCH = '2026-09-24T11:30:00.000Z';
const ANALYST = 'analyst.tan';

describe('/v1/cases — evidence-backed report lifecycle', () => {
  let persistence: InMemoryPersistence;
  let harness: CoreHarness;
  let playback: PlaybackReport;

  beforeAll(async () => {
    persistence = createInMemoryPersistence();
    harness = await startCoreHarness(persistence, { clockStart: EPOCH });
    playback = await playScenario(buildDemoTakeover01(EPOCH), new HttpBankConnector(harness.baseUrl, harness.clock), INSTANT_TIMELINE);
  });

  afterAll(() => harness.close());

  it('opens an alert case idempotently, generates and edits a draft, signs an immutable version, and exports saved content', async () => {
    const alert = persistence.alertStore.all()[0];
    expect(alert).toBeDefined();
    const opened = await callJson<{ outcome: string; record: { id: string; assessmentId: string } }>(
      harness.baseUrl,
      'POST',
      '/v1/cases',
      { alertId: alert?.id, analystIdentity: ANALYST },
    );
    expect(opened.status).toBe(201);
    const caseId = opened.body.record.id;

    const duplicate = await callJson(harness.baseUrl, 'POST', '/v1/cases', { alertId: alert?.id, analystIdentity: ANALYST });
    expect(duplicate.status).toBe(200);
    expect(duplicate.body).toMatchObject({ outcome: 'DUPLICATE', record: { id: caseId } });

    const generated = await callJson<{ outcome: string; record: CaseReport }>(
      harness.baseUrl,
      'POST',
      `/v1/cases/${caseId}/report`,
      { analystIdentity: ANALYST },
    );
    expect(generated.status).toBe(201);
    expect(generated.body.record.latest).toMatchObject({
      caseId,
      version: 1,
      status: 'DRAFT',
      basedOn: { assessmentId: opened.body.record.assessmentId },
    });
    expect(generated.body.record.latest.sections.map((section) => section.id)).toEqual([
      'SUMMARY',
      'TIMELINE',
      'EVIDENCE',
      'INTERVENTIONS',
      'NETWORK',
      'RECOMMENDATION',
    ]);
    const draft = generated.body.record.latest;
    const recommendation = 'Escalate for analyst review using the recorded account evidence.';
    const edited = await callJson<CaseReportVersion>(harness.baseUrl, 'PATCH', `/v1/cases/${caseId}/report/1`, {
      analystIdentity: ANALYST,
      expectedRevision: draft.revision,
      edits: [{ id: 'RECOMMENDATION', body: recommendation }],
    });
    expect(edited.status).toBe(200);
    expect(edited.body).toMatchObject({ revision: 2, sections: expect.arrayContaining([expect.objectContaining({ id: 'RECOMMENDATION', body: recommendation, edited: true })]) });

    const signed = await callJson<CaseReportVersion>(harness.baseUrl, 'POST', `/v1/cases/${caseId}/report/1/sign-off`, {
      analystIdentity: ANALYST,
      expectedRevision: 2,
    });
    expect(signed.status).toBe(200);
    expect(signed.body).toMatchObject({ status: 'SIGNED_OFF', revision: 3, signedOffBy: ANALYST, signedOffAt: expect.any(String) });

    const immutable = await callJson(harness.baseUrl, 'PATCH', `/v1/cases/${caseId}/report/1`, {
      analystIdentity: ANALYST,
      expectedRevision: 3,
      edits: [{ id: 'RECOMMENDATION', body: 'Changed after signature.' }],
    });
    expect(immutable.status).toBe(409);

    const exported = await fetch(`${harness.baseUrl}/v1/cases/${caseId}/report/1/export`);
    expect(exported.status).toBe(200);
    expect(exported.headers.get('content-type')).toContain('application/pdf');
    expect(exported.headers.get('content-disposition')).toContain('report-v1.pdf');
    const document = Buffer.from(await exported.arrayBuffer()).toString('latin1');
    expect(document.startsWith('%PDF-1.4')).toBe(true);
    expect(document.trimEnd().endsWith('%%EOF')).toBe(true);
    expect(document).toContain('Escalate for analyst review using the recorded account evidence.');
    expect(document).toContain('signed off');
    expect(document).not.toContain('not signed off');
    // The cross-reference table points at real objects: every offset starts an "n 0 obj" header.
    const xrefAt = Number(/startxref\n(\d+)/.exec(document)?.[1]);
    const offsets = [...document.slice(xrefAt).matchAll(/^(\d{10}) 00000 n $/gm)].map((match) => Number(match[1]));
    expect(offsets.length).toBeGreaterThan(4);
    offsets.forEach((offset, index) => expect(document.slice(offset, offset + 12)).toMatch(new RegExp(`^${index + 1} 0 obj`)));

    const events = persistence.auditLog.all().filter((event) => event.subject.caseId === caseId);
    expect(events.map((event) => event.action)).toEqual(['CASE_OPENED', 'REPORT_GENERATED', 'REPORT_EDITED', 'REPORT_SIGNED_OFF', 'REPORT_EXPORTED']);
    expect(events.some((event) => event.detail?.includes(recommendation))).toBe(false);

    const reloaded = await callJson<{ latest: CaseReportVersion }>(harness.baseUrl, 'GET', `/v1/cases/${caseId}/report`);
    expect(reloaded.body.latest).toMatchObject({ status: 'SIGNED_OFF', sections: expect.arrayContaining([expect.objectContaining({ body: recommendation })]) });
    expect(playback.transfers.length).toBeGreaterThan(0);
  });

  it('rejects unknown case ids and refuses cases outside the selected institution lens', async () => {
    expect((await callJson(harness.baseUrl, 'GET', '/v1/cases/no-such-case')).status).toBe(404);
    const alert = persistence.alertStore.all()[0];
    if (!alert) throw new Error('Scenario did not raise an alert');
    const opened = await callJson<{ record: { id: string; institutionId: string } }>(
      harness.baseUrl,
      'POST',
      '/v1/cases',
      { alertId: alert.id, analystIdentity: ANALYST },
    );
    const otherBank = opened.body.record.institutionId === 'BANK_A' ? 'BANK_B' : 'BANK_A';
    expect((await callJson(harness.baseUrl, 'GET', `/v1/cases/${opened.body.record.id}`, undefined, { 'x-sentinel-lens': otherBank })).status).toBe(403);
    const exportDenied = await fetch(`${harness.baseUrl}/v1/cases/${opened.body.record.id}/report/1/export`, { headers: { 'x-sentinel-lens': otherBank } });
    expect(exportDenied.status).toBe(403);
    const denied = persistence.auditLog.all().filter((event) => event.outcome === 'DENIED' && event.subject.caseId === opened.body.record.id);
    expect(denied.length).toBeGreaterThanOrEqual(2);
  });

  it('refuses an unknown alert, a missing analyst identity and an unknown version', async () => {
    expect((await callJson(harness.baseUrl, 'POST', '/v1/cases', { alertId: 'no-such-alert', analystIdentity: ANALYST })).status).toBe(404);
    expect((await callJson(harness.baseUrl, 'POST', '/v1/cases', { alertId: 'no-such-alert' })).status).toBe(400);
    const alert = persistence.alertStore.all()[0];
    const opened = await callJson<{ record: { id: string } }>(harness.baseUrl, 'POST', '/v1/cases', { alertId: alert?.id, analystIdentity: ANALYST });
    expect((await fetch(`${harness.baseUrl}/v1/cases/${opened.body.record.id}/report/99/export`)).status).toBe(404);
    expect((await callJson(harness.baseUrl, 'POST', '/v1/cases/no-such-case/report', { analystIdentity: ANALYST })).status).toBe(404);
  });
});

describe('/v1/cases — sign-off rules, versions and the archived AI summary', () => {
  let persistence: InMemoryPersistence;
  let harness: CoreHarness;
  let caseId: string;

  const call = <T>(method: string, path: string, body?: unknown) => callJson<T>(harness.baseUrl, method, path, body);

  beforeAll(async () => {
    persistence = createInMemoryPersistence();
    harness = await startCoreHarness(persistence, { clockStart: EPOCH });
    await playScenario(buildDemoTakeover01(EPOCH), new HttpBankConnector(harness.baseUrl, harness.clock), INSTANT_TIMELINE);
    const alert = persistence.alertStore.all()[0];
    if (!alert) throw new Error('Scenario did not raise an alert');
    await persistence.summaries.store({
      assessmentId: alert.assessmentId,
      archivedAt: EPOCH,
      summary: {
        hypothesis: 'Account takeover followed by rapid outflow to new payees.',
        confidence: 'HIGH',
        evidence: [{ claim: 'Drain crossed the gate', sourceField: 'drain.drainPct', value: '65.4' }],
        recommendedActions: ['Contact the customer through a verified channel'],
        escalate: true,
      },
    });
    caseId = (await call<{ record: { id: string } }>('POST', '/v1/cases', { alertId: alert.id, analystIdentity: ANALYST })).body.record.id;
  });
  afterAll(() => harness.close());

  it('cites an archived grounded summary as advisory and generates only once', async () => {
    const first = await call<{ outcome: string; record: CaseReport }>('POST', `/v1/cases/${caseId}/report`, { analystIdentity: ANALYST });
    expect(first.status).toBe(201);
    expect(first.body.record.latest.aiSummary).toMatchObject({ status: 'INCLUDED', confidence: 'HIGH' });
    const recommendation = first.body.record.latest.sections.find((section) => section.id === 'RECOMMENDATION');
    expect(recommendation?.body).toContain('AI advisory');
    expect(recommendation?.sources).toContainEqual({ field: 'drain.drainPct', value: '65.4' });
    const again = await call<{ outcome: string; record: CaseReport }>('POST', `/v1/cases/${caseId}/report`, { analystIdentity: ANALYST });
    expect(again.status).toBe(200);
    expect(again.body.outcome).toBe('DUPLICATE');
    expect(again.body.record.versions).toHaveLength(1);
  });

  it('marks a draft export as not signed off, and blocks sign-off until the analyst writes the recommendation', async () => {
    const draftPdf = Buffer.from(await (await fetch(`${harness.baseUrl}/v1/cases/${caseId}/report/1/export`)).arrayBuffer()).toString('latin1');
    expect(draftPdf).toContain('not signed off');
    expect((await call('POST', `/v1/cases/${caseId}/report/1/sign-off`, { analystIdentity: ANALYST, expectedRevision: 1 })).status).toBe(422);
    const stale = await call('PATCH', `/v1/cases/${caseId}/report/1`, { analystIdentity: ANALYST, expectedRevision: 7, edits: [{ id: 'SUMMARY', body: 'x' }] });
    expect(stale.status).toBe(409);
  });

  it('keeps the signed version intact when a revision starts a new draft version', async () => {
    await call('PATCH', `/v1/cases/${caseId}/report/1`, { analystIdentity: ANALYST, expectedRevision: 1, edits: [{ id: 'RECOMMENDATION', body: 'Escalate and confirm fraud.' }] });
    const signed = await call<CaseReportVersion>('POST', `/v1/cases/${caseId}/report/1/sign-off`, { analystIdentity: ANALYST, expectedRevision: 2 });
    expect(signed.status).toBe(200);
    const revision = await call<CaseReportVersion>('POST', `/v1/cases/${caseId}/report/revision`, { analystIdentity: 'analyst.lim', fromVersion: 1 });
    expect(revision.status).toBe(201);
    expect(revision.body).toMatchObject({ version: 2, status: 'DRAFT', supersedesVersion: 1, createdBy: 'analyst.lim' });
    expect(revision.body.signedOffAt).toBeUndefined();
    expect((await call('POST', `/v1/cases/${caseId}/report/revision`, { analystIdentity: ANALYST, fromVersion: 1 })).status).toBe(409);
    await call('PATCH', `/v1/cases/${caseId}/report/2`, { analystIdentity: 'analyst.lim', expectedRevision: 1, edits: [{ id: 'RECOMMENDATION', body: 'Escalate; customer unreachable.' }] });
    const report = await call<CaseReport>('GET', `/v1/cases/${caseId}/report`);
    expect(report.body.versions.map((version) => [version.version, version.status])).toEqual([
      [1, 'SIGNED_OFF'],
      [2, 'DRAFT'],
    ]);
    const versions = await persistence.reports.versions(caseId);
    expect(versions[0]?.sections.find((section) => section.id === 'RECOMMENDATION')?.body).toBe('Escalate and confirm fraud.');
    expect(versions[0]).toMatchObject({ signedOffBy: ANALYST, status: 'SIGNED_OFF' });
  });
});
