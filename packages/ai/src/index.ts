import type { AIProvider } from "./types";
import { ClaudeProvider } from "./providers/claude";
import { OpenAIProvider } from "./providers/openai";
import { MockProvider } from "./providers/mock";

export * from "./types";
export * from "./embeddings";
export { ClaudeProvider, OpenAIProvider, MockProvider };

/**
 * Resolve the active AI provider from env. Falls back to the keyless mock so
 * the app always runs. Set AI_PROVIDER=claude + ANTHROPIC_API_KEY for real reasoning.
 */
export function getProvider(): AIProvider {
  const choice = (process.env.AI_PROVIDER ?? "mock").toLowerCase();

  if (choice === "claude") {
    const key = process.env.ANTHROPIC_API_KEY;
    if (!key) {
      console.warn("[ai] AI_PROVIDER=claude but ANTHROPIC_API_KEY is empty — using mock.");
      return new MockProvider();
    }
    return new ClaudeProvider(key, process.env.ANTHROPIC_MODEL);
  }

  if (choice === "openai") {
    const key = process.env.OPENAI_API_KEY;
    if (!key) {
      console.warn("[ai] AI_PROVIDER=openai but OPENAI_API_KEY is empty — using mock.");
      return new MockProvider();
    }
    return new OpenAIProvider(key);
  }

  return new MockProvider();
}
