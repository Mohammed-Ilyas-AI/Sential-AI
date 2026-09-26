import { type ErrorHandler, Injectable } from '@angular/core';

@Injectable()
export class SentinelErrorHandler implements ErrorHandler {
  handleError(error: unknown): void {
    console.error('[sentinel-ui]', error);
  }
}
