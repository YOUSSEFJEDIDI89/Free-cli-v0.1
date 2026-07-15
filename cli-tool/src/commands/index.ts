import chalk from "chalk";
import { MODELS, DEFAULT_MODEL } from "../config.js";
import { OllamaClient } from "../ollama.js";
import { SessionStore } from "../session.js";
import { GitTool } from "../tools/git.js";
import { webSearch, formatSearchResults, searchFiles, grep } from "../tools/search.js";
import { execSyncSafe, runShell, CODE_RUNNERS } from "../tools/exec.js";
import { writeFileSync, readFileSync, existsSync } from "node:fs";
import { join, resolve, isAbsolute } from "node:path";
import { CONFIG } from "../config.js";

export interface CommandContext {
  client: OllamaClient;
  sessions: SessionStore;
  sessionId: string;
  setModel: (tag: string) => void;
  clearScreen: () => void;
  exit: () => void;
}

export interface SlashCommand {
  name: string;
  aliases?: string[];
  description: string;
  usage: string;
  run: (args: string[], ctx: CommandContext) => Promise<void>;
}

export const commands: SlashCommand[] = [
  {
    name: "help",
    aliases: ["?", "h"],
    description: "Show available commands",
    usage: "/help",
    async run(_args, _ctx) {
      console.log(chalk.cyan.bold("\n📖 Available Commands\n"));
      const maxName = Math.max(...commands.map((c) => c.name.length));
      for (const cmd of commands) {
        const aliases = cmd.aliases ? chalk.gray(` (${cmd.aliases.join(", ")})`) : "";
        console.log(
          `  ${chalk.green(`/` + cmd.name.padEnd(maxName))} ${aliases} ${chalk.gray(cmd.description)}`,
        );
      }
      console.log(chalk.gray("\nTip: Type any message to chat with the model. Use ↑/↓ for history.\n"));
    },
  },

  {
    name: "model",
    aliases: ["m"],
    description: "Show or switch the active model",
    usage: "/model [tag]   (e.g. /model glm4:9b)",
    async run(args, ctx) {
      if (args.length === 0) {
        console.log(chalk.cyan.bold("\n🤖 Available Models\n"));
        const installed = await ctx.client.listInstalled();
        const installedTags = new Set(installed.map((m) => m.tag));
        for (const m of MODELS) {
          const isCurrent = m.tag === ctx.client.model;
          const isInstalled = installedTags.has(m.tag);
          const marker = isCurrent ? chalk.green("→") : " ";
          const status = isInstalled ? chalk.green("✓ installed") : chalk.gray("○ not pulled");
          console.log(
            `  ${marker} ${chalk.white.bold(m.name.padEnd(28))} ${chalk.gray(m.tag.padEnd(28))} ${status}`,
          );
          console.log(
            chalk.gray(
              `      ${m.description} (${m.size}, ${m.ram} RAM)`,
            ),
          );
        }
        console.log(chalk.gray("\nPull a model with:  /pull <tag>   (e.g. /pull glm4:9b)"));
        console.log(chalk.gray(`Current: ${chalk.white(ctx.client.model)}\n`));
        return;
      }
      const tag = args[0];
      const found = MODELS.find((m) => m.tag === tag);
      if (!found) {
        console.log(chalk.red(`Unknown model: ${tag}`));
        console.log(chalk.gray("Use /model to see available models."));
        return;
      }
      const installed = await ctx.client.listInstalled();
      if (!installed.some((m) => m.tag === tag)) {
        console.log(chalk.yellow(`Model ${tag} is not installed. Run: /pull ${tag}`));
        return;
      }
      ctx.setModel(tag);
      console.log(chalk.green(`✓ Switched to ${found.name} (${tag})\n`));
    },
  },

  {
    name: "pull",
    description: "Download a model from Ollama registry",
    usage: "/pull <tag>   (e.g. /pull glm4:9b)",
    async run(args, ctx) {
      const tag = args[0];
      if (!tag) {
        console.log(chalk.red("Usage: /pull <tag>"));
        return;
      }
      console.log(chalk.cyan(`⬇ Pulling ${tag} ... (this may take a while)\n`));
      try {
        await ctx.client.pull(tag, (status, completed, total) => {
          if (total > 0) {
            const pct = Math.round((completed / total) * 100);
            const bar = "█".repeat(Math.floor(pct / 2)) + "░".repeat(50 - Math.floor(pct / 2));
            process.stdout.write(`\r${chalk.cyan(bar)} ${pct}%  ${status}`);
          } else {
            process.stdout.write(`\r${chalk.gray(status)}`);
          }
        });
        console.log(chalk.green(`\n\n✓ Pulled ${tag}\n`));
      } catch (e) {
        console.log(chalk.red(`\n✗ Failed: ${(e as Error).message}\n`));
      }
    },
  },

  {
    name: "models",
    aliases: ["ls-models"],
    description: "List models installed locally",
    usage: "/models",
    async run(_args, ctx) {
      const local = await ctx.client.listLocal();
      if (local.length === 0) {
        console.log(chalk.gray("\n(no models installed. Use /pull <tag> to install one)\n"));
        return;
      }
      console.log(chalk.cyan.bold("\n📦 Installed Models\n"));
      local.forEach((m) => {
        const current = m === ctx.client.model ? chalk.green("→ ") : "  ";
        console.log(`${current}${chalk.white(m)}`);
      });
      console.log();
    },
  },

  {
    name: "clear",
    aliases: ["c", "cls"],
    description: "Clear the screen and start a fresh chat",
    usage: "/clear",
    async run(_args, ctx) {
      ctx.clearScreen();
      const newId = ctx.sessions.create(ctx.client.model);
      console.log(chalk.gray(`Started new session: ${newId}\n`));
      // Update the active session id on ctx via setModel hack? No, we need a different approach.
      // The CLI loop checks ctx.sessionId - but we mutated sessions.create which returns new id.
      // We'll handle this by setting a global "current session" through ctx.
      (ctx as any)._newSessionId = newId;
    },
  },

  {
    name: "history",
    aliases: ["h"],
    description: "Show saved chat sessions",
    usage: "/history",
    async run(_args, ctx) {
      const list = ctx.sessions.list();
      if (list.length === 0) {
        console.log(chalk.gray("\n(no saved sessions)\n"));
        return;
      }
      console.log(chalk.cyan.bold("\n📜 Saved Sessions\n"));
      list.slice(0, 20).forEach((s, i) => {
        const date = new Date(s.createdAt).toLocaleString();
        const current = s.id === ctx.sessionId ? chalk.green("→ ") : "  ";
        console.log(
          `${current}${chalk.white.bold(`${i + 1}.`)} ${chalk.gray(date)} ${chalk.cyan(`[${s.model}]`)} (${s.messageCount} msgs)`,
        );
        console.log(`      ${chalk.gray(s.preview)}`);
        console.log(`      ${chalk.gray.italic(`id: ${s.id}`)}`);
      });
      console.log(chalk.gray("\nResume with:  /resume <id>\n"));
    },
  },

  {
    name: "resume",
    description: "Resume a saved session",
    usage: "/resume <id>",
    async run(args, ctx) {
      const id = args[0];
      if (!id) {
        console.log(chalk.red("Usage: /resume <id>"));
        return;
      }
      const data = ctx.sessions.load(id);
      if (!data) {
        console.log(chalk.red(`Session not found: ${id}`));
        return;
      }
      ctx.setModel(data.model);
      (ctx as any)._newSessionId = id;
      console.log(chalk.green(`✓ Resumed session ${id} (${data.messages.length} messages)\n`));
      // Show last few messages
      const recent = data.messages.slice(-6);
      for (const m of recent) {
        if (m.role === "user") console.log(chalk.cyan.bold("You: ") + m.content);
        else if (m.role === "assistant") console.log(chalk.magenta.bold("AI: ") + m.content);
      }
      console.log();
    },
  },

  {
    name: "run",
    aliases: ["exec", "$"],
    description: "Execute a shell command",
    usage: "/run <command>   (e.g. /run ls -la)",
    async run(args, _ctx) {
      const cmd = args.join(" ");
      if (!cmd) {
        console.log(chalk.red("Usage: /run <command>"));
        return;
      }
      console.log(runShell(cmd));
    },
  },

  {
    name: "read",
    description: "Read a file's contents",
    usage: "/read <path>",
    async run(args, _ctx) {
      const path = args[0];
      if (!path) {
        console.log(chalk.red("Usage: /read <path>"));
        return;
      }
      try {
        const safe = isAbsolute(path) ? path : resolve(process.cwd(), path);
        if (!existsSync(safe)) {
          console.log(chalk.red(`File not found: ${path}`));
          return;
        }
        const content = readFileSync(safe, "utf8");
        console.log(chalk.gray(`\n# ${path}\n`));
        console.log(content);
        console.log();
      } catch (e) {
        console.log(chalk.red((e as Error).message));
      }
    },
  },

  {
    name: "write",
    description: "Write to a file (usage: /write <path> ;; <content>)",
    usage: "/write <path> ;; <content>",
    async run(args, _ctx) {
      const input = args.join(" ");
      const [path, ...rest] = input.split(";;");
      const content = rest.join(";;").trim();
      if (!path?.trim() || !content) {
        console.log(chalk.red("Usage: /write <path> ;; <content>"));
        return;
      }
      try {
        const safePath = isAbsolute(path.trim()) ? path.trim() : resolve(process.cwd(), path.trim());
        writeFileSync(safePath, content, "utf8");
        console.log(chalk.green(`✓ Wrote ${content.length} chars to ${path.trim()}\n`));
      } catch (e) {
        console.log(chalk.red((e as Error).message));
      }
    },
  },

  {
    name: "ls",
    description: "List files in current or given directory",
    usage: "/ls [path]",
    async run(args, _ctx) {
      const path = args[0] ?? ".";
      const cmd = `ls -lh --color=always ${path} 2>/dev/null || ls -lh ${path}`;
      console.log(execSyncSafe(cmd).stdout || chalk.gray("(empty)"));
    },
  },

  {
    name: "tree",
    description: "Show directory tree (max depth 2)",
    usage: "/tree [path]",
    async run(args, _ctx) {
      const path = args[0] ?? ".";
      const cmd = `find ${path} -maxdepth ${args[1] ?? "2"} -not -path "*/node_modules/*" -not -path "*/.git/*" | head -50 | sort`;
      const res = execSyncSafe(cmd);
      console.log(chalk.cyan.bold(`\n${path}\n`));
      console.log(res.stdout || chalk.gray("(empty)"));
    },
  },

  {
    name: "grep",
    description: "Search file contents in the project",
    usage: "/grep <pattern>",
    async run(args, _ctx) {
      const pattern = args[0];
      if (!pattern) {
        console.log(chalk.red("Usage: /grep <pattern>"));
        return;
      }
      console.log(grep(pattern));
    },
  },

  {
    name: "find",
    description: "Find files by name pattern",
    usage: "/find <pattern>",
    async run(args, _ctx) {
      const pattern = args[0];
      if (!pattern) {
        console.log(chalk.red("Usage: /find <pattern>"));
        return;
      }
      console.log(searchFiles(pattern));
    },
  },

  {
    name: "search",
    aliases: ["web"],
    description: "Search the web (no API key, uses DuckDuckGo)",
    usage: "/search <query>",
    async run(args, _ctx) {
      const query = args.join(" ");
      if (!query) {
        console.log(chalk.red("Usage: /search <query>"));
        return;
      }
      console.log(chalk.cyan(`\n🔍 Searching: ${query}\n`));
      const results = await webSearch(query);
      console.log(formatSearchResults(results));
      console.log();
    },
  },

  {
    name: "git",
    description: "Git operations: status, log, diff, branches, add, commit",
    usage: "/git <subcommand>   (e.g. /git status)",
    async run(args, _ctx) {
      const sub = args[0] ?? "status";
      const g = new GitTool();
      if (!(await g.isRepo())) {
        console.log(chalk.gray("Not a git repository."));
        return;
      }
      switch (sub) {
        case "status":
        case "st":
          console.log(await g.status());
          break;
        case "log":
          console.log(await g.log(parseInt(args[1] ?? "10", 10)));
          break;
        case "diff":
          console.log(await g.diff(args[1]));
          break;
        case "branches":
        case "br":
          console.log(await g.branches());
          break;
        case "add":
          console.log(await g.add(args.slice(1)));
          break;
        case "commit":
          if (!args[1]) {
            console.log(chalk.red("Usage: /git commit <message>"));
            return;
          }
          console.log(await g.commit(args.slice(1).join(" ")));
          break;
        case "checkout":
        case "co":
          if (!args[1]) {
            console.log(chalk.red("Usage: /git checkout <branch>"));
            return;
          }
          console.log(await g.checkout(args[1]));
          break;
        case "summary":
          console.log(await g.summary());
          break;
        default:
          console.log(chalk.red(`Unknown git subcommand: ${sub}`));
          console.log(chalk.gray("Available: status, log, diff, branches, add, commit, checkout, summary"));
      }
      console.log();
    },
  },

  {
    name: "code",
    description: "Run a code file (auto-detects language)",
    usage: "/code <file>",
    async run(args, _ctx) {
      const file = args[0];
      if (!file) {
        console.log(chalk.red("Usage: /code <file>"));
        return;
      }
      const ext = file.split(".").pop()?.toLowerCase() ?? "";
      const runner = CODE_RUNNERS[ext];
      if (!runner) {
        console.log(chalk.red(`No runner for .${ext} files`));
        console.log(chalk.gray(`Supported: ${Object.keys(CODE_RUNNERS).join(", ")}`));
        return;
      }
      console.log(runShell(runner(file)));
    },
  },

  {
    name: "config",
    description: "Show current configuration",
    usage: "/config",
    async run(_args, ctx) {
      console.log(chalk.cyan.bold("\n⚙ Configuration\n"));
      console.log(`  ${chalk.gray("Ollama host:")}  ${CONFIG.ollamaHost}`);
      console.log(`  ${chalk.gray("Current model:")}  ${ctx.client.model}`);
      console.log(`  ${chalk.gray("Session:")}  ${ctx.sessionId}`);
      console.log(`  ${chalk.gray("Working dir:")}  ${process.cwd()}`);
      console.log(`  ${chalk.gray("History dir:")}  ${CONFIG.historyDir}`);
      console.log(`  ${chalk.gray("Max tokens:")}  ${CONFIG.maxTokens}`);
      console.log(`  ${chalk.gray("Temperature:")}  ${CONFIG.temperature}`);
      console.log();
    },
  },

  {
    name: "exit",
    aliases: ["quit", "q"],
    description: "Exit the CLI",
    usage: "/exit",
    async run(_args, ctx) {
      console.log(chalk.gray("\nGoodbye! 👋\n"));
      ctx.exit();
    },
  },
];

export function findCommand(name: string): SlashCommand | undefined {
  return commands.find((c) => c.name === name || c.aliases?.includes(name));
}
