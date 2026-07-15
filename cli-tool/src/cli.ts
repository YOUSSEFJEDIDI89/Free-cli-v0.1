import readline from "node:readline";
import chalk from "chalk";
import { OllamaClient } from "./ollama.js";
import { SessionStore, type ChatMessage } from "./session.js";
import { CONFIG } from "./config.js";
import { findCommand, commands, type CommandContext } from "./commands/index.js";
import { renderMarkdown } from "./markdown.js";
import { execSyncSafe } from "./tools/exec.js";

const BANNER = `
  ${chalk.magenta.bold("███████╗███████╗")}
  ${chalk.magenta.bold("██╔════╝██╔════╝")}
  ${chalk.magenta.bold("█████╗  ███████╗")}   ${chalk.cyan("Free CLI")} ${chalk.gray("v1.0.0")}
  ${chalk.magenta.bold("██╔══╝  ╚════██║")}   ${chalk.gray("100% local • no API • no credit card")}
  ${chalk.magenta.bold("███████╗███████║")}   ${chalk.gray("Powered by Ollama + GLM-4-9B")}
  ${chalk.magenta.bold("╚══════╝╚══════╝")}
`;

const PROMPT = chalk.cyan("❯ ");

export class CLI {
  private rl!: readline.Interface;
  private client: OllamaClient;
  private sessions: SessionStore;
  private sessionId: string;
  private history: string[] = [];
  private historyIndex = -1;
  private pendingSessionSwitch: string | null = null;

  constructor(model?: string) {
    this.client = new OllamaClient(model);
    this.sessions = new SessionStore();
    this.sessionId = this.sessions.create(this.client.model);
    // readline is created in start() after async setup, to avoid missing
    // 'line' events that fire before handlers are registered.
  }

  /** Create the readline interface and register handlers. */
  private initReadline(): void {
    this.rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
      prompt: PROMPT,
      completer: this.completer,
      terminal: process.stdin.isTTY,
    });

    // Persist input history
    this.rl.on("history", (line: string) => {
      const typed = String(line);
      if (typed.trim()) {
        this.history.push(typed);
        if (this.history.length > 200) this.history.shift();
      }
    });
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

  async start(): Promise<void> {
    console.log(BANNER);

    // Verify Ollama is reachable
    const ok = await this.client.ping();
    if (!ok) {
      console.log(chalk.red.bold("✗ Cannot reach Ollama daemon!"));
      console.log(chalk.gray("\nPlease install and start Ollama:"));
      console.log(chalk.cyan("  curl -fsSL https://ollama.com/install.sh | sh"));
      console.log(chalk.cyan("  ollama serve"));
      console.log(chalk.gray("\nThen pull a model:"));
      console.log(chalk.cyan("  ollama pull glm4:9b"));
      console.log();
      process.exit(1);
    }

    // Check that the default model is installed
    const installed = await this.client.listInstalled();
    if (installed.length === 0) {
      console.log(chalk.yellow("⚠ No models installed yet."));
      console.log(chalk.gray(`\nPull the default model with:`));
      console.log(chalk.cyan("  /pull glm4:9b"));
      console.log(chalk.gray(`\nOr pull a smaller model if you have limited RAM:`));
      console.log(chalk.cyan("  /pull phi3:mini"));
      console.log();
    } else if (!installed.some((m) => m.tag === this.client.model)) {
      // Default to the first installed model
      this.client.model = installed[0].tag;
      console.log(chalk.gray(`Using installed model: ${chalk.white(installed[0].tag)}\n`));
    } else {
      console.log(chalk.gray(`Ready. Model: ${chalk.white(this.client.model)}\n`));
    }

    console.log(chalk.gray(`Type ${chalk.white("/help")} for commands, or just start chatting.\n`));

    // Now that async setup is done, create the readline interface.
    // This ensures 'line' events aren't missed.
    this.initReadline();

    // Sequential command processor. Lines are queued and processed one at a
    // time. After processing, in TTY mode we re-display the prompt; in piped
    // mode we just wait for the next line or EOF.
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

      // If stdin is closed and queue is empty, exit
      if (stdinClosed && queue.length === 0) {
        process.exit(0);
      }
      // Re-prompt in TTY mode
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
      // If processing is done and queue is empty, exit immediately
      if (!processing && queue.length === 0) {
        if (process.stdin.isTTY) {
          console.log(chalk.gray("\nGoodbye! 👋"));
        }
        process.exit(0);
      }
      // Otherwise, processQueue will handle the exit when done
    });

    // Initial prompt (TTY mode only)
    if (process.stdin.isTTY) {
      this.rl.prompt();
    }

    // Ctrl+C handler: first press clears input, second exits
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
    };

    try {
      await cmd.run(args, ctx);
      // Pick up session switches
      if ((ctx as any)._newSessionId) {
        this.pendingSessionSwitch = (ctx as any)._newSessionId;
      }
    } catch (e) {
      console.log(chalk.red(`✗ ${(e as Error).message}`));
    }
  }

  private async handleChat(input: string): Promise<void> {
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
      this.sessionId = this.sessions.create(this.client.model);
      return;
    }

    const messages: { role: "system" | "user" | "assistant"; content: string }[] = [
      { role: "system", content: CONFIG.systemPrompt },
    ];

    // Keep the last N messages for context
    const recent = session.messages.slice(-CONFIG.contextWindow);
    for (const m of recent) {
      messages.push({ role: m.role, content: m.content });
    }

    // Stream the response
    process.stdout.write(chalk.magenta.bold("AI: "));
    let fullResponse = "";

    try {
      for await (const chunk of this.client.stream(messages)) {
        process.stdout.write(chunk);
        fullResponse += chunk;
      }
      process.stdout.write("\n\n");

      // Persist the assistant response
      this.sessions.append(this.sessionId, {
        role: "assistant",
        content: fullResponse,
        timestamp: Date.now(),
      });
    } catch (e) {
      const msg = (e as Error).message;
      process.stdout.write(chalk.red(`\n✗ Error: ${msg}\n\n`));
      if (msg.includes("model") && msg.includes("not found")) {
        console.log(chalk.gray(`Try: /pull ${this.client.model}`));
      }
    }
  }

  /** Render markdown content (used for AI responses with --md flag). */
  private renderResponse(text: string): void {
    const rendered = renderMarkdown(text);
    console.log(rendered);
  }
}
