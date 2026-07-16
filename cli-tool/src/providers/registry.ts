import type { Provider, ProviderId } from "./types.js";
import { PollinationsProvider } from "./pollinations.js";
import { OllamaProvider } from "./ollama.js";
import { LocalModelsProvider } from "./local-models.js";
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
    // Pollinations is the default because it's TRULY zero-setup:
    // no API key, no .z-ai-config file, no model download. Just works.
    this.providers.set("pollinations", new PollinationsProvider());
    this.providers.set("ollama", new OllamaProvider());
    this.providers.set("local-models", new LocalModelsProvider());
    this.providers.set("zai", new ZaiProvider());
    this.providers.set("groq", new GroqProvider());
    this.providers.set("openrouter", new OpenRouterProvider());
    this.providers.set("google", new GoogleProvider());
    this.providers.set("huggingface", new HuggingFaceProvider());

    this.activeId = "pollinations";
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
   *   1. Pollinations (zero-setup cloud — always works if internet is available)
   *   2. Ollama (local — if installed, preferred for privacy)
   *   3. Z.ai (cloud SDK — works only in Z.ai sandbox)
   *   4. Groq (cloud API — if GROQ_API_KEY is set)
   *   5. OpenRouter / Google / HuggingFace (cloud API — if key is set)
   *
   * Used on first run to auto-select a working provider.
   */
  async findFirstAvailable(): Promise<Provider | null> {
    const priority: ProviderId[] = [
      "pollinations",
      "ollama",
      "zai",
      "groq",
      "openrouter",
      "google",
      "huggingface",
    ];
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
