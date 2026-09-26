import { describe, expect, it } from 'vitest';
import { interventionFixture } from '../../../../../test/support/fixtures/intervention.fixture.js';
import { decisionRecordFixture } from '../../../../../test/support/fixtures/decision-record.fixture.js';
import { fromDecisionDocument, toDecisionDocument } from './decision.serializer.js';
import { fromInterventionDocument, toInterventionDocument } from './intervention.serializer.js';

describe('MongoDB serializers', () => {
  it('stores a decision under its decisionId and restores it unchanged', () => {
    const document = toDecisionDocument(decisionRecordFixture());
    expect(document._id).toBe(decisionRecordFixture().decisionId);
    expect(fromDecisionDocument(document)).toEqual(decisionRecordFixture());
  });

  it('stores an intervention under its id and restores it unchanged', () => {
    const document = toInterventionDocument(interventionFixture());
    expect(document._id).toBe(interventionFixture().id);
    expect(fromInterventionDocument(document)).toEqual(interventionFixture());
  });
});
