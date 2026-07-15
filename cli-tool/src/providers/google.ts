import { CONFIG } from "../config.js";
import type { Provider, ChatMessage, ProviderModel } from "./types.js";

const GEMINI_MODELS: ProviderModel[] = [
  {
    id: "gemini-1.5-flash",
    name: "Gemini 1.5 Flash (Free)",
    context: 1000000,
    streaming: true,
    pricing: "freemium",
    description:
      "Google's fast multimodal model. Free tier: 15 RPM, 1M tokens/min, 1500 requests/day.",
  },
  {
    id: "gemini-1.5-flash-8b",
    name: "Gemini 1.5 Flash-8B (Free)",
    context: 1000000,
    streaming: true,
    pricing: "freemium",
    description: "Smaller, faster Gemini variant. Higher free limits.",
  },
  {
    id: "gemini-1.5-pro",
    name: "Gemini 1.5 Pro (Free tier)",
    context: 2000000,
    streaming: true,
    pricing: "freemium",
    description: "Google's flagship model. Free tier: 2 RPM, 50 requests/day.",
  },
  {
    id: "gemini-2.0-flash-exp",
    name: "Gemini 2.0 Flash (Experimental)",
    context: 1000000,
    streaming: true,
    pricing: "freemium",
    description: "Latest experimental Gemini 2.0.",
  },
];

/**
 * Google Gemini provider - uses Gemini's OpenAI-compatible endpoint.
 * Get a free API key at: https://aistudio.google.com/app/apikey
 *
 * Free tier limits (as of 2025):
 *   - Gemini 1.5 Flash: 15 RPM, 1500 req/day
 *   - Gemini 1.5 Pro: 2 RPM, 50 req/day
 */
export class GoogleProvider implements Provider {
  id = "google" as const;
  name = "Google Gemini (Cloud API)";
  category = "cloud-api" as const;
  tagline =
    "Free tier with Gemini 1.5 Flash (1M context) and Gemini 2.0 Flash. Requires API key.";
  requiresApiKey = true;
  apiKeyEnv = "GOOGLE_API_KEY";
  apiKeyUrl = "https://aistudio.google.com/app/apikey";
  requiresDownload = false;
  models = GEMINI_MODELS;
  defaultModel = "gemini-1.5-flash";

  private apiKey: string | null;
  private currentModel: string;
  private _available = false;
  private _unavailableReason?: string;

  constructor(model?: string) {
    this.apiKey = process.env.GOOGLE_API_KEY ?? null;
    this.currentModel = model ?? this.defaultModel;
  }

  get available(): boolean {
    return this._available;
  }

  get unavailableReason(): string | undefined {
    return this._unavailableReason;
  }

  private get baseUrl(): string {
    return `https://generativelanguage.googleapis.com/v1beta/openai`;
  }

  async ping(): Promise<boolean> {
    if (!this.apiKey) {
      this._available = false;
      this._unavailableReason = `No API key. Set GOOGLE_API_KEY env var or get one at ${this.apiKeyUrl}.`;
      return false;
    }
    // Quick auth check via /models endpoint
    try {
      const res = await fetch(`${this.baseUrl}/models`, {
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
        },
      });
      if (res.ok) {
        this._available = true;
        this._unavailableReason = undefined;
        return true;
      }
      if (res.status === 401 || res.status === 403) {
        this._available = false;
        this._unavailableReason = "Invalid API key. Check GOOGLE_API_KEY.";
        return false;
      }
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
    process.env.GOOGLE_API_KEY = key;
  }

  async *stream(
    messages: ChatMessage[],
    opts?: { model?: string; temperature?: number; maxTokens?: number },
  ): AsyncGenerator<string> {
    if (!this.apiKey) {
      throw new Error("Google API key required. Get one at " + this.apiKeyUrl);
    }

    const model = opts?.model ?? this.currentModel;
    const res = await fetch(`${this.baseUrl}/chat/completions`, {
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
      throw new Error(`Google Gemini error ${res.status}: ${err.slice(0, 200)}`);
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
      throw new Error("Google API key required. Get one at " + this.apiKeyUrl);
    }

    const model = opts?.model ?? this.currentModel;
    const res = await fetch(`${this.baseUrl}/chat/completions`, {
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
      throw new Error(`Google Gemini error ${res.status}: ${err.slice(0, 200)}`);
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
