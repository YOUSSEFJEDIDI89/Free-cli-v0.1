/**
 * Predefined models that work with Ollama - 100% free, local, no API.
 *
 * GLM-4-9B is the latest open-source model from Zhipu AI (the "GLM 4.6" equivalent
 * that is downloadable). Other models are included as fallbacks / alternatives.
 *
 * Pull any of them with:  ollama pull <model>
 */

export interface ModelConfig {
  /** Ollama model tag (used by `ollama pull` / `ollama run`) */
  tag: string;
  /** Human-readable display name */
  name: string;
  /** Size on disk after pull */
  size: string;
  /** Recommended RAM */
  ram: string;
  /** Short description */
  description: string;
  /** Best at... */
  strengths: string[];
  /** Whether this is the default model on first run */
  default?: boolean;
}

export const MODELS: ModelConfig[] = [
  {
    tag: "glm4:9b",
    name: "GLM-4-9B (Chat)",
    size: "~5.5 GB",
    ram: "8 GB+",
    description:
      "Latest open-source Zhipu AI model. Excellent Arabic, Chinese, English + strong coding. This is the closest free equivalent to GLM-4.6.",
    strengths: ["Arabic", "Coding", "Reasoning", "Multilingual"],
    default: true,
  },
  {
    tag: "glm4:9b-chat-q4_K_M",
    name: "GLM-4-9B Chat (Quantized)",
    size: "~5.5 GB",
    ram: "8 GB+",
    description:
      "Same GLM-4-9B but with 4-bit quantization for lower memory usage.",
    strengths: ["Arabic", "Coding", "Low-memory"],
  },
  {
    tag: "llama3.1:8b",
    name: "Llama 3.1 8B",
    size: "~4.7 GB",
    ram: "8 GB+",
    description: "Meta's flagship small model. Strong general assistant.",
    strengths: ["General", "English", "Reasoning"],
  },
  {
    tag: "qwen2.5:7b",
    name: "Qwen 2.5 7B",
    size: "~4.4 GB",
    ram: "8 GB+",
    description: "Alibaba's multilingual model. Excellent for Arabic & Chinese.",
    strengths: ["Arabic", "Chinese", "Coding"],
  },
  {
    tag: "deepseek-coder-v2:16b",
    name: "DeepSeek Coder V2 16B",
    size: "~8.9 GB",
    ram: "16 GB+",
    description: "Specialized coding model. Best for programming tasks.",
    strengths: ["Coding", "Code completion", "Refactoring"],
  },
  {
    tag: "mistral:7b",
    name: "Mistral 7B",
    size: "~4.1 GB",
    ram: "6 GB+",
    description: "Fast and lightweight. Good for low-end machines.",
    strengths: ["Fast", "Lightweight", "General"],
  },
  {
    tag: "phi3:mini",
    name: "Phi-3 Mini (3.8B)",
    size: "~2.3 GB",
    ram: "4 GB+",
    description: "Microsoft's tiny but capable model. Runs on almost anything.",
    strengths: ["Tiny", "Fast", "Low-RAM"],
  },
];

export const DEFAULT_MODEL = MODELS.find((m) => m.default)?.tag ?? "glm4:9b";

export const CONFIG = {
  /** Ollama host - default is localhost:11434 */
  ollamaHost: process.env.OLLAMA_HOST ?? "http://localhost:11434",
  /** Default system prompt */
  systemPrompt:
    "You are Free CLI, a helpful terminal-based AI assistant. You can read/write files, execute code, and answer questions. Always be concise and use Markdown formatting. When you write code, always use proper code blocks with language tags.",
  /** History file location */
  historyDir: `${process.env.HOME ?? "/tmp"}/.free-cli`,
  /** Max tokens per response */
  maxTokens: 4096,
  /** Temperature */
  temperature: 0.7,
  /** Context window - last N messages kept */
  contextWindow: 20,
} as const;

export type Config = typeof CONFIG;
