import type { RequestHandler } from 'express';
import { actingContext } from '../../tenant-access/presentation/tenant-lens.middleware.js';
import type { AdviseInvestigation } from '../application/advise-investigation.use-case.js';

type AssessmentParameters = { assessmentId: string };

export class InvestigationController {
  constructor(private readonly advisor: AdviseInvestigation) {}

  readonly evidence: RequestHandler<AssessmentParameters> = async (request, response) => {
    response.status(200).json(await this.advisor.evidence(request.params.assessmentId, actingContext(response, 'ANALYST')));
  };

  readonly explain: RequestHandler<AssessmentParameters> = async (request, response) => {
    response.status(200).json(await this.advisor.explain(request.params.assessmentId, actingContext(response, 'ANALYST')));
  };

  readonly summarise: RequestHandler<AssessmentParameters> = async (request, response) => {
    response.status(200).json(await this.advisor.summarise(request.params.assessmentId, actingContext(response, 'ANALYST')));
  };

  readonly customerOutreach: RequestHandler<AssessmentParameters> = async (request, response) => {
    const wording = request.query['draft'] === 'template' ? 'TEMPLATE' : 'DRAFT';
    response.status(200).json(await this.advisor.customerOutreach(request.params.assessmentId, actingContext(response, 'ANALYST'), wording));
  };
}
