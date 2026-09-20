# Roadmap to the 18 Oct prototype

Build order, roughly. Each step should end with something demonstrable.

## 1. Foundations
- [x] Monorepo scaffold, configs, CI
- [ ] Shared domain types filled in
- [ ] Synthetic transaction generator (normal behaviour + scam scenarios)

## 2. Detection
- [ ] Rule engine with the first five signals
- [ ] Account baseline (rolling stats per account)
- [ ] Scoring and banding

## 3. Policy
- [ ] Rapid-drain control with configurable thresholds
- [ ] Hold / challenge / allow outcomes with audit trail

## 4. Explanation
- [ ] Vertex AI client
- [ ] Grounded prompt over fired signals only
- [ ] Narrative caching per assessment

## 5. Control tower
- [ ] Live flow view over SSE
- [ ] Case view with signals and narrative
- [ ] Intervention controls
- [ ] Entity graph view

## 6. Submission
- [ ] Deploy to Cloud Run
- [ ] Demo script and scenario data
- [ ] Recorded walkthrough
