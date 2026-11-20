# ADR-011: Multi-scam burst from the reference scenarios, and an honest 7-agent swarm

- Status: accepted
- Date: 2026-11-21

## Context

The finale and the video need to show SENTINEL handling more than one scam at a time. The live demo plays one
account takeover (`DEMO_TAKEOVER_01`) and refuses a second run while one is playing, and the scenarios package had no
other scam generator. The HTML behavioural reference (`docs/reference/sentinel-ai-prototype.html`, `SCENARIOS` and
`buildScenario`) already defines four: phishing takeover, mule account, smurfing and credential replay.

The 7-agent swarm (M§8.8) is deterministic, but the code and the UI said otherwise. The panel and the live-demo console
claimed "Google Cloud Vertex AI", "Gemini Flash/Pro" model tiers, "unanimous consensus", a "kill switch engaged", an
"interbank recall dispatched" and "MAS SRF & CAD STRO" filings. The console showed an invented device ("dev-x92") and
"Known Mule syndicate", and the orchestrator returned an invented node ("MULE-NODE-B77"), invented confidence figures,
and a call outcome before any call was made. The Settings launcher listed two scenarios that do not exist
(`DEMO_MULE_RING_02` with gate "SG-ML-20", `DEMO_APP_SCAM_03` with gate "SG-SC-15"). M§11 names this as a risk: a label
that claims more than the code does.

## Decision

1. **Port, don't invent.** `REFERENCE_SCENARIOS` in `packages/domain` holds the reference's four scenarios as data.
   `referenceScenarioGenerator` plays any of them on one synthetic account, with the reference's amount scaling.
   `MULTI_SCAM_BURST_01` puts the four scenarios on all three banks: twelve cases on twelve accounts, starting 1.5 s
   apart, with cross-bank destinations. The ported phishing case reproduces the documented result (95, 65.4%).
2. **Run concurrently through the real control path.** `POST /v1/demo/live-demo/burst` plays each case on its own,
   in parallel, through the same in-process bank connector as the live demo. It shares the one-run-at-a-time guard
   and audits `MULTI_SCAM_BURST_STARTED`. The rules decide every transfer: SG-RD-50 holds only protected accounts that
   pass 50%; the other cases are scored and alerted. Nothing is chosen in advance.
3. **The swarm states what it is.** The domain findings are renamed so they cannot overstate:
   - `killSwitchRecommended` replaces `killSwitchEngaged`.
   - `recallRecommendation` replaces a dispatched recall.
   - `draftSummary` (for the analyst) replaces a CAD dossier.
   - `atoSignalPoints` (the rule points behind the finding) replaces a confidence percentage.
   - The scam pattern is matched to the reference's four from the recorded contributions.
   - An agent can no longer recommend releasing a hold.

   The panel, the console, the response schemas and the launcher say the same.
4. **Humans authorise.** In the burst tour the agents recommend kill switches for compromised accounts the gate did not
   hold. The analyst approves them, through the same audited endpoint an analyst's click uses (in the demo, after a
   visible countdown as the demo analyst).

## Consequences

- No rule, curve, weight, threshold or policy version changes. The control path does not import the intelligence
  path; the burst lives in the scenarios module and reaches the swarm through a port (`CaseSwarm`).
- The burst sits inside the live demo (M§6), not a new MVP module.
- The swarm's model-backed version stays unwired. Its instructions (`agent-swarm-instructions.v1.ts`) are not shown
  in the product.
- The UI shows a "Multi-scam burst" button beside "Live demo"; the Settings launcher offers the two real runs.
