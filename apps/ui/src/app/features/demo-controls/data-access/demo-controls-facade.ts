import type { Signal } from '@angular/core';

/** Demo-only controls, always labelled as such. The one-button scenario trigger is a later decision. */
export abstract class DemoControlsFacade {
  abstract readonly timeCompressionEnabled: Signal<boolean>;
  abstract readonly geminiOutageSimulated: Signal<boolean>;
  abstract setGeminiOutage(simulated: boolean): void;
}
