import { CONFIG } from "../config.js";
import type { Provider, ChatMessage, ProviderModel } from "./types.js";

const GROQ_MODELS: ProviderModel[] = [
  {
    id: "llama-3.3-70b-versatile",
    name: "Llama 3.3 70B Versatile",
    context: 128000,
    streaming: true,
    pricing: "freemium",
    description:
      "Llama 3.3 70B on Groq — extremely fast (500+ tokens/sec). Free tier.",
  },
  {
    id: "llama-3.1-8b-instant",
    name: "Llama 3.1 8B Instant",
    context: 128000,
    streaming: true,
    pricing: "free",
    description: "Llama 3.1 8B on Groq — blazing fast, free tier.",
  },
  {
    id: "llama3-70b-8192",
    name: "Llama 3 70B",
    context: 8000,
    streaming: true,
    pricing: "freemium",
    description: "Llama 3 70B on Groq.",
  },
  {
    id: "mixtral-8x7b-32768",
    name: "Mixtral 8x7B",
    context: 32000,
    streaming: true,
    pricing: "freemium",
    description: "Mixtral 8x7B MoE on Groq.",
  },
  {
    id: "gemma2-9b-it",
    name: "Gemma 2 9B",
    context: 8000,
    streaming: true,
    pricing: "free",
    description: "Gemma 2 9B on Groq.",
  },
];

/**
 * Groq provider - extremely fast inference, free tier.
 * Sign up at https://console.groq.com and get a free API key.
 *
 * Groq uses custom hardware (LPUs) and delivers 500+ tokens/sec on
 * Llama 3.3 70B. Free tier limits:
 *   - 30 RPM, 14400 req/day on most models
 */
export class GroqProvider implements Provider {
  id = "groq" as const;
  name = "Groq (Cloud API, Ultra-Fast)";
  category = "cloud-api" as const;
  tagline =
    "Ultra-fast inference (500+ tok/s) with Llama 3.3 70B & Mixtral. Free tier, requires API key.";
  requiresApiKey = true;
  apiKeyEnv = "GROQ_API_KEY";
  apiKeyUrl = "https://console.groq.com/keys";
  requiresDownload = false;
  models = GROQ_MODELS;
  defaultModel = "llama-3.3-70b-versatile";

  private apiKey: string | null;
  private currentModel: string;
  private _available = false;
  private _unavailableReason?: string;

  constructor(model?: string) {
    this.apiKey = process.env.GROQ_API_KEY ?? null;
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
      this._unavailableReason = `No API key. Set GROQ_API_KEY env var or get one at ${this.apiKeyUrl}.`;
      return false;
    }
    try {
      const res = await fetch("https://api.groq.com/openai/v1/models", {
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
        this._unavailableReason = "Invalid Groq API key. Check GROQ_API_KEY.";
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
    process.env.GROQ_API_KEY = key;
  }

  async *stream(
    messages: ChatMessage[],
    opts?: { model?: string; temperature?: number; maxTokens?: number },
  ): AsyncGenerator<string> {
    if (!this.apiKey) {
      throw new Error("Groq API key required. Get one at " + this.apiKeyUrl);
    }

    const model = opts?.model ?? this.currentModel;
    const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
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
      throw new Error(`Groq error ${res.status}: ${err.slice(0, 200)}`);
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
      throw new Error("Groq API key required. Get one at " + this.apiKeyUrl);
    }

    const model = opts?.model ?? this.currentModel;
    const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
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
      throw new Error(`Groq error ${res.status}: ${err.slice(0, 200)}`);
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
