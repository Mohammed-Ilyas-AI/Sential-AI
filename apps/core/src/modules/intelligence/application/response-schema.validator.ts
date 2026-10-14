import {
  CASE_SUMMARY_EVIDENCE_MAX_ITEMS,
  CASE_SUMMARY_HYPOTHESIS_MAX_CHARS,
  type CaseSummary,
  type CaseSummaryConfidence,
  type CaseSummaryEvidence,
  type IsoTimestamp,
  type RiskExplanation,
} from '@sentinel/domain';

const CONFIDENCE: readonly CaseSummaryConfidence[] = ['LOW', 'MEDIUM', 'HIGH'];
const MAX_TEXT_CHARS = 600;
const MAX_RECOMMENDED_ACTIONS = 5;
/**
 * The model may not recommend releasing a held transaction (T§7); a response that does is rejected outright.
 * "Do not release before the customer verifies" is a negation, not a recommendation, and passes.
 */
const RECOMMENDS_RELEASE = /(?<!(?:not|never|no|n't)\b[^.;]{0,24})\b(?:release|unhold|un-hold|let (?:it|the (?:transfer|payment)) (?:go|through))/i;

type JsonObject = Readonly<Record<string, unknown>>;

const isObject = (value: unknown): value is JsonObject => typeof value === 'object' && value !== null && !Array.isArray(value);

function parsed(raw: unknown): unknown {
  if (typeof raw !== 'string') return raw;
  try {
    return JSON.parse(raw) as unknown;
  } catch {
    return null;
  }
}

function text(value: unknown, maxChars = MAX_TEXT_CHARS): string | null {
  return typeof value === 'string' && value.trim() !== '' && value.length <= maxChars ? value.trim() : null;
}

function evidenceItem(value: unknown): CaseSummaryEvidence | null {
  if (!isObject(value)) return null;
  const claim = text(value['claim']);
  const sourceField = text(value['sourceField'], 200);
  const cited = value['value'];
  if (!claim || !sourceField || (typeof cited !== 'string' && typeof cited !== 'number' && typeof cited !== 'boolean')) return null;
  return { claim, sourceField, value: String(cited) };
}

/**
 * Structured output is untrusted until it parses and matches the contract exactly. Anything else is rejected;
 * the caller retries once, then falls back to the deterministic attribution.
 */
export class ResponseSchemaValidator {
  caseSummary(raw: unknown): CaseSummary | null {
    const value = parsed(raw);
    if (!isObject(value)) return null;
    const hypothesis = text(value['hypothesis'], CASE_SUMMARY_HYPOTHESIS_MAX_CHARS);
    const confidence = CONFIDENCE.find((candidate) => candidate === value['confidence']);
    const escalate = value['escalate'];
    const evidence = value['evidence'];
    const actions = value['recommendedActions'];
    if (!hypothesis || !confidence || typeof escalate !== 'boolean' || !Array.isArray(evidence) || !Array.isArray(actions)) return null;
    if (evidence.length > CASE_SUMMARY_EVIDENCE_MAX_ITEMS || actions.length > MAX_RECOMMENDED_ACTIONS) return null;

    const items = evidence.map(evidenceItem);
    const recommendedActions = actions.map((action) => text(action));
    if (items.some((item) => item === null) || recommendedActions.some((action) => action === null)) return null;
    if (recommendedActions.some((action) => RECOMMENDS_RELEASE.test(action ?? ''))) return null;
    return {
      hypothesis,
      confidence,
      evidence: items.filter((item): item is CaseSummaryEvidence => item !== null),
      recommendedActions: recommendedActions.filter((action): action is string => action !== null),
      escalate,
    };
  }

  riskExplanation(raw: unknown, assessmentId: string, generatedAt: IsoTimestamp): RiskExplanation | null {
    const value = parsed(raw);
    if (!isObject(value)) return null;
    const primaryReason = text(value['primaryReason']);
    const recommendedAction = text(value['recommendedAction']);
    if (!primaryReason || !recommendedAction || RECOMMENDS_RELEASE.test(recommendedAction)) return null;
    return { assessmentId, primaryReason, recommendedAction, generatedAt };
  }
}
