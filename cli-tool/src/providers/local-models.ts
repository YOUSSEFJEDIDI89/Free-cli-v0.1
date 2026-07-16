import { existsSync, readdirSync, statSync } from "node:fs";
import { join, extname, basename, resolve } from "node:path";
import { CONFIG } from "../config.js";
import { execSyncSafe } from "../tools/exec.js";
import type { Provider, ChatMessage, ProviderModel } from "./types.js";

/**
 * Local Model Files provider.
 *
 * Scans the current directory (and ~/.free-cli/models/) for downloadable
 * model files and lets the user "run" them. Supported formats:
 *   - .gguf  → run via llama.cpp / llama-cli / ollama
 *   - .safetensors → run via transformers/python
 *   - .onnx  → run via onnxruntime
 *
 * This is the "I have a model in my folder, just use it" provider.
 */

const MODEL_EXTENSIONS = [".gguf", ".safetensors", ".onnx", ".bin", ".pt"];
const SEARCH_PATHS = [
  process.cwd(),
  join(process.env.HOME ?? "/tmp", ".free-cli", "models"),
  join(process.env.HOME ?? "/tmp", "models"),
  join(process.env.HOME ?? "/tmp", "Downloads"),
  join(process.env.HOME ?? "/tmp", "storage"),
  "/sdcard/Download",
  "/sdcard/Download/models",
];

interface FoundModel {
  path: string;
  size: string;
  ext: string;
}

