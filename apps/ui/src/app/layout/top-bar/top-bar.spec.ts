import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { beforeEach, describe, expect, it } from 'vitest';
import { provideTestStore } from '../../../testing/provide-test-store';
import { LOCAL_RUNTIME_CONFIG, provideRuntimeConfig } from '../../core/config/runtime-config';
import { TopBar } from './top-bar';

@Component({ selector: 'sentinel-test-page', template: '' })
class TestPage {}

describe('TopBar logo', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TopBar],
      providers: [
        // The application's own shape: '' redirects to the Control Tower.
        provideRouter([
          { path: '', pathMatch: 'full', redirectTo: 'control-tower' },
          { path: 'control-tower', component: TestPage },
          { path: 'investigations', component: TestPage },
          { path: 'alerts', component: TestPage },
        ]),
        provideTestStore(),
        provideRuntimeConfig(LOCAL_RUNTIME_CONFIG),
      ],
    }).compileComponents();
  });

  it('is a keyboard-reachable link named "SENTINEL AI home" around the unchanged artwork', async () => {
    const fixture = TestBed.createComponent(TopBar);
    await fixture.whenStable();
    const link = (fixture.nativeElement as HTMLElement).querySelector('a.home') as HTMLAnchorElement;
    expect(link.getAttribute('aria-label')).toBe('SENTINEL AI home');
    expect(link.getAttribute('href')).toBe('/');
    expect(link.querySelector('sentinel-logo img')?.getAttribute('src')).toBe('brand/sentinel-logo.webp');
  });

  it('takes the analyst home to the Control Tower from any page, in the app, without a reload', async () => {
    const router = TestBed.inject(Router);
    const fixture = TestBed.createComponent(TopBar);
    for (const page of ['/investigations', '/alerts']) {
      await router.navigateByUrl(page);
      await fixture.whenStable();
      const link = (fixture.nativeElement as HTMLElement).querySelector('a.home') as HTMLAnchorElement;
      const click = new MouseEvent('click', { bubbles: true, cancelable: true, button: 0 });
      link.dispatchEvent(click);
      await fixture.whenStable();
      expect(click.defaultPrevented).toBe(true); // the router handled it; the browser did not load a page
      expect(router.url).toBe('/control-tower');
    }
  });
});
