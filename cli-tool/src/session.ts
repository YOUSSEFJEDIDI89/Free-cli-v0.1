import { existsSync, mkdirSync, readFileSync, writeFileSync, readdirSync, unlinkSync } from "node:fs";
import { join } from "node:path";
import { CONFIG } from "./config.js";

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
  timestamp: number;
}

/**
 * Persistent session store. Each session is a JSON file under ~/.free-cli/sessions/.
 * Format: { id, model, createdAt, messages: ChatMessage[] }
 */
export class SessionStore {
  private dir: string;

  constructor() {
    this.dir = join(CONFIG.historyDir, "sessions");
    if (!existsSync(this.dir)) {
      mkdirSync(this.dir, { recursive: true });
    }
  }

  /** Create a new empty session. */
  create(model: string): string {
    const id = `s_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const data = {
      id,
      model,
      createdAt: Date.now(),
      messages: [] as ChatMessage[],
    };
    this.save(data);
    return id;
  }

  /** Load a session by id. */
  load(id: string): { id: string; model: string; createdAt: number; messages: ChatMessage[] } | null {
    const file = join(this.dir, `${id}.json`);
    if (!existsSync(file)) return null;
    try {
      return JSON.parse(readFileSync(file, "utf8"));
    } catch {
      return null;
    }
  }

  /** Save / overwrite a session. */
  save(data: {
    id: string;
    model: string;
    createdAt: number;
    messages: ChatMessage[];
  }): void {
    const file = join(this.dir, `${data.id}.json`);
    writeFileSync(file, JSON.stringify(data, null, 2));
  }

  /** Append a message to a session. */
  append(id: string, msg: ChatMessage): void {
    const data = this.load(id);
    if (!data) return;
    data.messages.push(msg);
    this.save(data);
  }

  /** List all saved sessions, newest first. */
  list(): { id: string; model: string; createdAt: number; messageCount: number; preview: string }[] {
    if (!existsSync(this.dir)) return [];
    return readdirSync(this.dir)
      .filter((f) => f.endsWith(".json"))
      .map((f) => {
        try {
          const data = JSON.parse(readFileSync(join(this.dir, f), "utf8"));
          const firstUser = data.messages.find((m: ChatMessage) => m.role === "user");
          return {
            id: data.id,
            model: data.model,
            createdAt: data.createdAt,
            messageCount: data.messages.length,
            preview: firstUser ? firstUser.content.slice(0, 60) : "(empty)",
          };
        } catch {
          return null;
        }
      })
      .filter((x): x is NonNullable<typeof x> => x !== null)
      .sort((a, b) => b.createdAt - a.createdAt);
  }

  /** Delete a session. */
  delete(id: string): boolean {
    const file = join(this.dir, `${id}.json`);
    if (!existsSync(file)) return false;
    try {
      unlinkSync(file);
      return true;
    } catch {
      return false;
    }
  }
}
