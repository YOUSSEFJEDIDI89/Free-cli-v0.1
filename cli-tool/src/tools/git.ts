import simpleGit, { type SimpleGit } from "simple-git";
import chalk from "chalk";

/**
 * Git integration - allows the assistant to inspect repos, show diffs,
 * create commits, switch branches, etc.
 */
export class GitTool {
  private git: SimpleGit;
  private cwd: string;

  constructor(cwd: string = process.cwd()) {
    this.cwd = cwd;
    this.git = simpleGit(cwd);
  }

  async isRepo(): Promise<boolean> {
    try {
      await this.git.status();
      return true;
    } catch {
      return false;
    }
  }

  async status(): Promise<string> {
    const s = await this.git.status();
    const lines: string[] = [];

    lines.push(chalk.cyan.bold(`Branch: ${chalk.white(s.current ?? "(detached)")}`));
    if (s.tracking) {
      lines.push(chalk.gray(`Tracking: ${s.tracking}`));
    }

    if (s.ahead > 0 || s.behind > 0) {
      lines.push(
        chalk.yellow(`↑${s.ahead} ↓${s.behind} relative to upstream`),
      );
    }

    const groups: { label: string; files: string[]; color: typeof chalk.green }[] = [
      { label: "Staged", files: s.staged, color: chalk.green },
      { label: "Modified", files: s.modified, color: chalk.yellow },
      { label: "Not added", files: s.not_added, color: chalk.red },
      { label: "Untracked", files: s.not_added.filter((f) => !s.modified.includes(f)), color: chalk.gray },
    ];

    for (const g of groups) {
      if (g.files.length === 0) continue;
      lines.push(`\n${g.color.bold(g.label)} (${g.files.length})`);
      g.files.forEach((f) => lines.push(`  ${g.color("•")} ${f}`));
    }

    if (s.conflicted.length > 0) {
      lines.push(`\n${chalk.red.bold("Conflicted")} (${s.conflicted.length})`);
      s.conflicted.forEach((f) => lines.push(`  ${chalk.red("•")} ${f}`));
    }

    return lines.join("\n");
  }

  async log(limit: number = 10): Promise<string> {
    const log = await this.git.log({ maxCount: limit });
    const lines: string[] = [];
    log.all.forEach((entry) => {
      const hash = chalk.yellow(entry.hash.slice(0, 7));
      const date = chalk.gray(entry.date.split(",")[0]);
      const author = chalk.cyan(entry.author_name);
      const msg = entry.message.split("\n")[0];
      lines.push(`${hash} ${date} ${author}\n    ${msg}`);
    });
    return lines.join("\n") || "(no commits)";
  }

  async diff(file?: string): Promise<string> {
    const diff = await this.git.diff(["--color", file].filter(Boolean) as string[]);
    return diff || "(no changes)";
  }

  async commit(message: string): Promise<string> {
    const res = await this.git.commit(message);
    return chalk.green(`✓ Committed ${res.commit.slice(0, 7)}: ${message}`);
  }

  async add(files: string[] = ["."]): Promise<string> {
    await this.git.add(files);
    return chalk.green(`✓ Added ${files.join(", ")}`);
  }

  async checkout(branch: string): Promise<string> {
    await this.git.checkout(branch);
    return chalk.green(`✓ Switched to ${branch}`);
  }

  async branches(): Promise<string> {
    const b = await this.git.branchLocal();
    const lines: string[] = [chalk.cyan.bold("Branches:")];
    b.all.forEach((name) => {
      const marker = name === b.current ? chalk.green("*") : " ";
      const display = name === b.current ? chalk.green.bold(name) : name;
      lines.push(`  ${marker} ${display}`);
    });
    return lines.join("\n");
  }

  async summary(): Promise<string> {
    if (!(await this.isRepo())) return chalk.gray("Not a git repository");
    const s = await this.git.status();
    const lastCommit = await this.git.log({ maxCount: 1 });
    const lines = [
      chalk.cyan.bold("Git Summary"),
      `Branch: ${chalk.white(s.current ?? "(detached)")}`,
      `Changes: ${chalk.yellow(s.files.length)} files`,
      `Last commit: ${lastCommit.latest?.hash.slice(0, 7) ?? "—"} ${
        lastCommit.latest?.message.split("\n")[0] ?? ""
      }`,
    ];
    return lines.join("\n");
  }
}
