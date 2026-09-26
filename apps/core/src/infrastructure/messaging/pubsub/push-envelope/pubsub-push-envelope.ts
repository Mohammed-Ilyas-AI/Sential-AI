export interface DecodedPushMessage {
  readonly messageId: string;
  /** The Pub/Sub ordering key; for transaction events it is the sourceAccountToken. */
  readonly orderingKey?: string;
  readonly attributes: Readonly<Record<string, string>>;
  readonly data: unknown;
}

export type PushEnvelopeResult =
  | { readonly valid: true; readonly message: DecodedPushMessage }
  | { readonly valid: false; readonly problem: string };

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const invalid = (problem: string): PushEnvelopeResult => ({ valid: false, problem });

/** Decodes a Pub/Sub push body ({ message: { data, attributes, messageId, orderingKey }, subscription }). */
export function decodePushEnvelope(body: unknown): PushEnvelopeResult {
  if (!isRecord(body) || !isRecord(body['message'])) return invalid('missing message');
  const message = body['message'];
  const data = message['data'];
  const messageId = message['messageId'];
  if (typeof data !== 'string' || typeof messageId !== 'string') return invalid('missing data or messageId');

  let decoded: unknown;
  try {
    decoded = JSON.parse(Buffer.from(data, 'base64').toString('utf8'));
  } catch {
    return invalid('data is not base64-encoded JSON');
  }

  const rawAttributes = isRecord(message['attributes']) ? message['attributes'] : {};
  const attributes = Object.fromEntries(
    Object.entries(rawAttributes).filter((entry): entry is [string, string] => typeof entry[1] === 'string'),
  );
  const orderingKey = message['orderingKey'];
  return {
    valid: true,
    message: {
      messageId,
      attributes,
      data: decoded,
      ...(typeof orderingKey === 'string' && orderingKey !== '' ? { orderingKey } : {}),
    },
  };
}
