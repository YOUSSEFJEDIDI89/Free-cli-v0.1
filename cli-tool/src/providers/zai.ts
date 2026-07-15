import { CONFIG } from "../config.js";
import type { Provider, ChatMessage, ProviderModel } from "./types.js";

const ZAI_MODELS: ProviderModel[] = [
  {
    id: "glm-4.6",
    name: "GLM-4.6 (Flagship)",
    context: 128000,
    streaming: true,
    pricing: "free",
    description:
      "Zhipu AI's latest flagship model. Best Arabic support, strong reasoning, multilingual.",
  },
  {
    id: "glm-4-flash",
    name: "GLM-4-Flash (Fast)",
    context: 128000,
    streaming: true,
    pricing: "free",
    description: "Fast and efficient variant. Great for everyday tasks.",
  },
];

/**
 * Z.ai provider - cloud-based, NO API key, NO model download.
 * Uses the bundled `z-ai-web-dev-sdk` package.
 *
 * This is the ideal "zero-setup" cloud option: works immediately after
 * `npm install` with no configuration.
 *
 * NOTE: The z-ai-web-dev-sdk is a server-side SDK that authenticates
 * through the Z.ai platform without requiring a personal API key.
 */
export class ZaiProvider implements Provider {
  id = "zai" as const;
  name = "Z.ai (Cloud, No API Key)";
  category = "cloud-sdk" as const;
  tagline =
    "Zero-setup cloud. Uses GLM-4.6 / GLM-4-Flash with no API key and no model download.";
  requiresApiKey = false;
  requiresDownload = false;
  models = ZAI_MODELS;
  defaultModel = "glm-4.6";

  private zai: any = null;
  private currentModel: string;
  private _available = false;
  private _unavailableReason?: string;

  constructor(model?: string) {
    this.currentModel = model ?? this.defaultModel;
  }

  get available(): boolean {
    return this._available;
  }

  get unavailableReason(): string | undefined {
    return this._unavailableReason;
  }

  async ping(): Promise<boolean> {
    try {
      // Try importing the SDK dynamically so the CLI doesn't crash if it's
      // missing (e.g. user installed only minimal deps).
      const ZAIModule = await import("z-ai-web-dev-sdk");
      const ZAI = ZAIModule.default;
      this.zai = await ZAI.create();
      // Quick sanity test
      const test = await this.zai.chat.completions.create({
        messages: [{ role: "user", content: "ping" }],
        thinking: { type: "disabled" },
        max_tokens: 5,
      });
      if (test?.choices?.[0]?.message?.content !== undefined) {
        this._available = true;
        this._unavailableReason = undefined;
        return true;
      }
      this._available = false;
      this._unavailableReason = "Z.ai SDK responded but no content was returned.";
      return false;
    } catch (e: any) {
      this._available = false;
      this._unavailableReason = `Z.ai SDK not available: ${e.message}. Run 'npm install z-ai-web-dev-sdk' to enable.`;
      return false;
    }
  }

  async *stream(
    messages: ChatMessage[],
    opts?: { model?: string; temperature?: number; maxTokens?: number },
  ): AsyncGenerator<string> {
    if (!this.zai) {
      throw new Error("Z.ai SDK not initialized. Call ping() first.");
    }

    // z-ai-web-dev-sdk uses 'assistant' role for system prompts (OpenAI-compat style)
    const sdkMessages = messages.map((m) => ({
      role: m.role === "system" ? "assistant" : m.role,
      content: m.content,
    }));

    // The SDK returns raw SSE bytes as async iterator chunks.
    // Each chunk is a Uint8Array-like object that needs to be decoded
    // and parsed as Server-Sent Events.
    const completion = await this.zai.chat.completions.create({
      messages: sdkMessages,
      thinking: { type: "disabled" },
      stream: true,
      max_tokens: opts?.maxTokens ?? CONFIG.maxTokens,
      temperature: opts?.temperature ?? CONFIG.temperature,
    });

    let sseBuffer = "";

    if (completion[Symbol.asyncIterator]) {
      for await (const chunk of completion) {
        // Convert the chunk (which may be a Uint8Array-like object) to string
        let text: string;
        if (typeof chunk === "string") {
          text = chunk;
        } else if (chunk instanceof Uint8Array || Buffer.isBuffer(chunk)) {
          text = Buffer.from(chunk).toString("utf8");
        } else if (typeof chunk === "object" && chunk !== null) {
          // SDK returns an object with numeric keys (byte values)
          const arr = Object.values(chunk).map((v) => Number(v));
          text = Buffer.from(arr).toString("utf8");
        } else {
          continue;
        }

        sseBuffer += text;
        const lines = sseBuffer.split("\n");
        sseBuffer = lines.pop() ?? "";

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed.startsWith("data:")) continue;
          const data = trimmed.slice(5).trim();
          if (data === "[DONE]") return;
          try {
            const json = JSON.parse(data);
            const delta = json?.choices?.[0]?.delta?.content;
            if (delta) yield delta;
          } catch {
            // skip malformed chunks
          }
        }
      }
    } else {
      // Non-streaming fallback (older SDK versions)
      const content = completion?.choices?.[0]?.message?.content ?? "";
      if (content) yield content;
    }
  }

  async chat(
    messages: ChatMessage[],
    opts?: { model?: string; temperature?: number; maxTokens?: number },
  ): Promise<string> {
    if (!this.zai) {
      throw new Error("Z.ai SDK not initialized. Call ping() first.");
    }

    const sdkMessages = messages.map((m) => ({
      role: m.role === "system" ? "assistant" : m.role,
      content: m.content,
    }));

    const completion = await this.zai.chat.completions.create({
      messages: sdkMessages,
      thinking: { type: "disabled" },
      max_tokens: opts?.maxTokens ?? CONFIG.maxTokens,
      temperature: opts?.temperature ?? CONFIG.temperature,
    });

    return completion?.choices?.[0]?.message?.content ?? "";
  }

  get model(): string {
    return this.currentModel;
  }

  set model(id: string) {
    this.currentModel = id;
  }
}
