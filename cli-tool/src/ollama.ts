import { Ollama } from "ollama";
import { CONFIG, MODELS, type ModelConfig } from "./config.js";

/**
 * Thin wrapper around the official `ollama` JS client.
 * Handles connection, model listing, and streaming chat.
 */
export class OllamaClient {
  private client: Ollama;
  private currentModel: string;

  constructor(model?: string) {
    this.client = new Ollama({ host: CONFIG.ollamaHost });
    this.currentModel = model ?? MODELS.find((m) => m.default)?.tag ?? "glm4:9b";
  }

  /** Check whether the Ollama daemon is reachable. */
  async ping(): Promise<boolean> {
    try {
      await this.client.list();
      return true;
    } catch {
      return false;
    }
  }

  /** Return all models currently installed locally. */
  async listLocal(): Promise<string[]> {
    try {
      const res = await this.client.list();
      return res.models.map((m) => m.name);
    } catch {
      return [];
    }
  }

  /** Return models from our catalogue that are already pulled. */
  async listInstalled(): Promise<ModelConfig[]> {
    const local = await this.listLocal();
    return MODELS.filter((m) =>
      local.some((l) => l.startsWith(m.tag.split(":")[0])),
    );
  }

  /** Stream a chat response. Yields token deltas. */
  async *stream(
    messages: { role: "system" | "user" | "assistant"; content: string }[],
    opts?: { temperature?: number; maxTokens?: number },
  ): AsyncGenerator<string> {
    const response = await this.client.chat({
      model: this.currentModel,
      messages,
      stream: true,
      options: {
        temperature: opts?.temperature ?? CONFIG.temperature,
        num_predict: opts?.maxTokens ?? CONFIG.maxTokens,
      },
    });

    for await (const chunk of response) {
      if (chunk.message?.content) {
        yield chunk.message.content;
      }
    }
  }

  /** Non-streaming chat - returns full response. */
  async chat(
    messages: { role: "system" | "user" | "assistant"; content: string }[],
    opts?: { temperature?: number; maxTokens?: number },
  ): Promise<string> {
    let out = "";
    for await (const chunk of this.stream(messages, opts)) {
      out += chunk;
    }
    return out;
  }

  /** Pull a model with progress callback. */
  async pull(
    tag: string,
    onProgress?: (status: string, completed: number, total: number) => void,
  ): Promise<void> {
    const stream = await this.client.pull({ model: tag, stream: true });
    for await (const chunk of stream) {
      if (onProgress && chunk.status) {
        const completed = chunk.completed ?? 0;
        const total = chunk.total ?? 0;
        onProgress(chunk.status, completed, total);
      }
    }
  }

  get model(): string {
    return this.currentModel;
  }

  set model(tag: string) {
    this.currentModel = tag;
  }
}
