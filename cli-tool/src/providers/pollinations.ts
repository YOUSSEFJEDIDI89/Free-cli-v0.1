import { CONFIG } from "../config.js";
import type { Provider, ChatMessage, ProviderModel } from "./types.js";

/**
 * Pollinations.ai — 100% free, NO API key, NO setup.
 *
 * This is the "magic" provider: it works the moment the user runs the CLI.
 * No .z-ai-config file, no API key, no model download. Just works.
 *
 * Endpoint: https://text.pollinations.ai/openai
 * - OpenAI-compatible API
 * - Supports streaming (SSE)
 * - Multiple models: openai (gpt-oss-20b), mistral, llama, qwen, etc.
 * - Arabic + multilingual support
 *
 * Free tier: unlimited requests for anonymous users (rate-limited).
 */

const POLLINATIONS_MODELS: ProviderModel[] = [
  {
    id: "openai",
    name: "GPT-OSS 20B (OpenAI-compat)",
    context: 32000,
    streaming: true,
    pricing: "free",
    description: "OpenAI-compatible reasoning model. Best general purpose.",
  },
  {
    id: "openai-fast",
    name: "GPT-OSS 20B Fast",
    context: 32000,
    streaming: true,
    pricing: "free",
    description: "Faster variant of GPT-OSS. Lower latency.",
  },
  {
    id: "mistral",
    name: "Mistral",
    context: 32000,
    streaming: true,
    pricing: "free",
    description: "Mistral model. Good multilingual support.",
  },
  {
    id: "qwen-coder",
    name: "Qwen Coder",
    context: 32000,
    streaming: true,
    pricing: "free",
    description: "Specialized for coding tasks.",
  },
  {
    id: "llama",
    name: "Llama",
    context: 32000,
    streaming: true,
    pricing: "free",
    description: "Meta's Llama model.",
  },
  {
    id: "deepseek",
    name: "DeepSeek",
    context: 32000,
    streaming: true,
    pricing: "free",
    description: "DeepSeek reasoning model.",
  },
];

const POLLINATIONS_URL = "https://text.pollinations.ai/openai";

export class PollinationsProvider implements Provider {
  id = "pollinations" as any; // Add to ProviderId type
  name = "Pollinations.ai (Free Cloud)";
  category = "cloud-sdk" as const;
  tagline =
    "✨ ZERO SETUP — works instantly with no API key, no config, no download. Just run and chat.";
  requiresApiKey = false;
  requiresDownload = false;
  models = POLLINATIONS_MODELS;
  defaultModel = "openai";

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
      // Quick connectivity check — try to list models
      const res = await fetch("https://text.pollinations.ai/models", {
        signal: AbortSignal.timeout(5000),
      });
      if (res.ok) {
        this._available = true;
        this._unavailableReason = undefined;
        return true;
      }
      this._available = false;
      this._unavailableReason = `Pollinations API returned ${res.status}`;
      return false;
    } catch (e: any) {
      this._available = false;
      this._unavailableReason = `Network error: ${e.message}. Check your internet connection.`;
      return false;
    }
  }

  async *stream(
    messages: ChatMessage[],
    opts?: { model?: string; temperature?: number; maxTokens?: number },
  ): AsyncGenerator<string> {
    const model = opts?.model ?? this.currentModel;

    const res = await fetch(POLLINATIONS_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        messages,
        stream: true,
        temperature: opts?.temperature ?? CONFIG.temperature,
        max_tokens: opts?.maxTokens ?? CONFIG.maxTokens,
      }),
      signal: AbortSignal.timeout(120000), // 2 min timeout
    });

    if (!res.ok || !res.body) {
      const err = await res.text().catch(() => "");
      throw new Error(`Pollinations error ${res.status}: ${err.slice(0, 200)}`);
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed.startsWith("data:")) continue;
        const data = trimmed.slice(5).trim();
        if (data === "[DONE]") return;
        try {
          const json = JSON.parse(data);
          // Pollinations may send both "content" and "reasoning" deltas.
          // We only want the actual content (not internal reasoning).
          const delta = json?.choices?.[0]?.delta?.content;
          if (delta) yield delta;
        } catch {
          // skip malformed chunks
        }
      }
    }
  }

  async chat(
    messages: ChatMessage[],
    opts?: { model?: string; temperature?: number; maxTokens?: number },
  ): Promise<string> {
    const model = opts?.model ?? this.currentModel;
    const res = await fetch(POLLINATIONS_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        messages,
        temperature: opts?.temperature ?? CONFIG.temperature,
        max_tokens: opts?.maxTokens ?? CONFIG.maxTokens,
      }),
      signal: AbortSignal.timeout(120000),
    });

    if (!res.ok) {
      const err = await res.text().catch(() => "");
      throw new Error(`Pollinations error ${res.status}: ${err.slice(0, 200)}`);
    }

    const json: any = await res.json();
    return json?.choices?.[0]?.message?.content ?? "";
  }

  get model(): string {
    return this.currentModel;
  }

  set model(id: string) {
    this.currentModel = id;
  }
}
