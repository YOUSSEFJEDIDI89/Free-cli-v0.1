import { readFileSync, writeFileSync, existsSync, readdirSync, statSync, mkdirSync, unlinkSync, renameSync } from "node:fs";
import { join, dirname, basename, extname, relative, resolve } from "node:path";
import chalk from "chalk";

/**
 * File operation tools - similar to Claude Code's file editing capabilities.
 * All operations are sandboxed to the current working directory by default.
 */

export interface FileTool {
  name: string;
  description: string;
  run: (args: string[]) => Promise<string>;
}

function safePath(p: string): string {
  const resolved = resolve(process.cwd(), p);
  // Prevent escaping cwd via ../
  if (!resolved.startsWith(process.cwd())) {
    throw new Error(`Path ${p} escapes working directory`);
  }
  return resolved;
}

export const fileTools: FileTool[] = [
  {
    name: "read",
    description: "Read the contents of a file. Usage: read <path>",
    async run(args) {
      const path = args[0];
      if (!path) return "Error: path required";
      try {
        const safe = safePath(path);
        if (!existsSync(safe)) return `Error: ${path} does not exist`;
        const content = readFileSync(safe, "utf8");
        const stats = statSync(safe);
        const lines = content.split("\n").length;
        return chalk.gray(`# ${path} (${lines} lines, ${stats.size} bytes)\n\n`) + content;
      } catch (e) {
        return `Error: ${(e as Error).message}`;
      }
    },
  },
  {
    name: "write",
    description: "Write content to a file. Usage: write <path> <content>",
    async run(args) {
      const path = args[0];
      const content = args.slice(1).join(" ");
      if (!path) return "Error: path required";
      try {
        const safe = safePath(path);
        mkdirSync(dirname(safe), { recursive: true });
        writeFileSync(safe, content, "utf8");
        return chalk.green(`✓ Wrote ${content.length} chars to ${path}`);
      } catch (e) {
        return `Error: ${(e as Error).message}`;
      }
    },
  },
  {
    name: "edit",
    description: "Replace text in a file. Usage: edit <path> <old> ||| <new>",
    async run(args) {
      const path = args[0];
      const rest = args.slice(1).join(" ");
      const [oldText, newText] = rest.split("|||");
      if (!path || !oldText) return "Error: usage: edit <path> <old> ||| <new>";
      try {
        const safe = safePath(path);
        if (!existsSync(safe)) return `Error: ${path} does not exist`;
        const content = readFileSync(safe, "utf8");
        if (!content.includes(oldText.trim())) return `Error: text not found in ${path}`;
        const updated = content.replace(oldText.trim(), newText?.trim() ?? "");
        writeFileSync(safe, updated, "utf8");
        return chalk.green(`✓ Edited ${path}`);
      } catch (e) {
        return `Error: ${(e as Error).message}`;
      }
    },
  },
  {
    name: "ls",
    description: "List directory contents. Usage: ls [path]",
    async run(args) {
      const path = args[0] ?? ".";
      try {
        const safe = safePath(path);
        const entries = readdirSync(safe, { withFileTypes: true });
        const lines = entries.map((e) => {
          const isDir = e.isDirectory();
          const icon = isDir ? chalk.blue("📁") : chalk.green("📄");
          const name = isDir ? chalk.blue.bold(e.name) : e.name;
          return `${icon} ${name}`;
        });
        return lines.join("\n") || "(empty)";
      } catch (e) {
        return `Error: ${(e as Error).message}`;
      }
    },
  },
  {
    name: "rm",
    description: "Delete a file. Usage: rm <path>",
    async run(args) {
      const path = args[0];
      if (!path) return "Error: path required";
      try {
        const safe = safePath(path);
        unlinkSync(safe);
        return chalk.green(`✓ Deleted ${path}`);
      } catch (e) {
        return `Error: ${(e as Error).message}`;
      }
    },
  },
  {
    name: "mv",
    description: "Move/rename a file. Usage: mv <src> <dst>",
    async run(args) {
      const [src, dst] = args;
      if (!src || !dst) return "Error: usage: mv <src> <dst>";
      try {
        renameSync(safePath(src), safePath(dst));
        return chalk.green(`✓ Moved ${src} → ${dst}`);
      } catch (e) {
        return `Error: ${(e as Error).message}`;
      }
    },
  },
  {
    name: "tree",
    description: "Show directory tree. Usage: tree [path] [depth]",
    async run(args) {
      const path = args[0] ?? ".";
      const maxDepth = parseInt(args[1] ?? "2", 10);
      const safe = safePath(path);
      const lines: string[] = [];

      const walk = (dir: string, prefix: string, depth: number) => {
        if (depth > maxDepth) return;
        const entries = readdirSync(dir, { withFileTypes: true }).sort((a, b) => {
          if (a.isDirectory() !== b.isDirectory()) return a.isDirectory() ? -1 : 1;
          return a.name.localeCompare(b.name);
        });
        entries.forEach((e, i) => {
          const last = i === entries.length - 1;
          const branch = last ? "└── " : "├── ";
          const icon = e.isDirectory() ? chalk.blue("📁") : chalk.green("📄");
          const name = e.isDirectory() ? chalk.blue.bold(e.name) : e.name;
          lines.push(`${prefix}${branch}${icon} ${name}`);
          if (e.isDirectory()) {
            walk(join(dir, e.name), prefix + (last ? "    " : "│   "), depth + 1);
          }
        });
      };

      lines.push(chalk.cyan.bold(path));
      walk(safe, "", 1);
      return lines.join("\n");
    },
  },
];

export function findFileTool(name: string): FileTool | undefined {
  return fileTools.find((t) => t.name === name);
}
