import type { CaseReportSectionId } from '@sentinel/domain';
import type { RequestBodyValidator } from '../../../api/middleware/request-validation.middleware.js';
import { FieldReader, toValidationResult } from '../../../api/validation/field-reader.js';

const SECTION_IDS: readonly CaseReportSectionId[] = ['SUMMARY', 'TIMELINE', 'EVIDENCE', 'INTERVENTIONS', 'NETWORK', 'RECOMMENDATION'];

export interface OpenCaseBody {
  readonly alertId: string;
  readonly analystIdentity: string;
}

export const openCaseValidator: RequestBodyValidator<OpenCaseBody> = (body) => {
  const { reader, problems } = FieldReader.forBody(body);
  return toValidationResult(problems, { alertId: reader.string('alertId'), analystIdentity: reader.string('analystIdentity') });
};

export interface AnalystBody {
  readonly analystIdentity: string;
}

export const analystValidator: RequestBodyValidator<AnalystBody> = (body) => {
  const { reader, problems } = FieldReader.forBody(body);
  return toValidationResult(problems, { analystIdentity: reader.string('analystIdentity') });
};

export interface EditReportBody extends AnalystBody {
  readonly expectedRevision: number;
  readonly edits: readonly { readonly id: CaseReportSectionId; readonly body: string }[];
}

export const editReportValidator: RequestBodyValidator<EditReportBody> = (body) => {
  const { reader, problems } = FieldReader.forBody(body);
  const expectedRevision = reader.integer('expectedRevision', 1);
  const edits = reader.objectArray('edits').map((item, index) => {
    const id = item.oneOf('id', SECTION_IDS);
    const text = item.string('body');
    if (text.trim() === '' || text.length > 8_000) item.addProblem(`edits[${index}].body must contain 1 to 8000 characters`);
    return { id, body: text };
  });
  return toValidationResult(problems, {
    analystIdentity: reader.string('analystIdentity'),
    expectedRevision,
    edits,
  });
};

export interface SignOffReportBody extends AnalystBody {
  readonly expectedRevision: number;
}

export const signOffReportValidator: RequestBodyValidator<SignOffReportBody> = (body) => {
  const { reader, problems } = FieldReader.forBody(body);
  return toValidationResult(problems, {
    analystIdentity: reader.string('analystIdentity'),
    expectedRevision: reader.integer('expectedRevision', 1),
  });
};

export interface RevisionBody extends AnalystBody {
  readonly fromVersion: number;
}

export const revisionValidator: RequestBodyValidator<RevisionBody> = (body) => {
  const { reader, problems } = FieldReader.forBody(body);
  return toValidationResult(problems, { analystIdentity: reader.string('analystIdentity'), fromVersion: reader.integer('fromVersion', 1) });
};
