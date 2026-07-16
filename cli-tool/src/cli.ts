import readline from "node:readline";
import { existsSync } from "node:fs";
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

/**
 * Detect if we're running in Termux (Android terminal emulator).
 * Termux has limitations:
 *   - No arrow-key history (use /history command instead)
 *   - No tab completion in some shells
 *   - Limited color support on some devices
 *   - No native Ollama (would need proot/chroot)
 */
const IS_TERMUX =
  !!process.env.TERMUX_VERSION ||
  !!process.env.PREFIX?.includes("/com.termux/") ||
  existsSync("/data/data/com.termux/");

// Simpler banner for Termux (smaller, less likely to break)
const BANNER = IS_TERMUX
  ? `\n${chalk.cyan.bold("Free CLI")} ${chalk.gray("v2.1.0")}\n${chalk.gray("Type /help for commands, just type to chat.\n")}`
  : `
  ${chalk.magenta.bold("███████╗███████╗")}
  ${chalk.magenta.bold("██╔════╝██╔════╝")}
  ${chalk.magenta.bold("█████╗  ███████╗")}   ${chalk.cyan("Free CLI")} ${chalk.gray("v2.1.0")}
  ${chalk.magenta.bold("██╔══╝  ╚════██║")}   ${chalk.gray("Pollinations + Ollama + Local files + Groq + more")}
  ${chalk.magenta.bold("███████╗███████║")}   ${chalk.gray("100% free • zero-setup • just works")}
  ${chalk.magenta.bold("╚══════╝╚══════╝")}
`;

