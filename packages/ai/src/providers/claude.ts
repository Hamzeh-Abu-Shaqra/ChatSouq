import Anthropic from "@anthropic-ai/sdk";
import type { AIProvider, CompletionRequest, CompletionResult } from "../types";

/**
 * Primary reasoning provider. ChatSouq's intelligence is built around Claude.
 */
export class ClaudeProvider implements AIProvider {
  readonly name = "claude";
  readonly isMock = false;
  private client: Anthropic;
  private model: string;

  constructor(apiKey: string, model?: string) {
    this.client = new Anthropic({ apiKey });
    this.model = model ?? "claude-opus-4-8";
  }

  async complete(req: CompletionRequest): Promise<CompletionResult> {
    const system = req.json
      ? `${req.system ?? ""}\n\nRespond with ONLY valid JSON. No markdown, no prose.`.trim()
      : req.system;

    const res = await this.client.messages.create({
      model: this.model,
      max_tokens: req.maxTokens ?? 1024,
      temperature: req.temperature ?? 0.3,
      ...(system ? { system } : {}),
      messages: req.messages
        .filter((m) => m.role !== "system")
        .map((m) => ({ role: m.role as "user" | "assistant", content: m.content })),
    });

    const text = res.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("");

    return { text, provider: this.name, model: this.model };
  }
}
