import type { RequestHandler } from 'express';
import type { AdviseInvestigation } from '../application/advise-investigation.use-case.js';

type AssessmentParameters = { assessmentId: string };

export class InvestigationController {
  constructor(private readonly advisor: AdviseInvestigation) {}

  readonly evidence: RequestHandler<AssessmentParameters> = async (request, response) => {
    response.status(200).json(await this.advisor.evidence(request.params.assessmentId));
  };

  readonly explain: RequestHandler<AssessmentParameters> = async (request, response) => {
    response.status(200).json(await this.advisor.explain(request.params.assessmentId));
  };

  readonly summarise: RequestHandler<AssessmentParameters> = async (request, response) => {
    response.status(200).json(await this.advisor.summarise(request.params.assessmentId));
  };

  readonly investigate: RequestHandler<AssessmentParameters> = async (request, response) => {
    response.status(200).json(await this.advisor.investigate(request.params.assessmentId));
  };
}