function formatSize(bytes: number): string {
  if (bytes > 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`;
  if (bytes > 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
  if (bytes > 1024) return `${(bytes / 1024).toFixed(2)} KB`;
  return `${bytes} B`;
}

function scanDir(dir: string, depth: number = 0): FoundModel[] {
  if (depth > 2) return []; // don't recurse too deep
  if (!existsSync(dir)) return [];

  const results: FoundModel[] = [];
  try {
    const entries = readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      // Skip common irrelevant directories
      if (entry.isDirectory()) {
        if (["node_modules", ".git", "dist", "build", ".cache", "vendor"].includes(entry.name)) continue;
        // Skip hidden directories
        if (entry.name.startsWith(".")) continue;
        results.push(...scanDir(join(dir, entry.name), depth + 1));
      } else if (entry.isFile()) {
        const ext = extname(entry.name).toLowerCase();
        if (MODEL_EXTENSIONS.includes(ext)) {
          const fullPath = join(dir, entry.name);
          try {
            const stats = statSync(fullPath);
            // Skip tiny files (likely not real models)
            if (stats.size < 1024 * 1024) continue; // < 1 MB
            results.push({
              path: fullPath,
              size: formatSize(stats.size),
              ext,
            });
          } catch {
            // skip
          }
        }
      }
    }
  } catch {
    // permission denied or other error — skip
  }
  return results;
}

/**
 * Convert a found model file into a provider model entry.
 */
function toModelModel(found: FoundModel, index: number): ProviderModel {
  const name = basename(found.path);
  const runner =
    found.ext === ".gguf" ? "llama.cpp"
    : found.ext === ".safetensors" ? "transformers"
    : found.ext === ".onnx" ? "onnxruntime"
    : "unknown";
  return {
    id: found.path, // full path as id
    name: `${name} (${found.size})`,
    context: 4096,
    streaming: true,
    pricing: "free",
    description: `Local ${found.ext.slice(1).toUpperCase()} file • Runner: ${runner}`,
  };
}

/**
 * Find a runner for the model file.
 */
function findRunner(modelPath: string): { cmd: string; args: string[] } | null {
  const ext = extname(modelPath).toLowerCase();

  if (ext === ".gguf") {
    // Try llama.cpp / llama-cli / ollama
    const runners = [
      { cmd: "llama-cli", args: ["-m", modelPath, "-c", "2048", "-p"] },
      { cmd: "llama.cpp", args: ["-m", modelPath, "-c", "2048", "-p"] },
      { cmd: "main", args: ["-m", modelPath, "-c", "2048", "-p"] }, // llama.cpp old name
    ];
    for (const r of runners) {
      try {
        execSyncSafe(`which ${r.cmd}`);
        return r;
      } catch {
        // not found
      }
    }
    // Try ollama (can run GGUF via modelfile)
    try {
      execSyncSafe("which ollama");
      // Create a temp modelfile and run
      return {
        cmd: "ollama",
        args: ["run", `freecli-${basename(modelPath).replace(/\W/g, "_")}`],
      };
    } catch {
      // not found
    }
    return null;
  }

  if (ext === ".safetensors" || ext === ".bin" || ext === ".pt") {
    // Use Python transformers
    return {
      cmd: "python3",
      args: ["-c", `
import sys
from transformers import AutoModelForCausalLM, AutoTokenizer
model = AutoModelForCausalLM.from_pretrained("${modelPath}")
tokenizer = AutoTokenizer.from_pretrained("${modelPath}")
prompt = sys.stdin.read()
inputs = tokenizer(prompt, return_tensors="pt")
outputs = model.generate(**inputs, max_new_tokens=200)
print(tokenizer.decode(outputs[0], skip_special_tokens=True))
`],
    };
  }

  if (ext === ".onnx") {
    return {
      cmd: "python3",
      args: ["-c", `
import sys, onnxruntime
session = onnxruntime.InferenceSession("${modelPath}")
print("ONNX model loaded. Interactive prompting not supported yet.")
print("Available inputs:", [i.name for i in session.get_inputs()])
`],
    };
  }

  return null;
}

export class LocalModelsProvider implements Provider {
  id = "local-models" as any;
  name = "Local Model Files (Auto-Detect)";
  category = "local" as const;
  tagline =
    "🔍 Auto-detects .gguf / .safetensors / .onnx files in your current folder and runs them.";
  requiresApiKey = false;
  requiresDownload = false; // the model files already exist
  models: ProviderModel[] = [];
  defaultModel = "";

  private currentModel: string = "";
  private _available = false;
  private _unavailableReason?: string;
  private foundModels: FoundModel[] = [];

  constructor(model?: string) {
    if (model) this.currentModel = model;
  }

  get available(): boolean {
    return this._available;
  }

  get unavailableReason(): string | undefined {
    return this._unavailableReason;
  }

  /** Scan all search paths for model files. */
  scan(): FoundModel[] {
    const all: FoundModel[] = [];
    const seen = new Set<string>();
    for (const dir of SEARCH_PATHS) {
      const found = scanDir(dir);
      for (const f of found) {
        if (!seen.has(f.path)) {
          seen.add(f.path);
          all.push(f);
        }
      }
    }
    this.foundModels = all;
    this.models = all.map((f, i) => toModelModel(f, i));
    if (this.models.length > 0 && !this.currentModel) {
      this.currentModel = this.models[0].id;
      this.defaultModel = this.models[0].id;
    }
    return all;
  }

  async ping(): Promise<boolean> {
    this.scan();
    if (this.foundModels.length === 0) {
      this._available = false;
      this._unavailableReason =
        "No model files (.gguf, .safetensors, .onnx, .bin) found in current directory, ~/.free-cli/models/, or Downloads/.";
      return false;
    }
    this._available = true;
    this._unavailableReason = undefined;
    return true;
  }

  async *stream(
    messages: ChatMessage[],
    opts?: { model?: string; temperature?: number; maxTokens?: number },
  ): AsyncGenerator<string> {
    const modelPath = opts?.model ?? this.currentModel;
    if (!modelPath) {
      throw new Error("No model selected. Run /provider local-models to see available files.");
    }

    const runner = findRunner(modelPath);
    if (!runner) {
      const ext = extname(modelPath).toLowerCase();
      const hint =
        ext === ".gguf"
          ? "Install llama.cpp: https://github.com/ggerganov/llama.cpp OR run 'ollama serve' and we'll auto-import the GGUF."
          : ext === ".safetensors"
            ? "Install Python transformers: pip install transformers torch"
            : "Install onnxruntime: pip install onnxruntime";
      throw new Error(`No runner found for ${ext} files. ${hint}`);
    }

    // Build prompt from messages (simple concat for local runners)
    const prompt = messages
      .map((m) => {
        if (m.role === "system") return m.content;
        if (m.role === "user") return `User: ${m.content}`;
        return `Assistant: ${m.content}`;
      })
      .join("\n") + "\nAssistant: ";

    // For ollama, we need to create a model first
    if (runner.cmd === "ollama" && runner.args[0] === "run") {
      const modelName = runner.args[1];
      // Create modelfile
      try {
        execSyncSafe(
          `echo 'FROM ${modelPath}' | ollama create ${modelName} -f -`,
          { timeout: 60000 },
        );
      } catch (e) {
        // maybe model already exists, continue
      }
      // Now run via ollama API
      const { OllamaProvider } = await import("./ollama.js");
      const ollama = new OllamaProvider(modelName);
      yield* ollama.stream(messages, opts);
      return;
    }

    // Otherwise, exec the runner with prompt as stdin
    const result = execSyncSafe(
      `${runner.cmd} ${runner.args.map((a) => `"${a.replace(/"/g, '\\"')}"`).join(" ")}`,
      { timeout: 120000 },
    );

    // For exec-based runners, we get the whole output at once
    if (result.exitCode === 0 && result.stdout) {
      yield result.stdout;
    } else {
      throw new Error(`Runner exited ${result.exitCode}: ${result.stderr.slice(0, 200)}`);
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

  get model(): string {
    return this.currentModel;
  }

  set model(id: string) {
    this.currentModel = id;
  }
}
