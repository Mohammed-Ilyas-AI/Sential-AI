import type { ValidationResult } from '../middleware/request-validation.middleware.js';

export type JsonObject = Readonly<Record<string, unknown>>;

export const isJsonObject = (value: unknown): value is JsonObject =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const UTC_ISO_TIMESTAMP = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,3})?Z$/;
const RAW_ACCOUNT_NUMBER = /^[\d\s-]{8,}$/;

/**
 * Reads typed fields from an untrusted body and collects every problem, so a client sees them all at once.
 * Invalid fields yield placeholders; callers only use the value when there are no problems.
 */
export class FieldReader {
  constructor(
    private readonly source: JsonObject,
    private readonly problems: string[],
    private readonly prefix = '',
  ) {}

  static forBody(body: unknown): { readonly reader: FieldReader; readonly problems: string[] } {
    const problems: string[] = [];
    if (!isJsonObject(body)) problems.push('body must be a JSON object');
    return { reader: new FieldReader(isJsonObject(body) ? body : {}, problems), problems };
  }

  string(field: string): string {
    const value = this.source[field];
    if (typeof value === 'string' && value.trim() !== '') return value;
    this.fail(field, 'a non-empty string');
    return '';
  }

  optionalString(field: string): string | undefined {
    return this.source[field] === undefined ? undefined : this.string(field);
  }

  /** A synthetic token: never something that looks like a raw account number. */
  token(field: string): string {
    const value = this.string(field);
    if (RAW_ACCOUNT_NUMBER.test(value)) this.fail(field, 'a token, never a raw account number');
    return value;
  }

  optionalToken(field: string): string | undefined {
    return this.source[field] === undefined ? undefined : this.token(field);
  }

  literal<TValue extends string>(field: string, expected: TValue): TValue {
    if (this.source[field] !== expected) this.fail(field, `"${expected}"`);
    return expected;
  }

  oneOf<TValue extends string>(field: string, allowed: readonly TValue[]): TValue {
    const value = this.source[field];
    const match = allowed.find((candidate) => candidate === value);
    if (match !== undefined) return match;
    this.fail(field, `one of ${allowed.join(', ')}`);
    return allowed[0] as TValue;
  }

  /** Integer minor units; money is never a float. */
  minorUnits(field: string, options: { readonly positive?: boolean } = {}): number {
    const value = this.source[field];
    const minimum = options.positive ? 1 : 0;
    if (typeof value === 'number' && Number.isSafeInteger(value) && value >= minimum) return value;
    this.fail(field, `an integer amount in minor units${options.positive ? ' greater than zero' : ''}`);
    return 0;
  }

  integer(field: string, minimum: number): number {
    const value = this.source[field];
    if (typeof value === 'number' && Number.isSafeInteger(value) && value >= minimum) return value;
    this.fail(field, `an integer of at least ${minimum}`);
    return minimum;
  }

  number(field: string, minimum: number): number {
    const value = this.source[field];
    if (typeof value === 'number' && Number.isFinite(value) && value >= minimum) return value;
    this.fail(field, `a number of at least ${minimum}`);
    return minimum;
  }

  boolean(field: string): boolean {
    const value = this.source[field];
    if (typeof value === 'boolean') return value;
    this.fail(field, 'a boolean');
    return false;
  }

  /** UTC ISO 8601, normalised to millisecond precision so stored timestamps compare correctly. */
  timestamp(field: string): string {
    const value = this.source[field];
    if (typeof value === 'string' && UTC_ISO_TIMESTAMP.test(value) && !Number.isNaN(Date.parse(value))) {
      return new Date(value).toISOString();
    }
    this.fail(field, 'a UTC ISO 8601 timestamp ending in Z');
    return new Date(0).toISOString();
  }

  optionalTimestamp(field: string): string | undefined {
    return this.source[field] === undefined ? undefined : this.timestamp(field);
  }

  tokenArray(field: string): string[] {
    const value = this.source[field];
    if (!Array.isArray(value)) {
      this.fail(field, 'an array of tokens');
      return [];
    }
    return value.map((_item, index) => new FieldReader({ [index]: value[index] }, this.problems, `${this.at(field)}.`).token(String(index)));
  }

  object(field: string): FieldReader {
    const value = this.source[field];
    if (!isJsonObject(value)) this.fail(field, 'an object');
    return new FieldReader(isJsonObject(value) ? value : {}, this.problems, `${this.at(field)}.`);
  }

  objectArray(field: string): FieldReader[] {
    const value = this.source[field];
    if (!Array.isArray(value)) {
      this.fail(field, 'an array');
      return [];
    }
    return value.map((item, index) => {
      if (!isJsonObject(item)) this.problems.push(`${this.at(field)}[${index}] must be an object`);
      return new FieldReader(isJsonObject(item) ? item : {}, this.problems, `${this.at(field)}[${index}].`);
    });
  }

  addProblem(problem: string): void {
    this.problems.push(problem);
  }

  /** A cross-field rule failed for `field`; reported with this reader's path like any other problem. */
  reject(field: string, expectation: string): void {
    this.fail(field, expectation);
  }

  private at(field: string): string {
    return `${this.prefix}${field}`;
  }

  private fail(field: string, expectation: string): void {
    this.problems.push(`${this.at(field)} must be ${expectation}`);
  }
}

export function toValidationResult<TValue>(problems: readonly string[], value: TValue): ValidationResult<TValue> {
  return problems.length > 0 ? { valid: false, problems } : { valid: true, value };
}
