import { execSync, spawn } from "node:child_process";
import chalk from "chalk";

/**
 * Code execution tool - runs shell commands and captures output.
 * Includes a basic safety check for dangerous commands.
 */

const DANGEROUS_PATTERNS = [
  /\brm\s+-rf\s+\//,
  /\bmkfs\b/,
  /\bdd\s+.*of=\/dev\//,
  /\b:\(\)\s*\{/,
  /\bshutdown\b/,
  /\breboot\b/,
  /\biptables\b/,
];

function isDangerous(cmd: string): boolean {
  return DANGEROUS_PATTERNS.some((p) => p.test(cmd));
}

export interface ExecResult {
  stdout: string;
  stderr: string;
  exitCode: number;
  duration: number;
}

/** Run a shell command synchronously and return trimmed output. */
export function execSyncSafe(cmd: string, opts?: { cwd?: string; timeout?: number }): ExecResult {
  const start = Date.now();
  try {
    if (isDangerous(cmd)) {
      throw new Error(`Blocked dangerous command: ${cmd}`);
    }
    const stdout = execSync(cmd, {
      cwd: opts?.cwd ?? process.cwd(),
      timeout: opts?.timeout ?? 30_000,
      encoding: "utf8",
      stdio: ["pipe", "pipe", "pipe"],
      maxBuffer: 1024 * 1024 * 10,
    });
    return {
      stdout: stdout.trim(),
      stderr: "",
      exitCode: 0,
      duration: Date.now() - start,
    };
  } catch (e: any) {
    return {
      stdout: (e.stdout ?? "").trim(),
      stderr: (e.stderr ?? e.message ?? "").trim(),
      exitCode: e.status ?? 1,
      duration: Date.now() - start,
    };
  }
}

/** Run a shell command and stream output to the terminal in real-time. */
export function execStream(cmd: string, opts?: { cwd?: string }): Promise<ExecResult> {
  return new Promise((resolve) => {
    if (isDangerous(cmd)) {
      resolve({
        stdout: "",
        stderr: `Blocked dangerous command: ${cmd}`,
        exitCode: 1,
        duration: 0,
      });
      return;
    }
    const start = Date.now();
    const [program, ...args] = cmd.split(/\s+/);
    const child = spawn(program, args, {
      cwd: opts?.cwd ?? process.cwd(),
      stdio: "inherit",
      shell: true,
    });
    let stdout = "";
    let stderr = "";
    child.on("close", (code) => {
      resolve({
        stdout,
        stderr,
        exitCode: code ?? 0,
        duration: Date.now() - start,
      });
    });
    child.on("error", (err) => {
      resolve({
        stdout,
        stderr: err.message,
        exitCode: 1,
        duration: Date.now() - start,
      });
    });
  });
}

/** Quick one-liner: run command, return colored output for the REPL. */
export function runShell(cmd: string): string {
  const res = execSyncSafe(cmd);
  const parts: string[] = [];
  parts.push(chalk.gray(`$ ${cmd}`));
  if (res.stdout) parts.push(res.stdout);
  if (res.stderr) parts.push(chalk.red(res.stderr));
  parts.push(chalk.gray(`[exit ${res.exitCode} in ${res.duration}ms]`));
  return parts.join("\n");
}

/** Supported code-execution languages with their runners. */
export const CODE_RUNNERS: Record<string, (file: string) => string> = {
  js: (f) => `node ${f}`,
  mjs: (f) => `node ${f}`,
  ts: (f) => `npx tsx ${f}`,
  py: (f) => `python3 ${f}`,
  sh: (f) => `bash ${f}`,
  rb: (f) => `ruby ${f}`,
  go: (f) => `go run ${f}`,
  rs: (f) => `rustc ${f} -o /tmp/run.out && /tmp/run.out`,
  c: (f) => `gcc ${f} -o /tmp/run.out && /tmp/run.out`,
  cpp: (f) => `g++ ${f} -o /tmp/run.out && /tmp/run.out`,
  java: (f) => `javac ${f} && java ${f.replace(/\.(java)$/, "")}`,
};
