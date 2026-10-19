import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { Store } from '@ngrx/store';
import { beforeEach, describe, expect, it } from 'vitest';
import { provideTestStore } from '../../../testing/provide-test-store';
import { demoAlert, demoFinalDecision, demoHold } from '../../../testing/ui-fixtures';
import { LOCAL_RUNTIME_CONFIG, provideRuntimeConfig } from '../../core/config/runtime-config';
import { AlertsActions } from '../../state/alerts/alerts.actions';
import { InterventionsActions } from '../../state/interventions/interventions.actions';
import { TransactionsActions } from '../../state/transactions/transactions.actions';
import { Shell } from './shell';
import { ShellState } from './shell-state';

async function render(): Promise<{ host: HTMLElement; settle: () => Promise<void> }> {
  const fixture = TestBed.createComponent(Shell);
  await fixture.whenStable();
  return { host: fixture.nativeElement as HTMLElement, settle: () => fixture.whenStable() };
}

const press = (key: string, modifiers: KeyboardEventInit = {}): void => {
  document.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, ...modifiers }));
};

describe('Shell', () => {
  beforeEach(async () => {
    localStorage.clear();
    await TestBed.configureTestingModule({
      imports: [Shell],
      providers: [provideRouter([]), provideTestStore(), provideRuntimeConfig(LOCAL_RUNTIME_CONFIG)],
    }).compileComponents();
  });

  it('frames every destination: top bar, twelve-item rail, mobile bar and content frame', async () => {
    const { host } = await render();
    expect(host.querySelector('sentinel-top-bar')).not.toBeNull();
    expect(host.querySelector('main#sentinel-main')).not.toBeNull();
    expect(host.querySelectorAll('sentinel-sidebar .item')).toHaveLength(12);
    expect(host.querySelector('sentinel-top-bar input, sentinel-top-bar .search')).toBeNull();
    expect(host.querySelector('sentinel-logo img')?.getAttribute('src')).toBe('brand/sentinel-logo.webp');
    // The only demo wording in the top bar is the one-click live demo button.
    const topBar = (host.querySelector('sentinel-top-bar')?.textContent ?? '').replace(host.querySelector('sentinel-live-demo-button')?.textContent ?? '', '');
    expect(topBar).not.toMatch(/synthetic|demo/i);
    expect(host.querySelector('sentinel-top-bar sentinel-live-demo-button button')?.textContent).toContain('Live demo');
    expect(host.querySelectorAll('sentinel-top-bar sentinel-icon[name="settings"]')).toHaveLength(1);
    expect(host.querySelector('sentinel-top-bar .mode')?.tagName).not.toBe('BUTTON');
    expect(host.querySelectorAll('sentinel-mobile-bottom-bar .tab')).toHaveLength(5);
    expect(host.querySelector('sentinel-logo img')?.getAttribute('alt')).toContain('SENTINEL AI');
  });

  it('opens the command palette on Ctrl+K and closes it on Escape', async () => {
    const { host, settle } = await render();
    press('k', { ctrlKey: true });
    await settle();
    expect(host.querySelector('sentinel-command-palette')).not.toBeNull();
    press('Escape');
    await settle();
    expect(host.querySelector('sentinel-command-palette')).toBeNull();
  });

  it('collapses the rail from its single top-bar toggle, remembers the choice, and toggles it with Ctrl+B', async () => {
    const { host, settle } = await render();
    const state = TestBed.inject(ShellState);
    const expandedBefore = state.sidebarExpanded();
    const toggles = host.querySelectorAll('sentinel-top-bar .toggle.desktop-only');
    expect(toggles).toHaveLength(1);
    expect(host.querySelector('sentinel-sidebar button[aria-expanded]')).toBeNull();
    (toggles[0] as HTMLButtonElement).click();
    await settle();
    expect(state.sidebarExpanded()).toBe(!expandedBefore);
    expect(host.classList.contains('rail-collapsed')).toBe(expandedBefore);
    expect(localStorage.getItem('sentinel.shell.sidebarExpanded')).toBe(String(!expandedBefore));
    press('b', { ctrlKey: true });
    await settle();
    expect(state.sidebarExpanded()).toBe(expandedBefore);
  });

  it('opens Settings from the top-bar gear and keeps the analyst menu to profile actions', async () => {
    const { host, settle } = await render();
    (host.querySelector('sentinel-top-bar .gear') as HTMLButtonElement).click();
    await settle();
    expect(host.querySelector('sentinel-settings-panel')).not.toBeNull();
    expect(host.querySelector('sentinel-top-bar .gear')?.getAttribute('aria-expanded')).toBe('true');

    (host.querySelector('sentinel-top-bar .profile') as HTMLButtonElement).click();
    await settle();
    const items = [...host.querySelectorAll('sentinel-user-menu [role="menuitem"]')].map((item) => item.textContent?.trim());
    expect(items).toEqual(['Focus mode']);
  });

  it('switches appearance and bank lens from Settings, labelled as synthetic demo themes', async () => {
    const { host, settle } = await render();
    (host.querySelector('sentinel-top-bar .gear') as HTMLButtonElement).click();
    await settle();
    const appearance = host.querySelector('sentinel-appearance-settings') as HTMLElement;
    const radio = (label: string) =>
      [...appearance.querySelectorAll<HTMLButtonElement>('[role="radio"]')].find((button) => button.textContent?.includes(label));

    radio('Light')?.click();
    radio('Bank B')?.click();
    await settle();
    const root = document.documentElement;
    expect([root.getAttribute('data-appearance'), root.getAttribute('data-tenant-theme')]).toEqual(['light', 'bank-b']);
    expect(radio('Bank B')?.getAttribute('aria-checked')).toBe('true');
    expect(appearance.textContent).toContain('Harbour Teal · synthetic');
    expect(appearance.textContent).toContain('synthetic demo themes, not real institutions');
    expect(host.querySelector('sentinel-logo img')?.getAttribute('alt')).toContain('SENTINEL AI');

    radio('Dark')?.click();
    radio('SENTINEL AI')?.click();
    await settle();
    expect(root.hasAttribute('data-appearance') || root.hasAttribute('data-tenant-theme')).toBe(false);
  });

  it('shows one overlay at a time', async () => {
    const { host, settle } = await render();
    const state = TestBed.inject(ShellState);
    state.open('notifications');
    await settle();
    expect(host.querySelector('sentinel-notification-panel')).not.toBeNull();
    state.open('settings');
    await settle();
    expect(host.querySelector('sentinel-notification-panel')).toBeNull();
    expect(host.querySelector('sentinel-settings-panel')).not.toBeNull();
  });

  it('badges unread operational events and clears them on "Mark all read"', async () => {
    const store = TestBed.inject(Store);
    store.dispatch(TransactionsActions.snapshotLoaded({ decisions: [demoFinalDecision()], cursor: 'c1' }));
    store.dispatch(AlertsActions.snapshotLoaded({ alerts: [demoAlert()] }));
    store.dispatch(InterventionsActions.snapshotLoaded({ interventions: [demoHold()] }));
    const { host, settle } = await render();
    expect(host.querySelector('sentinel-top-bar .badge')?.textContent?.trim()).toBe('4');
    expect(host.querySelector('sentinel-sidebar .badge')?.textContent?.trim()).toBe('1');

    TestBed.inject(ShellState).open('notifications');
    await settle();
    const titles = [...host.querySelectorAll('sentinel-notification-panel .title')].map((title) => title.textContent);
    expect(titles).toEqual(['High-risk transaction held', 'Rapid drain pattern', 'Critical risk alert', 'Network relationship flagged']);
    // Clicking a notification marks only that one read and stays put.
    (host.querySelector('sentinel-notification-panel li button') as HTMLButtonElement).click();
    await settle();
    expect(host.querySelector('sentinel-top-bar .badge')?.textContent?.trim()).toBe('3');
    expect(host.querySelector('sentinel-notification-panel')).not.toBeNull();
    (host.querySelector('sentinel-notification-panel header button') as HTMLButtonElement).click();
    await settle();
    expect(host.querySelector('sentinel-top-bar .badge')).toBeNull();
  });
});
