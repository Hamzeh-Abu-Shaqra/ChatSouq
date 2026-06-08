export type ChatRole = "system" | "user" | "assistant";

export interface ChatMessage {
  role: ChatRole;
  content: string;
}

export interface CompletionRequest {
  system?: string;
  messages: ChatMessage[];
  temperature?: number;
  maxTokens?: number;
  /** Ask the provider to return strict JSON (the engine still validates it). */
  json?: boolean;
}

export interface CompletionResult {
  text: string;
  provider: string;
  model?: string;
}

/**
 * Provider-agnostic AI surface. Feature code MUST go through this interface —
 * never import a vendor SDK directly. Claude is the primary implementation;
 * OpenAI/Gemini can be added without touching the engine.
 */
export interface AIProvider {
  readonly name: string;
  /** True for the keyless deterministic provider — engine uses templates instead of LLM prose. */
  readonly isMock: boolean;
  complete(req: CompletionRequest): Promise<CompletionResult>;
}

export interface Embedder {
  readonly name: string;
  readonly dimensions: number;
  embed(texts: string[]): Promise<number[][]>;
}
