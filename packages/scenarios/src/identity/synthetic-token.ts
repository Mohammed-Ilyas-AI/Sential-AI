/**
 * Deterministic synthetic tokens (FNV-1a), identical to the HTML reference's tok(). Stands in for a bank's
 * tokenisation service: the platform only ever sees these, never the display identifiers.
 */
export function syntheticToken(prefix: 'acct' | 'dev' | 'ben', identifier: string): string {
  let hash = 2_166_136_261;
  for (let index = 0; index < identifier.length; index += 1) {
    hash ^= identifier.charCodeAt(index);
    hash = Math.imul(hash, 16_777_619);
  }
  return `${prefix}_tok_${(hash >>> 0).toString(16).padStart(8, '0')}`;
}
