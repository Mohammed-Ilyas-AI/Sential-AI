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
    expect(exported.headers.get('content-type')).toContain('text/plain');
    const document = await exported.text();
    expect(document).toContain('Escalate for analyst review using the recorded account evidence.');
    expect(document).toContain('SIGNED_OFF');

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
  });
});
