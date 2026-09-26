import { Pipe, type PipeTransform } from '@angular/core';
import type { InstitutionId } from '@sentinel/domain';

/** BANK_A → "Bank A". Synthetic institutions only; never a real bank's name or mark. */
@Pipe({ name: 'institutionLabel' })
export class InstitutionLabelPipe implements PipeTransform {
  transform(institutionId: InstitutionId): string {
    const synthetic = /^BANK_([A-Z])$/.exec(institutionId);
    return synthetic ? `Bank ${synthetic[1]}` : institutionId;
  }
}