// In Termux, use a simpler prompt without special chars that might break
const PROMPT = IS_TERMUX ? chalk.cyan("> ") : chalk.cyan("❯ ");

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
    // In Termux, disable tab completion and history (they often don't work)
    // and use a non-terminal readline mode that's more compatible.
    const useTerminal = process.stdin.isTTY && !IS_TERMUX;

    this.rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
      prompt: PROMPT,
      completer: useTerminal ? this.completer : undefined,
      terminal: useTerminal,
      history: useTerminal ? undefined : [],
      removeHistoryDuplicates: true,
    });

    // Only track history manually in non-Termux (Termux arrow keys are unreliable)
    if (useTerminal) {
      this.rl.on("history", (line: string) => {
        const typed = String(line);
        if (typed.trim()) {
          this.history.push(typed);
          if (this.history.length > 200) this.history.shift();
        }
      });
    }
  }

  async start(): Promise<void> {
    console.log(BANNER);

    if (IS_TERMUX) {
      console.log(chalk.gray(`Detected: Termux on Android. Simplified UI active.\n`));
    }

    // Auto-detect first available provider
    console.log(chalk.gray("Detecting available providers...\n"));
    const provider = await this.registry.findFirstAvailable();

    if (!provider) {
      console.log(chalk.yellow.bold("⚠ No providers are ready.\n"));
      console.log(chalk.gray("This shouldn't happen — Pollinations.ai works without any setup.\n"));
      console.log(chalk.gray("Check your internet connection, then try again.\n"));
      console.log(chalk.gray("Or set up a cloud API key:\n"));
      console.log(chalk.cyan("  /apikey groq gsk_xxxxxxxx   (free: https://console.groq.com/keys)"));
      console.log(chalk.cyan("  /apikey openrouter sk-or-x  (free: https://openrouter.ai/keys)"));
      console.log("");
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

  /**
   * Detect if the input looks like an API key, and if so, which provider it belongs to.
   * Key prefixes:
   *   - hf_        → HuggingFace
   *   - sk-or-     → OpenRouter
   *   - AIza       → Google Gemini
   *   - gsk_       → Groq
   *   - sk-ant-    → Anthropic (not supported, but detected for helpfulness)
   *   - sk-        → OpenAI (not supported)
   */
  private detectApiKeyProvider(input: string): { id: ProviderId; name: string } | null {
    const trimmed = input.trim();
    // Must look like a key: no spaces, length > 20, starts with a known prefix
    if (trimmed.includes(" ") || trimmed.length < 20) return null;

    if (trimmed.startsWith("hf_")) {
      return { id: "huggingface", name: "HuggingFace" };
    }
    if (trimmed.startsWith("sk-or-")) {
      return { id: "openrouter", name: "OpenRouter" };
    }
    if (trimmed.startsWith("AIza")) {
      return { id: "google", name: "Google Gemini" };
    }
    if (trimmed.startsWith("gsk_")) {
      return { id: "groq", name: "Groq" };
    }
    return null;
  }

  /**
   * Detect if the input is just a provider name (user trying to switch).
   */
  private detectProviderName(input: string): { id: ProviderId; name: string } | null {
    const lower = input.toLowerCase().trim();
    // Common typos and variations
    const aliases: Record<string, ProviderId> = {
      zai: "zai",
      "z.ai": "zai",
      ollama: "ollama",
      openrouter: "openrouter",
      "open-router": "openrouter",
      google: "google",
      gemini: "google",
      "google-gemini": "google",
      groq: "groq",
      huggingface: "huggingface",
      "hugging-face": "huggingface",
      hf: "huggingface",
      "hugfingface": "huggingface", // typo from user's screenshot
      "hugfingFace": "huggingface", // typo
    };
    const id = aliases[lower];
    if (id) {
      const p = this.registry.get(id);
      if (p) return { id, name: p.name };
    }
    return null;
  }

  private async handleCommand(input: string): Promise<void> {
    // Case-insensitive command matching: /apiKey, /APIKEY, /ApiKey all work
    const [name, ...args] = input.slice(1).split(/\s+/);
    const cmd = findCommand(name.toLowerCase());
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

    // Smart detection: if the user typed just an API key (without /apikey),
    // auto-detect the provider from the key prefix and offer to set it up.
    const detectedProvider = this.detectApiKeyProvider(input.trim());
    if (detectedProvider) {
      console.log(chalk.yellow.bold(`💡 Detected ${detectedProvider.name} API key!\n`));
      console.log(chalk.gray(`  You typed an API key directly. Use this command instead:\n`));
      console.log(chalk.cyan(`  /apikey ${detectedProvider.id} ${input.trim()}\n`));
      console.log(chalk.gray(`  Or I can set it for you now. Switching to ${detectedProvider.name}...\n`));
      try {
        this.registry.setApiKey(detectedProvider.id, input.trim());
        const p = this.registry.get(detectedProvider.id)!;
        const ok = await p.ping();
        if (ok) {
          this.registry.switch(detectedProvider.id);
          console.log(chalk.green(`✓ ${detectedProvider.name} is now active and ready!\n`));
          console.log(chalk.gray(`  Try typing a message now, e.g.: Hello!\n`));
        } else {
          console.log(chalk.red(`✗ Key was rejected: ${p.unavailableReason}\n`));
        }
      } catch (e) {
        console.log(chalk.red(`✗ ${(e as Error).message}\n`));
      }
      return;
    }

    // Smart detection: if the user typed just a provider name (e.g. "groq"),
    // offer to switch to it.
    const providerMatch = this.detectProviderName(input.trim());
    if (providerMatch) {
      console.log(chalk.yellow.bold(`💡 Did you mean to switch providers?\n`));
      console.log(chalk.gray(`  You typed "${input.trim()}" which looks like a provider name.\n`));
      console.log(chalk.cyan(`  Use: /provider ${providerMatch.id}\n`));
      return;
    }

    if (!provider.available) {
      console.log(chalk.red(`✗ Active provider "${provider.name}" is not ready.`));
      console.log(chalk.gray(`  ${provider.unavailableReason ?? "Unknown reason"}`));
      console.log("");
      console.log(chalk.yellow(`Quick fix — pick one of these:\n`));
      // Find first available provider
      const available = this.registry.list().filter((p) => p.available);
      if (available.length > 0) {
        console.log(chalk.green(`  ✓ Available now: /provider ${available[0].id}`));
      }
      console.log(chalk.cyan(`  Set a free API key: /apikey groq gsk_xxxxxxxx`));
      console.log(chalk.gray(`    Get free key: https://console.groq.com/keys`));
      console.log(chalk.cyan(`  Or use Ollama locally: /provider ollama`));
      console.log("");
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
