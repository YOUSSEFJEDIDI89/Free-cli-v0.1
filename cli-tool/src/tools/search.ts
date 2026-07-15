import { execSyncSafe } from "./exec.js";
import chalk from "chalk";

/**
 * Web search without any API key - uses DuckDuckGo HTML endpoint.
 * Falls back gracefully when offline.
 */

export interface SearchResult {
  title: string;
  url: string;
  snippet: string;
}

/** Search the web via DuckDuckGo's HTML endpoint (no API key required). */
export async function webSearch(query: string, limit: number = 5): Promise<SearchResult[]> {
  // Use curl + simple regex parsing - no external deps.
  const cmd = `curl -s -A "Mozilla/5.0" "https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}"`;
  const res = execSyncSafe(cmd, { timeout: 15_000 });

  if (res.exitCode !== 0 || !res.stdout) {
    return [];
  }

  const html = res.stdout;
  const results: SearchResult[] = [];

  // Parse result blocks. DuckDuckGo HTML uses class="result__body"
  const blockRegex = /<a[^>]+class="result__a"[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>[\s\S]*?<a[^>]+class="result__snippet"[^>]*>([\s\S]*?)<\/a>/g;
  let match: RegExpExecArray | null;
  while ((match = blockRegex.exec(html)) && results.length < limit) {
    const rawUrl = match[1];
    const url = decodeDdgUrl(rawUrl);
    const title = stripTags(match[2]).trim();
    const snippet = stripTags(match[3]).trim();
    if (title && url) {
      results.push({ title, url, snippet });
    }
  }

  return results;
}

function decodeDdgUrl(raw: string): string {
  // DDG wraps URLs like //duckduckgo.com/l/?uddg=<encoded>
  const m = raw.match(/uddg=([^&]+)/);
  if (m) {
    try {
      return decodeURIComponent(m[1]);
    } catch {
      return raw;
    }
  }
  return raw.startsWith("//") ? `https:${raw}` : raw;
}

function stripTags(html: string): string {
  return html
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#x27;/g, "'")
    .replace(/\s+/g, " ");
}

/** Search files in the project by name pattern. */
export function searchFiles(pattern: string, cwd: string = process.cwd()): string {
  const cmd = `find ${cwd} -type f -name "${pattern}" -not -path "*/node_modules/*" -not -path "*/.git/*" 2>/dev/null | head -50`;
  const res = execSyncSafe(cmd, { timeout: 10_000 });
  if (!res.stdout) return chalk.gray("(no matches)");
  return res.stdout;
}

/** Search file contents with grep. */
export function grep(pattern: string, cwd: string = process.cwd()): string {
  const cmd = `grep -rn --include="*.{ts,js,py,go,rs,md,txt,json,yaml,yml}" "${pattern}" ${cwd} 2>/dev/null | grep -v node_modules | grep -v "/.git/" | head -30`;
  const res = execSyncSafe(cmd, { timeout: 10_000 });
  if (!res.stdout) return chalk.gray("(no matches)");
  return res.stdout;
}

/** Format search results for display. */
export function formatSearchResults(results: SearchResult[]): string {
  if (results.length === 0) return chalk.gray("(no results)");
  return results
    .map((r, i) => {
      return [
        `${chalk.cyan.bold(`${i + 1}.`)} ${chalk.white.bold(r.title)}`,
        `   ${chalk.gray.underline(r.url)}`,
        `   ${chalk.gray(r.snippet)}`,
      ].join("\n");
    })
    .join("\n\n");
}
