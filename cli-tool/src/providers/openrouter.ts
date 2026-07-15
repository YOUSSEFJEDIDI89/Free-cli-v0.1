import { CONFIG } from "../config.js";
import type { Provider, ChatMessage, ProviderModel } from "./types.js";

/**
 * OpenRouter free models list (filtered from their catalogue).
 * All these models are free to use with a free OpenRouter account.
 *
 * Get a free API key at: https://openrouter.ai/keys
 */
const OPENROUTER_FREE_MODELS: ProviderModel[] = [
  {
    id: "meta-llama/llama-3.1-8b-instruct:free",
    name: "Llama 3.1 8B Instruct (Free)",
    context: 128000,
    streaming: true,
    pricing: "free",
    description: "Meta's Llama 3.1 8B, free on OpenRouter.",
  },
  {
    id: "meta-llama/llama-3.3-70b-instruct:free",
    name: "Llama 3.3 70B Instruct (Free)",
    context: 128000,
    streaming: true,
    pricing: "free",
    description: "Llama 3.3 70B — large and capable, free on OpenRouter.",
  },
  {
    id: "mistralai/mistral-7b-instruct:free",
    name: "Mistral 7B Instruct (Free)",
    context: 32000,
    streaming: true,
    pricing: "free",
    description: "Mistral 7B, free tier.",
  },
  {
    id: "google/gemma-2-9b-it:free",
    name: "Gemma 2 9B (Free)",
    context: 8000,
    streaming: true,
    pricing: "free",
    description: "Google's Gemma 2 9B, free tier.",
  },
  {
    id: "qwen/qwen-2.5-7b-instruct:free",
    name: "Qwen 2.5 7B Instruct (Free)",
    context: 32000,
    streaming: true,
    pricing: "free",
    description: "Qwen 2.5 7B, free tier. Excellent for Arabic.",
  },
  {
    id: "deepseek/deepseek-r1:free",
    name: "DeepSeek R1 (Free)",
    context: 64000,
    streaming: true,
    pricing: "free",
    description: "DeepSeek R1 reasoning model, free tier.",
  },
  {
    id: "nousresearch/hermes-3-llama-3.1-405b:free",
    name: "Hermes 3 405B (Free)",
    context: 128000,
    streaming: true,
    pricing: "free",
    description: "Hermes 3 (based on Llama 3.1 405B), free tier.",
  },
];

const OPENROUTER_API_URL = "https://openrouter.ai/api/v1/chat/completions";

/**
 * OpenRouter provider - cloud API with free tier.
 * Sign up at https://openrouter.ai and get a free API key.
 * Many models (Llama 3.1, Mistral, Gemma, Qwen, DeepSeek R1) are free.
 */
export class OpenRouterProvider implements Provider {
  id = "openrouter" as const;
  name = "OpenRouter (Cloud API)";
  category = "cloud-api" as const;
  tagline =
    "Free tier with Llama 3.3 70B, Mistral, Gemma, Qwen, DeepSeek R1. Requires API key.";
  requiresApiKey = true;
  apiKeyEnv = "OPENROUTER_API_KEY";
  apiKeyUrl = "https://openrouter.ai/keys";
  requiresDownload = false;
  models = OPENROUTER_FREE_MODELS;
  defaultModel = "meta-llama/llama-3.3-70b-instruct:free";

  private apiKey: string | null;
  private currentModel: string;
  private _available = false;
  private _unavailableReason?: string;

  constructor(model?: string) {
    this.apiKey = process.env.OPENROUTER_API_KEY ?? null;
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
      this._unavailableReason = `No API key. Set OPENROUTER_API_KEY env var or get one at ${this.apiKeyUrl}.`;
      return false;
    }
    // Quick auth check via /models endpoint
    try {
      const res = await fetch("https://openrouter.ai/api/v1/models", {
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
        },
      });
      if (res.ok) {
        this._available = true;
        this._unavailableReason = undefined;
        return true;
      }
      if (res.status === 401) {
        this._available = false;
        this._unavailableReason = "Invalid API key. Check OPENROUTER_API_KEY.";
        return false;
      }
      // Some other status — assume available, will fail on chat if needed
      this._available = true;
      this._unavailableReason = undefined;
      return true;
    } catch (e: any) {
      this._available = false;
      this._unavailableReason = `Network error: ${e.message}`;
      return false;
    }
  }

  setApiKey(key: string): void {
    this.apiKey = key;
    process.env.OPENROUTER_API_KEY = key;
  }

  async *stream(
    messages: ChatMessage[],
    opts?: { model?: string; temperature?: number; maxTokens?: number },
  ): AsyncGenerator<string> {
    if (!this.apiKey) {
      throw new Error("OpenRouter API key required. Get one at " + this.apiKeyUrl);
    }

    const model = opts?.model ?? this.currentModel;
    const res = await fetch(OPENROUTER_API_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        "Content-Type": "application/json",
        "HTTP-Referer": "https://github.com/YOUSSEFJEDIDI89/Free-cli-v0.1",
        "X-Title": "Free CLI",
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
      throw new Error(`OpenRouter error ${res.status}: ${err.slice(0, 200)}`);
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
      throw new Error("OpenRouter API key required. Get one at " + this.apiKeyUrl);
    }

    const model = opts?.model ?? this.currentModel;
    const res = await fetch(OPENROUTER_API_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        "Content-Type": "application/json",
        "HTTP-Referer": "https://github.com/YOUSSEFJEDIDI89/Free-cli-v0.1",
        "X-Title": "Free CLI",
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
      throw new Error(`OpenRouter error ${res.status}: ${err.slice(0, 200)}`);
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
