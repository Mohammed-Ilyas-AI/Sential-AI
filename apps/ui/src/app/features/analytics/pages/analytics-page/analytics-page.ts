import { DecimalPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { InstitutionLabelPipe } from '../../../../shared/pipes/institution-label/institution-label-pipe';
import { MinorUnitsCurrencyPipe } from '../../../../shared/pipes/minor-units-currency/minor-units-currency-pipe';
import { Icon } from '../../../../shared/ui/icon/icon';
import { RiskDonut } from '../../components/risk-donut/risk-donut';
import { VolumeChart } from '../../components/volume-chart/volume-chart';
import { AnalyticsFacade, type Range, type ReportDefinition } from '../../data-access/analytics-facade';

/**
 * Analytics & Reports (M§5): trends and extracts over what the live stream has delivered, filtered by time and
 * bank. Charts and reports read the same records, so a figure on screen always matches its download.
 */
@Component({
  selector: 'sentinel-analytics-page',
  imports: [DecimalPipe, Icon, InstitutionLabelPipe, MinorUnitsCurrencyPipe, RiskDonut, VolumeChart, RouterLink],
  providers: [AnalyticsFacade],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './analytics-page.html',
  styleUrl: './analytics-page.css',
})
export class AnalyticsPage {
  protected readonly facade = inject(AnalyticsFacade);
  protected readonly ranges: readonly { readonly value: Range; readonly label: string }[] = [
    { value: 'ALL', label: 'Everything on the tape' },
    { value: '1H', label: 'Last hour' },
    { value: '24H', label: 'Last 24 hours' },
    { value: '7D', label: 'Last 7 days' },
  ];

  protected download(report: ReportDefinition['id']): void {
    const blob = new Blob([this.facade.reportCsv(report)], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `sentinel-${report}-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }
}
