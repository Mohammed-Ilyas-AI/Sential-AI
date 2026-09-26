import type { Signal } from '@angular/core';
import type { CaseListItem } from '../models/case-list-item';

/** The report is a rendering of recorded facts, reviewed, edited and signed off by the analyst. */
export abstract class CasesFacade {
  abstract readonly cases: Signal<readonly CaseListItem[]>;
  abstract select(caseId: string): void;
}
