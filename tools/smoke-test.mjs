import { startCoreHarness } from '../apps/core/test/support/harness/core-test-harness.js';
import { createInMemoryPersistence } from '../apps/core/test/support/in-memory-repositories/in-memory-persistence.js';
import { HttpBankConnector } from '../apps/core/test/support/harness/http-bank-connector.js';
import { buildDemoTakeover01, playScenario, INSTANT_TIMELINE, syntheticToken } from '@sentinel/scenarios';
import { DEMO_TAKEOVER_01 } from '@sentinel/domain';

console.log('================================================================');
console.log('🚀 SENTINEL AI: END-TO-END SERVER & 7-AGENT SWARM SMOKE TEST');
console.log('================================================================');

async function runSmokeTest() {
  const EPOCH = '2026-09-24T11:30:00.000Z';
  const VICTIM = syntheticToken('acct', DEMO_TAKEOVER_01.accountDisplayId);
  const persistence = createInMemoryPersistence();
  const harness = await startCoreHarness(persistence, {
    clockStart: EPOCH,
    designatedBillingPayeeIds: new Set([DEMO_TAKEOVER_01.designatedBillerId]),
    liveDemoTimeline: () => INSTANT_TIMELINE,
  });

  console.log(`[1/5] Core server started on ephemeral test address: ${harness.baseUrl}`);

  // 1. Health check probe
  const healthRes = await fetch(`${harness.baseUrl}/healthz`);
  console.log(`[2/5] GET /healthz -> HTTP ${healthRes.status} (${await healthRes.text()})`);
  if (healthRes.status !== 200) throw new Error('Health check failed');

  // 2. Play DEMO_TAKEOVER_01 scenario over real HTTP connector
  console.log('[3/5] Streaming DEMO_TAKEOVER_01 transactions over real HTTP ...');
  const playback = await playScenario(
    buildDemoTakeover01(EPOCH),
    new HttpBankConnector(harness.baseUrl, harness.clock),
    INSTANT_TIMELINE
  );

  const final = playback.transfers.filter((t) => t.step.request.sourceAccountToken === VICTIM).at(-1);
  if (!final) throw new Error('The final transfer was not played');
  const assessmentId = final.response.assessmentId;
  console.log(`      Final transfer verdict: ${final.response.decision} (Risk Score: ${final.response.riskScore})`);
  console.log(`      Assessment ID: ${assessmentId}`);

  // 3. Orchestrate 7-Agent Swarm
  console.log(`[4/5] Executing POST /v1/investigations/${assessmentId}/orchestrate ...`);
  const swarmRes = await fetch(`${harness.baseUrl}/v1/investigations/${encodeURIComponent(assessmentId)}/orchestrate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
  });
  console.log(`      Status: HTTP ${swarmRes.status}`);
  if (swarmRes.status !== 200) throw new Error(`Swarm orchestrate failed: HTTP ${swarmRes.status}`);
  const swarm = await swarmRes.json();

  console.log('      ----------------------------------------------------------');
  console.log(`      • Overall Threat Level: ${swarm.overallThreatLevel}`);
  console.log(`      • Agent 1 (ATO):        ${swarm.agents.ato.deviceRisk} (Confidence: ${swarm.agents.ato.atoConfidenceScore}%)`);
  console.log(`      • Agent 2 (Beneficiary): ${swarm.agents.beneficiary.payeeRiskTier} (${swarm.agents.beneficiary.counterpartyAssessment})`);
  console.log(`      • Agent 3 (Scam Intent): ${swarm.agents.scamIntent.coercionIndex} (${swarm.agents.scamIntent.scamTypology})`);
  console.log(`      • Agent 4 (Mule Trace):  Hops: ${swarm.agents.muleTrace.observedHops}, Ring: ${swarm.agents.muleTrace.identifiedMuleRing}`);
  console.log(`      • Agent 5 (Verify):     Call: ${swarm.agents.verification.callOutcome}, Action: ${swarm.agents.verification.recommendedImmediateAction}`);
  console.log(`      • Agent 6 (Recovery):   Kill-Switch: ${swarm.agents.recovery.killSwitchEngaged}, Recall: ${swarm.agents.recovery.interbankRecallStatus}`);
  console.log(`      • Agent 7 (Reporting):  MAS SRF & CAD Form 1 Ready: ${swarm.agents.reporting.isReadyForSignOff}`);
  console.log('      ----------------------------------------------------------');

  // 4. Test GET cache
  const getRes = await fetch(`${harness.baseUrl}/v1/investigations/${encodeURIComponent(assessmentId)}/orchestrate`);
  console.log(`[5/5] GET /v1/investigations/${assessmentId}/orchestrate -> HTTP ${getRes.status} (Cached)`);
  if (getRes.status !== 200) throw new Error('GET cached swarm failed');

  await harness.close();
  console.log('================================================================');
  console.log('✅ ALL SMOKE TESTS PASSED: 7-AGENT SWARM SERVER RUNNING FLAWLESSLY');
  console.log('================================================================');
}

runSmokeTest().catch((err) => {
  console.error('❌ SMOKE TEST FAILED:', err);
  process.exit(1);
});
