import { Pipe, type PipeTransform } from '@angular/core';
import type { MinorUnits } from '@sentinel/domain';

const DOLLAR_GROUPING = new Intl.NumberFormat('en-SG', { maximumFractionDigits: 0 });

/** Formats integer SGD cents as S$ with no floating-point arithmetic on the amount. */
@Pipe({ name: 'minorUnitsCurrency' })
export class MinorUnitsCurrencyPipe implements PipeTransform {
  transform(amount: MinorUnits): string {
    const sign = amount < 0 ? '-' : '';
    const absolute = Math.abs(amount);
    const dollars = Math.trunc(absolute / 100);
    const cents = absolute % 100;
    return `${sign}S$${DOLLAR_GROUPING.format(dollars)}.${String(cents).padStart(2, '0')}`;
  }
}
