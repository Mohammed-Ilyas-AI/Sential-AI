import { randomUUID } from 'node:crypto';

/** Joins logs, events and audit for one request. */
export type TraceId = string;

const ACCEPTABLE_TRACE_ID = /^[A-Za-z0-9-]{8,64}$/;

export function resolveTraceId(incoming: string | undefined): TraceId {
  return incoming && ACCEPTABLE_TRACE_ID.test(incoming) ? incoming : randomUUID();
}
