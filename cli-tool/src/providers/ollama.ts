import { Ollama } from "ollama";
import { CONFIG } from "../config.js";
import type { Provider, ChatMessage, ProviderModel } from "./types.js";

const OLLAMA_MODELS: ProviderModel[] = [
  {
    id: "glm4:9b",
    name: "GLM-4-9B (Chat)",
    context: 128000,
    streaming: true,
    pricing: "free",
    description:
      "Latest open-source Zhipu AI model. Excellent Arabic, Chinese, English + coding.",
  },
  {
    id: "llama3.1:8b",
    name: "Llama 3.1 8B",
    context: 128000,
    streaming: true,
    pricing: "free",
    description: "Meta's flagship small model.",
  },
  {
    id: "qwen2.5:7b",
    name: "Qwen 2.5 7B",
    context: 32000,
    streaming: true,
    pricing: "free",
    description: "Alibaba's multilingual model.",
  },
  {
    id: "deepseek-coder-v2:16b",
    name: "DeepSeek Coder V2 16B",
    context: 128000,
    streaming: true,
    pricing: "free",
    description: "Specialized coding model.",
  },
  {
    id: "mistral:7b",
    name: "Mistral 7B",
    context: 32000,
    streaming: true,
    pricing: "free",
    description: "Fast and lightweight.",
  },
  {
    id: "phi3:mini",
    name: "Phi-3 Mini (3.8B)",
    context: 128000,
    streaming: true,
    pricing: "free",
    description: "Microsoft's tiny model.",
  },
];

/**
 * Ollama provider - 100% local, no API key, no internet.
 * Requires `ollama` daemon + downloaded models.
 */
export class OllamaProvider implements Provider {
  id = "ollama" as const;
  name = "Ollama (Local)";
  category = "local" as const;
  tagline = "100% local, no API key, no internet. Models run on your machine.";
  requiresApiKey = false;
  requiresDownload = true;
  models = OLLAMA_MODELS;
  defaultModel = "glm4:9b";

  private client: Ollama;
  private currentModel: string;
  private _available = false;
  private _unavailableReason?: string;

  constructor(model?: string) {
    this.client = new Ollama({ host: CONFIG.ollamaHost });
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
      await this.client.list();
      this._available = true;
      this._unavailableReason = undefined;
      return true;
    } catch (e) {
      this._available = false;
      this._unavailableReason = `Ollama daemon not reachable at ${CONFIG.ollamaHost}. Install from https://ollama.com and run 'ollama serve'.`;
      return false;
    }
  }

  async listLocal(): Promise<string[]> {
    try {
      const res = await this.client.list();
      return res.models.map((m) => m.name);
    } catch {
      return [];
    }
  }

  async listInstalled(): Promise<ProviderModel[]> {
    const local = await this.listLocal();
    return this.models.filter((m) =>
      local.some((l) => l.startsWith(m.id.split(":")[0])),
    );
  }

  async *stream(
    messages: ChatMessage[],
    opts?: { model?: string; temperature?: number; maxTokens?: number },
  ): AsyncGenerator<string> {
    const model = opts?.model ?? this.currentModel;
    const response = await this.client.chat({
      model,
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

  async chat(
    messages: ChatMessage[],
    opts?: { model?: string; temperature?: number; maxTokens?: number },
  ): Promise<string> {
    let out = "";
    for await (const chunk of this.stream(messages, opts)) {
      out += chunk;
    }
    return out;
  }

  async pull(
    tag: string,
    onProgress?: (status: string, completed: number, total: number) => void,
  ): Promise<void> {
    const stream = await this.client.pull({ model: tag, stream: true });
    for await (const chunk of stream) {
      if (onProgress && chunk.status) {
        onProgress(chunk.status, chunk.completed ?? 0, chunk.total ?? 0);
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
