import { createFeature, createReducer } from '@ngrx/store';
import type { CaseListItem } from '../models/case-list-item';

export interface CasesState {
  readonly cases: readonly CaseListItem[];
  readonly selectedCaseId: string | null;
}

const initialCasesState: CasesState = { cases: [], selectedCaseId: null };

export const casesFeature = createFeature({
  name: 'cases',
  reducer: createReducer(initialCasesState),
});
