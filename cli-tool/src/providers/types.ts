/**
 * Unified Provider Interface
 *
 * Free CLI supports multiple AI providers with the same interface.
 * Each provider implements this contract so the REPL can switch between
 * them seamlessly.
 */

export type ProviderId =
  | "ollama"
  | "zai"
  | "openrouter"
  | "google"
  | "huggingface"
  | "groq";

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface ProviderModel {
  id: string;
  name: string;
  context?: number;
  streaming?: boolean;
  pricing?: "free" | "freemium" | "paid";
  description?: string;
}

export interface ProviderInfo {
  id: ProviderId;
  name: string;
  category: "local" | "cloud-sdk" | "cloud-api";
  tagline: string;
  requiresApiKey: boolean;
  apiKeyEnv?: string;
  apiKeyUrl?: string;
  requiresDownload: boolean;
  models: ProviderModel[];
  defaultModel: string;
  available: boolean;
  unavailableReason?: string;
}

export interface Provider extends ProviderInfo {
  /** Currently selected model id */
  model: string;

  stream(
    messages: ChatMessage[],
    opts?: { model?: string; temperature?: number; maxTokens?: number },
  ): AsyncGenerator<string>;

  chat(
    messages: ChatMessage[],
    opts?: { model?: string; temperature?: number; maxTokens?: number },
  ): Promise<string>;

  ping(): Promise<boolean>;
}
