import { Marked } from "marked";
import { markedTerminal } from "marked-terminal";
import chalk from "chalk";
import { highlight } from "cli-highlight";

/**
 * Markdown renderer that produces coloured terminal output.
 * Uses marked-terminal for layout + cli-highlight for code blocks.
 *
 * Note: marked v14 uses `marked.use(extension)` instead of `setOptions({renderer})`.
 */
const marked = new Marked();

marked.use(
  markedTerminal({
    // Refine code block rendering: syntax-highlight known languages.
    code(code: string, lang?: string): string {
      const language = (lang ?? "").trim().toLowerCase();
      try {
        if (language) {
          return highlight(code, { language, ignoreIllegals: true });
        }
      } catch {
        /* fall through to plain */
      }
      return chalk.gray(code);
    },
    // Slightly nicer heading colour
    heading(text: string, level: number): string {
      const colors = [
        chalk.magenta.bold,
        chalk.magenta.bold,
        chalk.cyan.bold,
        chalk.cyan.bold,
        chalk.blue.bold,
        chalk.blue.bold,
      ];
      const fn = colors[level - 1] ?? chalk.blue.bold;
      return fn(text);
    },
    strong(text: string): string {
      return chalk.white.bold(text);
    },
    em(text: string): string {
      return chalk.italic.yellow(text);
    },
    listitem(text: string): string {
      return `  ${chalk.cyan("•")} ${text}`;
    },
    blockquote(text: string): string {
      return chalk.gray(`  │ ${text}`);
    },
    codespan(code: string): string {
      return chalk.cyan(`\`${code}\``);
    },
    link(href: string, _title: string | null, text: string): string {
      return `${chalk.underline.blue(text)} ${chalk.gray(`(${href})`)}`;
    },
  } as any),
);

export function renderMarkdown(input: string): string {
  try {
    return marked.parse(input) as string;
  } catch {
    return input;
  }
}
