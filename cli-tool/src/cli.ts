import readline from "node:readline";
import chalk from "chalk";
import { OllamaClient } from "./ollama.js";
import { SessionStore, type ChatMessage } from "./session.js";
import { CONFIG } from "./config.js";
import { findCommand, commands, type CommandContext } from "./commands/index.js";
import { renderMarkdown } from "./markdown.js";
import { execSyncSafe } from "./tools/exec.js";
import { ProviderRegistry, registry as defaultRegistry } from "./providers/registry.js";
import type { Provider, ProviderId } from "./providers/types.js";
import { OllamaProvider } from "./providers/ollama.js";

const BANNER = `
  ${chalk.magenta.bold("███████╗███████╗")}
  ${chalk.magenta.bold("██╔════╝██╔════╝")}
  ${chalk.magenta.bold("█████╗  ███████╗")}   ${chalk.cyan("Free CLI")} ${chalk.gray("v2.0.0")}
  ${chalk.magenta.bold("██╔══╝  ╚════██║")}   ${chalk.gray("Multi-provider • Z.ai + Ollama + OpenRouter + Gemini + Groq")}
  ${chalk.magenta.bold("███████╗███████║")}   ${chalk.gray("100% free • zero-setup cloud or local")}
  ${chalk.magenta.bold("╚══════╝╚══════╝")}
`;

const PROMPT = chalk.cyan("❯ ");

export class CLI {
  private rl!: readline.Interface;
  private client: OllamaClient;
  private sessions: SessionStore;
  private sessionId: string;
  private history: string[] = [];
  private pendingSessionSwitch: string | null = null;
  private registry: ProviderRegistry;

  constructor(model?: string) {
    this.client = new OllamaClient(model);
    this.sessions = new SessionStore();
    this.sessionId = this.sessions.create("zai/glm-4.6");
    this.registry = defaultRegistry;
  }

  /** Tab-completion for slash commands. */
  private completer = (line: string): [string[], string] => {
    if (line.startsWith("/")) {
      const prefix = line.slice(1).split(/\s+/)[0];
      const matches = commands
        .filter((c) => c.name.startsWith(prefix) || c.aliases?.some((a) => a.startsWith(prefix)))
        .map((c) => `/${c.name}`);
      return [matches, line];
    }
    return [[], line];
  };

