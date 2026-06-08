import type { AIProvider, CompletionRequest, CompletionResult } from "../types";

/**
 * Secondary provider implemented over the REST API (no SDK dependency) to prove
 * the abstraction is real. Claude remains primary.
 */
export class OpenAIProvider implements AIProvider {
  readonly name = "openai";
  readonly isMock = false;
  private apiKey: string;
  private model: string;

  constructor(apiKey: string, model = "gpt-4o") {
    this.apiKey = apiKey;
    this.model = model;
  }

  async complete(req: CompletionRequest): Promise<CompletionResult> {
    const messages = [
      ...(req.system ? [{ role: "system", content: req.system }] : []),
      ...req.messages.map((m) => ({ role: m.role, content: m.content })),
    ];

    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model: this.model,
        temperature: req.temperature ?? 0.3,
        max_tokens: req.maxTokens ?? 1024,
        ...(req.json ? { response_format: { type: "json_object" } } : {}),
        messages,
      }),
    });

    if (!res.ok) {
      throw new Error(`OpenAI error ${res.status}: ${await res.text()}`);
    }
    const data = (await res.json()) as {
      choices: { message: { content: string } }[];
    };
    return {
      text: data.choices[0]?.message?.content ?? "",
      provider: this.name,
      model: this.model,
    };
  }
}
