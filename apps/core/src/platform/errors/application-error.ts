export type ApplicationErrorKind = 'NOT_FOUND' | 'CONFLICT' | 'UNPROCESSABLE' | 'UNAUTHORISED' | 'FORBIDDEN';

/** A failure the caller can act on. The HTTP edge maps the kind to a status; the application never sees HTTP. */
export class ApplicationError extends Error {
  constructor(
    readonly kind: ApplicationErrorKind,
    message: string,
  ) {
    super(message);
    this.name = 'ApplicationError';
  }
}