  /** Create the readline interface and register handlers. */
  private initReadline(): void {
    this.rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
      prompt: PROMPT,
      completer: this.completer,
      terminal: process.stdin.isTTY,
    });

    this.rl.on("history", (line: string) => {
      const typed = String(line);
      if (typed.trim()) {
        this.history.push(typed);
        if (this.history.length > 200) this.history.shift();
      }
    });
  }

  async start(): Promise<void> {
    console.log(BANNER);

    // Auto-detect first available provider (Z.ai first, then Ollama, etc.)
    console.log(chalk.gray("Detecting available providers...\n"));
    const provider = await this.registry.findFirstAvailable();

    if (!provider) {
      console.log(chalk.yellow.bold("⚠ No providers are ready yet.\n"));
      console.log(chalk.gray("Quick setup options:\n"));
      console.log(chalk.white("  1. ") + chalk.cyan("Use Z.ai (zero-setup cloud)") + chalk.gray(" — default, should work"));
      console.log(chalk.white("  2. ") + chalk.cyan("Install Ollama") + chalk.gray(" — for fully local use"));
      console.log(chalk.cyan("     curl -fsSL https://ollama.com/install.sh | sh && ollama serve"));
      console.log(chalk.white("  3. ") + chalk.cyan("Add an API key") + chalk.gray(" — free at OpenRouter/Google/Groq"));
      console.log(chalk.cyan("     /apikey openrouter <key>   (get one at https://openrouter.ai/keys)"));
      console.log("");
      console.log(chalk.gray("Type /provider to see all options, or /help for all commands.\n"));
    } else {
      const category =
        provider.category === "local"
          ? "local (no internet)"
          : provider.category === "cloud-sdk"
            ? "cloud (no API key)"
            : "cloud (API key)";
      console.log(
        chalk.green(`✓ Active: ${chalk.white(provider.name)} `) +
          chalk.gray(`[${category}] • model: ${provider.model}`),
      );
      console.log(chalk.gray(`  ${provider.tagline}\n`));
      console.log(chalk.gray(`Type ${chalk.white("/help")} for commands, ${chalk.white("/provider")} to switch.\n`));
    }

    this.initReadline();

    const queue: string[] = [];
    let processing = false;
    let stdinClosed = false;

    const processQueue = async () => {
      if (processing) return;
      processing = true;
      try {
        while (queue.length > 0) {
          const input = queue.shift()!.trim();
          if (!input) continue;

          if (input.startsWith("/")) {
            await this.handleCommand(input);
          } else {
            await this.handleChat(input);
          }

          if (this.pendingSessionSwitch) {
            this.sessionId = this.pendingSessionSwitch;
            this.pendingSessionSwitch = null;
          }
        }
      } catch (e) {
        console.error(chalk.red(`Error: ${(e as Error).message}`));
      } finally {
        processing = false;
      }

      if (stdinClosed && queue.length === 0) {
        process.exit(0);
      }
      if (process.stdin.isTTY && !stdinClosed) {
        this.rl.prompt();
      }
    };

    this.rl.on("line", (line: string) => {
      queue.push(line);
      processQueue();
    });

    this.rl.on("close", () => {
      stdinClosed = true;
      if (!processing && queue.length === 0) {
        if (process.stdin.isTTY) {
          console.log(chalk.gray("\nGoodbye! 👋"));
        }
        process.exit(0);
      }
    });

    if (process.stdin.isTTY) {
      this.rl.prompt();
    }

    // Ctrl+C handler
    let ctrlCCount = 0;
    let ctrlCTimer: NodeJS.Timeout | null = null;
    this.rl.on("SIGINT", () => {
      ctrlCCount++;
      if (ctrlCTimer) clearTimeout(ctrlCTimer);
      ctrlCTimer = setTimeout(() => {
        ctrlCCount = 0;
      }, 1500);

      if (ctrlCCount >= 2) {
        console.log(chalk.gray("\nGoodbye! 👋"));
        process.exit(0);
      } else {
        console.log(chalk.gray("\n(Press Ctrl+C again to exit)"));
        this.rl.prompt();
      }
    });
  }

  private async handleCommand(input: string): Promise<void> {
    const [name, ...args] = input.slice(1).split(/\s+/);
    const cmd = findCommand(name);
    if (!cmd) {
      console.log(chalk.red(`Unknown command: /${name}`));
      console.log(chalk.gray("Type /help for available commands."));
      return;
    }

    const ctx: CommandContext = {
      client: this.client,
      sessions: this.sessions,
      sessionId: this.sessionId,
      setModel: (tag: string) => {
        this.client.model = tag;
      },
      clearScreen: () => {
        console.clear();
      },
      exit: () => {
        this.rl.close();
        process.exit(0);
      },
      registry: this.registry,
      getActiveProvider: () => this.registry.active,
      setActiveProvider: async (id: ProviderId) => {
        const p = this.registry.get(id);
        if (!p) throw new Error(`Unknown provider: ${id}`);
        if (!p.available) {
          const ok = await p.ping();
          if (!ok) {
            throw new Error(p.unavailableReason ?? `Provider ${id} not available`);
          }
        }
        this.registry.switch(id);
      },
    };

    try {
      await cmd.run(args, ctx);
      if ((ctx as any)._newSessionId) {
        this.pendingSessionSwitch = (ctx as any)._newSessionId;
      }
    } catch (e) {
      console.log(chalk.red(`✗ ${(e as Error).message}`));
    }
  }

  private async handleChat(input: string): Promise<void> {
    const provider = this.registry.active;

    if (!provider.available) {
      console.log(chalk.red(`✗ Active provider "${provider.name}" is not ready.`));
      console.log(chalk.gray(`  ${provider.unavailableReason ?? "Unknown reason"}`));
      console.log(chalk.gray(`  Switch with: /provider`));
      return;
    }

    // Persist the user message
    this.sessions.append(this.sessionId, {
      role: "user",
      content: input,
      timestamp: Date.now(),
    });

    // Build the message context from session history
    const session = this.sessions.load(this.sessionId);
    if (!session) {
      console.log(chalk.red("Session lost. Starting a new one."));
      this.sessionId = this.sessions.create(provider.id + "/" + provider.model);
      return;
    }

    const messages: { role: "system" | "user" | "assistant"; content: string }[] = [
      { role: "system", content: CONFIG.systemPrompt },
    ];

    const recent = session.messages.slice(-CONFIG.contextWindow);
    for (const m of recent) {
      messages.push({ role: m.role, content: m.content });
    }

    // Stream the response
    const providerLabel = chalk.magenta.bold(`[${provider.id}]`);
    process.stdout.write(`${providerLabel} ${chalk.magenta.bold("AI: ")}`);
    let fullResponse = "";

    try {
      for await (const chunk of provider.stream(messages)) {
        process.stdout.write(chunk);
        fullResponse += chunk;
      }
      process.stdout.write("\n\n");

      this.sessions.append(this.sessionId, {
        role: "assistant",
        content: fullResponse,
        timestamp: Date.now(),
      });
    } catch (e) {
      const msg = (e as Error).message;
      process.stdout.write(chalk.red(`\n✗ Error: ${msg}\n\n`));
      if (msg.includes("API key")) {
        console.log(chalk.gray(`Set it with: /apikey ${provider.id} <key>`));
      }
    }
  }
}
