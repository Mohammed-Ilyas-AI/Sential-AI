import type { RequestHandler } from 'express';
import { validatedBodyOf } from '../../../api/middleware/request-validation.middleware.js';
import { ApplicationError } from '../../../platform/errors/application-error.js';
import { actingContext } from '../../tenant-access/presentation/tenant-lens.middleware.js';
import type { CaseReports, ManageCase } from '../application/manage-case.use-case.js';
import type { AnalystBody, EditReportBody, OpenCaseBody, RevisionBody, SignOffReportBody } from './case.validators.js';

type CaseParameters = { caseId: string };
type VersionParameters = { caseId: string; version: string };

const statusFor = (outcome: 'CREATED' | 'DUPLICATE'): number => (outcome === 'CREATED' ? 201 : 200);

export class CaseController {
  constructor(private readonly cases: ManageCase & CaseReports) {}

  readonly list: RequestHandler = async (request, response) => {
    const rawLimit = request.query['limit'];
    const limit = rawLimit === undefined ? 100 : Number(rawLimit);
    if (!Number.isInteger(limit) || limit < 1 || limit > 200) {
      response.status(400).json({ error: 'invalid_request', problems: [{ field: 'limit', problem: 'must be an integer from 1 to 200' }] });
      return;
    }
    const context = actingContext(response, 'ANALYST');
    response.status(200).json({ cases: await this.cases.list(context, limit), limit });
  };

  readonly open: RequestHandler = async (_request, response) => {
    const body = validatedBodyOf<OpenCaseBody>(response);
    const written = await this.cases.openFromAlert(actingContext(response, 'ANALYST', body.analystIdentity), body.alertId);
    response.status(statusFor(written.outcome)).json(written);
  };

  readonly get: RequestHandler<CaseParameters> = async (request, response) => {
    response.status(200).json(await this.cases.get(actingContext(response, 'ANALYST'), request.params.caseId));
  };

  readonly escalate: RequestHandler<CaseParameters> = async (request, response) => {
    const body = validatedBodyOf<AnalystBody>(response);
    response.status(200).json(await this.cases.escalate(actingContext(response, 'ANALYST', body.analystIdentity), request.params.caseId));
  };

  readonly generateReport: RequestHandler<CaseParameters> = async (request, response) => {
    const body = validatedBodyOf<AnalystBody>(response);
    const written = await this.cases.generate(actingContext(response, 'ANALYST', body.analystIdentity), request.params.caseId);
    response.status(statusFor(written.outcome)).json(written);
  };

  readonly report: RequestHandler<CaseParameters> = async (request, response) => {
    response.status(200).json(await this.cases.report(actingContext(response, 'ANALYST'), request.params.caseId));
  };

  readonly editReport: RequestHandler<VersionParameters> = async (request, response) => {
    const body = validatedBodyOf<EditReportBody>(response);
    response.status(200).json(
      await this.cases.editDraft(
        actingContext(response, 'ANALYST', body.analystIdentity),
        request.params.caseId,
        this.version(request.params.version),
        body.expectedRevision,
        body.edits,
      ),
    );
  };

  readonly signOff: RequestHandler<VersionParameters> = async (request, response) => {
    const body = validatedBodyOf<SignOffReportBody>(response);
    response.status(200).json(
      await this.cases.signOff(
        actingContext(response, 'ANALYST', body.analystIdentity),
        request.params.caseId,
        this.version(request.params.version),
        body.expectedRevision,
      ),
    );
  };

  readonly startRevision: RequestHandler<CaseParameters> = async (request, response) => {
    const body = validatedBodyOf<RevisionBody>(response);
    response.status(201).json(
      await this.cases.startRevision(actingContext(response, 'ANALYST', body.analystIdentity), request.params.caseId, body.fromVersion),
    );
  };

  readonly exportReport: RequestHandler<VersionParameters> = async (request, response) => {
    const document = await this.cases.export(actingContext(response, 'ANALYST'), request.params.caseId, this.version(request.params.version));
    response
      .status(200)
      .type(document.contentType)
      .setHeader('Content-Disposition', `attachment; filename="${document.fileName}"`)
      .send(Buffer.from(document.bytes));
  };

  private version(raw: string): number {
    const version = Number(raw);
    if (!Number.isSafeInteger(version) || version < 1) throw new ApplicationError('UNPROCESSABLE', 'Report version must be a positive integer');
    return version;
  }
}
