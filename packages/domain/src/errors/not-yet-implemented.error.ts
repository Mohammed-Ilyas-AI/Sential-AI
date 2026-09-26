/** Marks a skeleton boundary whose behaviour is scheduled but not built yet. */
export class NotYetImplementedError extends Error {
  constructor(capability: string, reason = 'not built yet') {
    super(`${capability}: ${reason}`);
    this.name = 'NotYetImplementedError';
  }
}
