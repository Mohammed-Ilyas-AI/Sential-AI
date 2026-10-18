import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, effect, inject, signal } from '@angular/core';
import { Icon } from '../../../../shared/ui/icon/icon';
import { PoliciesFacade, type RuleCategory } from '../../data-access/policies-facade';

type DetailTab = 'overview' | 'conditions' | 'hits' | 'history';

/**
 * The detection ruleset as a library: weight, category and how often each rule fired on the accounts' latest
 * assessments. The detail panel shows the rule's parameters and its actual firings, each with the engine's own
 * detail string. Rules are compiled into sentinel-core: there is nothing to toggle or edit here.
 */
@Component({
  selector: 'sentinel-rule-library',
  imports: [DatePipe, Icon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="library" aria-label="Detection rules">
      <div class="tools">
        <label class="search">
          <sentinel-icon name="search" [size]="16" />
          <input type="search" placeholder="Search rule, code or description…" aria-label="Search rules" [value]="facade.query()" (input)="facade.query.set($any($event.target).value)" />
        </label>
        <div class="chips" role="group" aria-label="Category">
          @for (category of categories; track category) {
            <button type="button" [attr.aria-pressed]="facade.category() === category" (click)="facade.category.set(category)">{{ category === 'ALL' ? 'All' : category }}</button>
          }
        </div>
      </div>
      <ol class="rules">
        @for (rule of facade.visibleRules(); track rule.code) {
          <li>
            <button type="button" [attr.aria-pressed]="facade.selectedCode() === rule.code" (click)="facade.selectedCode.set(rule.code)">
              <span class="id mono">{{ rule.id }}</span>
              <span class="name">
                <b>{{ rule.name }}</b>
                <span>{{ rule.summary }}</span>
              </span>
              <span class="category" [attr.data-category]="rule.category">{{ rule.category }}</span>
              <span class="weight" [attr.aria-label]="rule.maxPoints + ' of ' + facade.maxScore + ' points'">
                <span class="bar"><span [style.width.%]="(rule.maxPoints / facade.maxRulePoints) * 100"></span></span>
                <b class="mono">{{ rule.maxPoints }}</b>
              </span>
              <span class="hits mono">{{ rule.hits.length }}</span>
              <span class="status"><span class="dot"></span>Active</span>
            </button>
          </li>
        } @empty {
          <li class="empty">No rules match.</li>
        }
      </ol>
      <p class="foot">Weights sum to {{ facade.maxScore }} · hits are accounts whose latest assessment fired the rule ({{ facade.accountsScored() }} scored).</p>
    </section>

    <aside class="detail" aria-live="polite">
      @if (facade.selected(); as rule) {
        <header>
          <div>
            <span class="mono code">{{ rule.id }} · {{ rule.code }}</span>
            <h2>{{ rule.name }}</h2>
          </div>
          <span class="active"><span class="dot"></span>Active</span>
        </header>
        <nav class="tabs" role="tablist" aria-label="Rule details">
          <button type="button" role="tab" [attr.aria-selected]="tab() === 'overview'" (click)="tab.set('overview')">Overview</button>
          <button type="button" role="tab" [attr.aria-selected]="tab() === 'conditions'" (click)="tab.set('conditions')">Conditions ({{ rule.parameters.length }})</button>
          <button type="button" role="tab" [attr.aria-selected]="tab() === 'hits'" (click)="tab.set('hits')">Hits ({{ rule.hits.length }})</button>
          <button type="button" role="tab" [attr.aria-selected]="tab() === 'history'" (click)="tab.set('history')">History</button>
        </nav>
        <div class="body sentinel-scroll">
          @switch (tab()) {
            @case ('overview') {
              <p class="summary">{{ rule.summary }}</p>
              <dl>
                <div><dt>Category</dt><dd>{{ rule.category }}</dd></div>
                <div><dt>Maximum points</dt><dd>{{ rule.maxPoints }} of {{ facade.maxScore }}</dd></div>
                <div><dt>Accounts fired on</dt><dd>{{ rule.hits.length }}</dd></div>
                <div><dt>Ruleset</dt><dd class="mono">{{ facade.rulesetVersion }}</dd></div>
                <div><dt>Role</dt><dd>Adds points to the advisory risk score. It never decides ALLOW, HOLD or REJECT.</dd></div>
              </dl>
            }
            @case ('conditions') {
              <ol class="params">
                @for (parameter of rule.parameters; track parameter.name) {
                  <li><span>{{ parameter.name }}</span><b class="mono">{{ parameter.value }}</b></li>
                }
              </ol>
            }
            @case ('hits') {
              <ul class="firings">
                @for (hit of rule.hits; track hit.accountId) {
                  <li>
                    <span class="row"><b class="mono">{{ hit.reference }}</b><span class="pts">+{{ hit.points }}</span></span>
                    <span class="sub">{{ hit.detail }}</span>
                    <span class="sub">{{ hit.at | date: 'd MMM, HH:mm:ss' : 'UTC' }} UTC · decision {{ hit.decision }}</span>
                  </li>
                } @empty {
                  <li class="empty">No account's latest assessment fired this rule.</li>
                }
              </ul>
            }
            @case ('history') {
              <ul class="firings">
                @for (version of facade.versions(); track version.policyVersion + version.rulesetVersion) {
                  <li>
                    <span class="row"><b class="mono">{{ version.rulesetVersion }}</b><span class="sub">{{ version.count }} decisions</span></span>
                    <span class="sub">With policy {{ version.policyVersion }} · {{ version.first | date: 'd MMM HH:mm' : 'UTC' }} → {{ version.last | date: 'd MMM HH:mm' : 'UTC' }} UTC</span>
                  </li>
                } @empty {
                  <li class="empty">No decisions on the tape yet.</li>
                }
              </ul>
            }
          }
        </div>
        <p class="note"><sentinel-icon name="lock" [size]="14" /> Compiled into sentinel-core. A change ships as a new ruleset version, never as an edit here.</p>
      } @else {
        <p class="empty">Select a rule.</p>
      }
    </aside>
  `,
  styleUrl: './rule-library.css',
})
export class RuleLibrary {
  protected readonly facade = inject(PoliciesFacade);
  protected readonly tab = signal<DetailTab>('overview');
  protected readonly categories: readonly ('ALL' | RuleCategory)[] = ['ALL', 'Transaction', 'Device', 'Beneficiary', 'Network', 'Behaviour', 'Account'];

  constructor() {
    effect(() => {
      void this.facade.selectedCode();
      this.tab.set('overview');
    });
  }
}
