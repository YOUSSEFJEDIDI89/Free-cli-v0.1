import type { Provider, ProviderId } from "./types.js";
import { OllamaProvider } from "./ollama.js";
import { ZaiProvider } from "./zai.js";
import { OpenRouterProvider } from "./openrouter.js";
import { GoogleProvider } from "./google.js";
import { HuggingFaceProvider } from "./huggingface.js";
import { GroqProvider } from "./groq.js";

/**
 * Provider registry - creates and caches provider instances.
 *
 * Use this to:
 *   1. List all available providers (and their status)
 *   2. Get a provider by id
 *   3. Switch the active provider
 */
export class ProviderRegistry {
  private providers: Map<ProviderId, Provider> = new Map();
  private activeId: ProviderId;

  constructor() {
    // Create instances in priority order. Z.ai is the default because it
    // requires zero setup (no API key, no download). Ollama is next-best
    // because it's fully local. The rest are opt-in with API keys.
    this.providers.set("zai", new ZaiProvider());
    this.providers.set("ollama", new OllamaProvider());
    this.providers.set("openrouter", new OpenRouterProvider());
    this.providers.set("google", new GoogleProvider());
    this.providers.set("huggingface", new HuggingFaceProvider());
    this.providers.set("groq", new GroqProvider());

    this.activeId = "zai";
  }

  /** Get the currently active provider. */
  get active(): Provider {
    return this.providers.get(this.activeId)!;
  }

  /** Get the active provider's id. */
  get activeId_(): ProviderId {
    return this.activeId;
  }

  /** Switch to a different provider. */
  switch(id: ProviderId): Provider {
    if (!this.providers.has(id)) {
      throw new Error(`Unknown provider: ${id}`);
    }
    this.activeId = id;
    return this.active;
  }

  /** Get a provider by id. */
  get(id: ProviderId): Provider | undefined {
    return this.providers.get(id);
  }

  /** List all providers. */
  list(): Provider[] {
    return Array.from(this.providers.values());
  }

  /** List all provider ids. */
  ids(): ProviderId[] {
    return Array.from(this.providers.keys());
  }

  /**
   * Find the first available provider, in priority order:
   *   1. Z.ai (zero-setup cloud)
   *   2. Ollama (local)
   *   3. OpenRouter / Google / HuggingFace / Groq (API key required)
   *
   * Used on first run to auto-select a working provider.
   */
  async findFirstAvailable(): Promise<Provider | null> {
    const priority: ProviderId[] = ["zai", "ollama", "groq", "google", "openrouter", "huggingface"];
    for (const id of priority) {
      const p = this.providers.get(id)!;
      if (await p.ping()) {
        this.activeId = id;
        return p;
      }
    }
    return null;
  }

  /** Set API key for a provider (used by /apikey command). */
  setApiKey(id: ProviderId, key: string): void {
    const p = this.providers.get(id) as any;
    if (p && typeof p.setApiKey === "function") {
      p.setApiKey(key);
    } else {
      throw new Error(`Provider ${id} does not accept API keys.`);
    }
  }
}

export const registry = new ProviderRegistry();
