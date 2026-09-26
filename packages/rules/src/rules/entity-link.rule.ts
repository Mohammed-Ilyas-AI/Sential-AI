import { ENTITY_LINK_POINTS, LINKAGE_SCORING, RULE_LABELS, RULE_MAX_POINTS } from '@sentinel/domain';
import { clampPoints } from '../risk-engine/contribution-formatting.js';
import type { RiskRule } from '../risk-engine/risk-rule.js';

/**
 * Per flagged entity within two hops: 3 points via confirmed links (DIRECT, NETWORK_REFERENCE), 2 via
 * NETWORK_TOKEN, 0 via CORRELATED or UNOBSERVED (shown in the graph, never scored). Capped at 9.
 */
export const entityLinkRule: RiskRule = {
  code: 'ENTITY_LINK',
  maxPoints: RULE_MAX_POINTS.ENTITY_LINK,
  evaluate(_transaction, _account, { features }) {
    const links = features.flaggedLinks;
    if (links.length === 0) return null;
    let total = 0;
    let confirmed = 0;
    let strong = 0;
    let unscored = 0;
    for (const linkage of links) {
      const points = ENTITY_LINK_POINTS[LINKAGE_SCORING[linkage]];
      total += points;
      if (points === ENTITY_LINK_POINTS.CONFIRMED) confirmed += 1;
      else if (points === ENTITY_LINK_POINTS.STRONG) strong += 1;
      else unscored += 1;
    }
    const points = clampPoints(total, this.maxPoints);
    if (points === 0) return null;
    const parts = [
      confirmed > 0 ? `${confirmed} flagged via confirmed links` : '',
      strong > 0 ? `${strong} via network device token` : '',
      unscored > 0 ? `${unscored} candidate not scored` : '',
    ].filter((part) => part !== '');
    return { code: this.code, label: RULE_LABELS.ENTITY_LINK, points, detail: parts.join(', ') };
  },
};
