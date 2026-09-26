import type { Signal } from '@angular/core';
import type { InvestigationView } from '../models/investigation-view';

export abstract class InvestigationsFacade {
  abstract readonly view: Signal<InvestigationView | null>;
  abstract investigate(alertId: string): void;
}
