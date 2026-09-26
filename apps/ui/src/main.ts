import { bootstrapApplication } from '@angular/platform-browser';
import { App } from './app/app';
import { appConfigFor } from './app/app.config';
import { loadRuntimeConfig } from './app/core/config/runtime-config';

loadRuntimeConfig()
  .then((runtimeConfig) => bootstrapApplication(App, appConfigFor(runtimeConfig)))
  .catch((error: unknown) => console.error(error));
