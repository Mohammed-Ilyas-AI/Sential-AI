# SENTINEL AI — demo video narration

`SENTINEL-AI_Demo-Video.mp4` (1920×1080, 3:54) is rendered from `SENTINEL-AI_Demo-Video_source.pptx`. Every frame is a capture of the running prototype on synthetic data; the Gemini case summary is a live, grounded model response.

To use your own voice: open the source deck, Slide Show → Record → record each scene's narration (the text below), then File → Export → Create a Video (Full HD, use recorded timings and narrations).

## 1. SENTINEL AI
*On screen:* Rules decide. AI explains. Humans authorize.

A Singapore bank has to hold a transfer that drains more than half of a fifty thousand dollar account within twenty four hours. This is SENTINEL AI: a real-time fraud operations control tower. Here is what that control looks like when it actually works, and when the analyst can see why.

## 2. Normal operations
*On screen:* Live stream across three synthetic institutions

The control tower shows live payment decisions across three participating institutions. Everything here is synthetic. Most transfers are allowed. Seeded background noise scores elevated and never reaches a hold, because a system that alarms on everything proves nothing.

## 3. Pre-transaction decision API
*On screen:* ALLOW or HOLD before the transfer commits

Every transfer calls a pre-transaction decision API, called by our simulator, before it settles. Seven pure rules score it, and a deterministic policy gate decides. No language model is anywhere in this path.

## 4. Rapid-drain gate: HOLD
*On screen:* 65.4% of S$52,000 moved in 24 hours. Gate: 50%

Here is the takeover. A login from an unseen device, a new payee, then rapid transfers. The fourth transfer moves sixty five point four percent of the opening balance in twenty four hours. Rule S G R D fifty fires, and the transfer is held before it settles. The decision trace shows the rule, the evidence and the policy version, as a fact, not a probability.

## 5. Deterministic attribution
*On screen:* Score 95: every point traced to a rule

The investigation workspace opens with the evidence bundle and the score of ninety five, broken down rule by rule. Rapid depletion, new device, new beneficiary, velocity, a suspicious entity relationship and behavioural deviation. The contributions are written once by the engine and never changed.

## 6. AI explains
*On screen:* Gemini on Vertex AI. Advisory only. Every claim cites evidence.

Now the AI explains. Gemini on Vertex AI receives the evidence bundle and returns a structured case summary. Every claim must cite a field in that bundle, or it is removed. Gemini cannot change a score, and it never recommends releasing a hold.

## 7. Network and fund trace
*On screen:* Cross-bank trace with an explicit observed boundary

The network view unfolds across three institutions, with the provenance of every link. Trace funds follows the money out of the account, and stops where observation stops. Cross-bank trace reconstructed from each institution's own events, with an explicit observed boundary. We never invent a hop.

## 8. Humans authorize
*On screen:* Contact customer, kill switch, verified release. All audited.

SENTINEL applies the configured policy automatically. Authorised bank operators manage verification, escalation and exceptions. The analyst records a customer contact, and can switch on an account kill switch with a reason and a second confirmation. Only the customer's verification with the bank lifts it.

## 9. One-click case report
*On screen:* Generated from recorded facts. Edited, signed off, exported as PDF

One click generates the case report from the recorded facts: summary, timeline, risk evidence, interventions and the network. The analyst writes the recommendation and signs off. A signed version can never change, and it exports as a PDF.

## 10. Bank lens and audit
*On screen:* Designed as a multi-tenant platform; demonstrated as a single deployment on synthetic data.

Viewed as another bank, the servers mask that bank's accounts and withhold its transactions, and every refused request is audited. Designed as a multi-tenant platform, demonstrated as a single deployment on synthetic data.

## 11. SENTINEL AI
*On screen:* Detect. Explain. Intervene. Investigate.

Built on Google Cloud: Cloud Run, Pub Sub, Vertex AI Gemini and MongoDB Atlas. Four hundred and five automated tests pass. Rules decide. AI explains. Humans authorize. This is SENTINEL AI.
