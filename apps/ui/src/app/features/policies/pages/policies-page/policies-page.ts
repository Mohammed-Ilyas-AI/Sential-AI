import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { Icon } from '../../../../shared/ui/icon/icon';
import { PolicyPanels } from '../../components/policy-panels/policy-panels';
import { RuleLibrary } from '../../components/rule-library/rule-library';
import { PoliciesFacade, type Tab } from '../../data-access/policies-facade';

/**
 * Policies & Rules (M§5): the deterministic ruleset and the SG-RD-50 policy gate as sentinel-core runs them, with
 * how often each fired. Read-only by design: rules and thresholds change only as a new published version.
 */
@Component({
  selector: 'sentinel-policies-page',
  imports: [Icon, RuleLibrary, PolicyPanels],
  providers: [PoliciesFacade],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './policies-page.html',
  styleUrl: './policies-page.css',
})
export class PoliciesPage {
  protected readonly facade = inject(PoliciesFacade);
  protected readonly tabs: readonly { readonly id: Tab; readonly label: string }[] = [
    { id: 'rules', label: 'Detection rules' },
    { id: 'gate', label: 'Policy gate' },
    { id: 'logic', label: 'Decision logic' },
    { id: 'versions', label: 'Versions' },
  ];

  protected export(): void {
    const blob = new Blob([this.facade.exportCsv()], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `sentinel-ruleset-${this.facade.rulesetVersion}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }
}
