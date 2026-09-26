import { describe, expect, it } from 'vitest';
import { decisionRecordFixture } from '../../../../../test/support/fixtures/decision-record.fixture.js';
import { interventionFixture } from '../../../../../test/support/fixtures/intervention.fixture.js';
import { fromDecisionDocument, toDecisionDocument } from './decision.serializer.js';
import { withoutStorageFields } from './document-identity.js';
import { fromInterventionDocument, toInterventionDocument } from './intervention.serializer.js';

describe('MongoDB serializers', () => {
  it('stores a decision under its decisionId and restores it unchanged', () => {
    const document = toDecisionDocument(decisionRecordFixture());
    expect(document._id).toBe(decisionRecordFixture().decisionId);
    expect(fromDecisionDocument(document)).toEqual(decisionRecordFixture());
  });

  it('stores an intervention under its id with its ordinal and restores it unchanged', () => {
    const document = toInterventionDocument(interventionFixture(), 0);
    expect(document._id).toBe(interventionFixture().id);
    expect(document.ordinal).toBe(0);
    expect(fromInterventionDocument(document)).toEqual(interventionFixture());
  });

  it('strips storage-only fields generically', () => {
    expect(withoutStorageFields({ _id: 'x', ordinal: 3, value: 1 })).toEqual({ value: 1 });
  });
});
