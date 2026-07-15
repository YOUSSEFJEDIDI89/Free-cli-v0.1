#!/usr/bin/env node
/**
 * Free CLI - A 100% local, no-API AI assistant for your terminal.
 *
 * Powered by Ollama + GLM-4-9B (or any other locally-installed model).
 * No API keys. No credit card. No data leaves your machine.
 *
 * Usage:
 *   free-cli                 # start interactive REPL
 *   free-cli "your prompt"   # one-shot prompt, prints response and exits
 *   free-cli -m glm4:9b      # start with a specific model
 *   free-cli --help
 */

import { CLI } from "./cli.js";
import { OllamaClient } from "./ollama.js";
import { CONFIG, DEFAULT_MODEL } from "./config.js";

const args = process.argv.slice(2);

// Parse simple flags
function flag(name: string): string | null {
  const idx = args.indexOf(name);
  if (idx === -1) return null;
  return args[idx + 1] ?? null;
}

if (args.includes("--help") || args.includes("-h")) {
  console.log(`
Free CLI v1.0.0 — A 100% local AI assistant

USAGE
  free-cli                    Start interactive REPL
  free-cli "<prompt>"         One-shot: send prompt, print response, exit
  free-cli -m <model>         Use a specific model (e.g. glm4:9b)
  free-cli --version          Show version

FLAGS
  -m, --model <tag>           Ollama model tag (default: ${DEFAULT_MODEL})
  -h, --help                  Show this help
  -v, --version               Show version
  --no-stream                 Disable streaming (for one-shot mode)

ENVIRONMENT
  OLLAMA_HOST                 Ollama daemon URL (default: http://localhost:11434)

EXAMPLES
  free-cli
  free-cli "Explain async/await in JavaScript"
  free-cli -m llama3.1:8b "Translate this to French: hello"
  free-cli -m glm4:9b

SETUP (first time)
  1. Install Ollama:    curl -fsSL https://ollama.com/install.sh | sh
  2. Start daemon:      ollama serve
  3. Pull a model:      ollama pull glm4:9b   (or: free-cli /pull glm4:9b)
  4. Run this tool:     free-cli

DOCUMENTATION
  Type /help inside the REPL for slash commands.
  GitHub:                  https://github.com/your-org/free-cli
`);
  process.exit(0);
}

if (args.includes("--version") || args.includes("-v")) {
  console.log("free-cli v1.0.0");
  process.exit(0);
}

const modelFlag = flag("-m") ?? flag("--model");
const noStream = args.includes("--no-stream");

// Determine if we have a one-shot prompt (any positional arg that isn't a flag value)
const positional: string[] = [];
for (let i = 0; i < args.length; i++) {
  const a = args[i];
  if (a === "-m" || a === "--model") {
    i++; // skip value
    continue;
  }
  if (a.startsWith("-")) continue;
  positional.push(a);
}

const oneShot = positional.join(" ").trim();

async function main(): Promise<void> {
  // Interactive REPL mode
  if (!oneShot) {
    const cli = new CLI(modelFlag ?? undefined);
    await cli.start();
    return;
  }

  // One-shot mode
  const client = new OllamaClient(modelFlag ?? undefined);

  const ok = await client.ping();
  if (!ok) {
    console.error("Error: Cannot reach Ollama daemon at " + CONFIG.ollamaHost);
    console.error("Start it with: ollama serve");
    process.exit(1);
  }

  const messages: { role: "system" | "user"; content: string }[] = [
    { role: "system", content: CONFIG.systemPrompt },
    { role: "user", content: oneShot },
  ];

  if (noStream) {
    const response = await client.chat(messages);
    process.stdout.write(response + "\n");
  } else {
    for await (const chunk of client.stream(messages)) {
      process.stdout.write(chunk);
    }
    process.stdout.write("\n");
  }
}

main().catch((err) => {
  console.error("Fatal error:", err.message);
  process.exit(1);
});
