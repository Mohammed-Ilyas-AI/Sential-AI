/** A function call the model asked for. Untrusted: the name and every argument are validated before use. */
export interface AgentToolInvocation {
  readonly name: string;
  readonly args: Readonly<Record<string, unknown>>;
}

export interface AgentToolOutput {
  readonly name: string;
  readonly response: unknown;
}

/**
 * One turn of the agent conversation, provider-neutral. A MODEL turn carries the provider's own reply verbatim in
 * providerContent, because Gemini 3 requires its reply (thought signatures included) to be sent back unchanged.
 */
export type AgentTurn =
  | { readonly kind: 'TASK'; readonly task: unknown }
  | { readonly kind: 'MODEL'; readonly invocations: readonly AgentToolInvocation[]; readonly providerContent: unknown }
  | { readonly kind: 'TOOL_OUTPUTS'; readonly outputs: readonly AgentToolOutput[] };

export interface AgentStepReply {
  /** Empty when the model answered without calling a tool, which the agent treats as an invalid turn. */
  readonly invocations: readonly AgentToolInvocation[];
  readonly providerContent: unknown;
}

/**
 * The investigation agent's one way to a language model: given the conversation so far, the model must call one or
 * more of the agent's tools. With submitOnly, the only tool it may call is submit_findings. The tool declarations
 * and the instruction are versioned files behind the adapter; this port carries no prompt text.
 */
export interface AgentModelGateway {
  step(turns: readonly AgentTurn[], options: { readonly submitOnly: boolean; readonly signal: AbortSignal }): Promise<AgentStepReply>;
}
