import type { AIProvider, CompletionRequest, CompletionResult } from "../types";

/**
 * Keyless provider so the entire app runs with NO API key. It does not invent
 * content: when isMock is true, the recommendation engine builds explanations
 * from listing facts via templates instead of calling an LLM. complete() exists
 * only to satisfy the interface and returns an empty JSON object / empty string.
 */
export class MockProvider implements AIProvider {
  readonly name = "mock";
  readonly isMock = true;

  async complete(req: CompletionRequest): Promise<CompletionResult> {
    return { text: req.json ? "{}" : "", provider: this.name };
  }
}
