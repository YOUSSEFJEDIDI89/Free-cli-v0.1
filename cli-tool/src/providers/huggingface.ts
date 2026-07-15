import { CONFIG } from "../config.js";
import type { Provider, ChatMessage, ProviderModel } from "./types.js";

const HUGGINGFACE_MODELS: ProviderModel[] = [
  {
    id: "meta-llama/Meta-Llama-3.1-8B-Instruct",
    name: "Llama 3.1 8B Instruct",
    context: 128000,
    streaming: true,
    pricing: "free",
    description: "Meta Llama 3.1 8B via HuggingFace Inference API.",
  },
  {
    id: "mistralai/Mistral-7B-Instruct-v0.3",
    name: "Mistral 7B Instruct v0.3",
    context: 32000,
    streaming: true,
    pricing: "free",
    description: "Mistral 7B via HuggingFace.",
  },
  {
    id: "Qwen/Qwen2.5-7B-Instruct",
    name: "Qwen 2.5 7B Instruct",
    context: 32000,
    streaming: true,
    pricing: "free",
    description: "Qwen 2.5 7B. Excellent for Arabic & Chinese.",
  },
  {
    id: "google/gemma-2-9b-it",
    name: "Gemma 2 9B",
    context: 8000,
    streaming: true,
    pricing: "free",
    description: "Google's Gemma 2 9B.",
  },
  {
    id: "deepseek-ai/DeepSeek-V2.5",
    name: "DeepSeek V2.5",
    context: 128000,
    streaming: true,
    pricing: "freemium",
    description: "DeepSeek V2.5 — strong coding model.",
  },
];

/**
 * HuggingFace Inference provider - free tier with API key.
 * Sign up at https://huggingface.co and get a free token:
 *   https://huggingface.co/settings/tokens
 *
 * Free tier includes access to many open-source models via the
 * Inference API (serverless).
 *
 * NOTE: HuggingFace's Inference API uses a chat-completions-style
 * endpoint for chat models.
 */
export class HuggingFaceProvider implements Provider {
  id = "huggingface" as const;
  name = "HuggingFace (Cloud API)";
  category = "cloud-api" as const;
  tagline =
    "Free access to Llama 3.1, Mistral, Qwen, Gemma, DeepSeek. Requires free API token.";
  requiresApiKey = true;
  apiKeyEnv = "HUGGINGFACE_API_KEY";
  apiKeyUrl = "https://huggingface.co/settings/tokens";
  requiresDownload = false;
  models = HUGGINGFACE_MODELS;
  defaultModel = "meta-llama/Meta-Llama-3.1-8B-Instruct";

  private apiKey: string | null;
  private currentModel: string;
  private _available = false;
  private _unavailableReason?: string;

  constructor(model?: string) {
    this.apiKey = process.env.HUGGINGFACE_API_KEY ?? null;
    this.currentModel = model ?? this.defaultModel;
  }

  get available(): boolean {
    return this._available;
  }

  get unavailableReason(): string | undefined {
    return this._unavailableReason;
  }

  async ping(): Promise<boolean> {
    if (!this.apiKey) {
      this._available = false;
      this._unavailableReason = `No API key. Set HUGGINGFACE_API_KEY env var or get one at ${this.apiKeyUrl}.`;
      return false;
    }
    try {
      // Check token validity
      const res = await fetch("https://huggingface.co/api/whoami-v2", {
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
        },
      });
      if (res.ok) {
        this._available = true;
        this._unavailableReason = undefined;
        return true;
      }
      this._available = false;
      this._unavailableReason = "Invalid HuggingFace token. Check HUGGINGFACE_API_KEY.";
      return false;
    } catch (e: any) {
      this._available = false;
      this._unavailableReason = `Network error: ${e.message}`;
      return false;
    }
  }

  setApiKey(key: string): void {
    this.apiKey = key;
    process.env.HUGGINGFACE_API_KEY = key;
  }

  /**
   * HuggingFace's router now supports an OpenAI-compatible endpoint at
   * https://router.huggingface.co/v1/chat/completions — this is the
   * easiest way to use chat models with streaming.
   */
  async *stream(
    messages: ChatMessage[],
    opts?: { model?: string; temperature?: number; maxTokens?: number },
  ): AsyncGenerator<string> {
    if (!this.apiKey) {
      throw new Error("HuggingFace API key required. Get one at " + this.apiKeyUrl);
    }

    const model = opts?.model ?? this.currentModel;
    const res = await fetch("https://router.huggingface.co/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        messages,
        stream: true,
        temperature: opts?.temperature ?? CONFIG.temperature,
        max_tokens: opts?.maxTokens ?? CONFIG.maxTokens,
      }),
    });

    if (!res.ok || !res.body) {
      const err = await res.text().catch(() => "");
      throw new Error(`HuggingFace error ${res.status}: ${err.slice(0, 200)}`);
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
    if (!this.apiKey) {
      throw new Error("HuggingFace API key required. Get one at " + this.apiKeyUrl);
    }

    const model = opts?.model ?? this.currentModel;
    const res = await fetch("https://router.huggingface.co/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        messages,
        temperature: opts?.temperature ?? CONFIG.temperature,
        max_tokens: opts?.maxTokens ?? CONFIG.maxTokens,
      }),
    });

    if (!res.ok) {
      const err = await res.text().catch(() => "");
      throw new Error(`HuggingFace error ${res.status}: ${err.slice(0, 200)}`);
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
