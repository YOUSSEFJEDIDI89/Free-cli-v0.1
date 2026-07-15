# Free CLI

A **100% free, local-first AI assistant** for your terminal. No API keys. No credit card. No data leaves your machine.

Powered by [Ollama](https://ollama.com) + **GLM-4-9B** (the open-source model from Zhipu AI — closest free equivalent to "GLM 4.6"). Also supports Llama 3.1, Qwen 2.5, DeepSeek Coder, Mistral, and Phi-3.

---

## ✨ Features

| Feature | Description |
|---------|-------------|
| 🤖 **Local AI** | Runs entirely on your machine via Ollama — zero API costs |
| 🌍 **GLM-4-9B** | Pre-configured for the latest open-source Zhipu AI model |
| 💬 **Multi-turn chat** | Full conversation context with streaming responses |
| 📝 **Markdown rendering** | Colored output with syntax-highlighted code blocks |
| 📁 **File operations** | Read, write, list, and edit files like a code assistant |
| ⚡ **Code execution** | Run shell commands and code files (Python, JS, TS, Go, Rust, C/C++, Java) |
| 🔍 **Web search** | Search the web via DuckDuckGo — no API key needed |
| 🌿 **Git integration** | Status, log, diff, branches, add, commit, checkout |
| 💾 **Session persistence** | Save and resume chat sessions |
| 🎨 **Rich TUI** | Colored output, banners, progress bars, slash commands |
| 📜 **History** | Command history with arrow-key navigation |

---

## 🚀 Quick Start

### 1. Install Ollama

**Linux / WSL:**
```bash
curl -fsSL https://ollama.com/install.sh | sh
```

**macOS:**
```bash
brew install ollama
```

**Windows:** Download from [ollama.com](https://ollama.com/download)

### 2. Start the Ollama daemon

```bash
ollama serve
```

### 3. Pull a model

```bash
ollama pull glm4:9b       # GLM-4-9B (recommended, ~5.5 GB)
# or
ollama pull phi3:mini     # Smaller model if you have limited RAM (~2.3 GB)
```

### 4. Install Free CLI

```bash
git clone <this-repo> free-cli
cd free-cli
npm install
npm run build
npm link          # makes `free-cli` available globally
```

### 5. Run it!

```bash
free-cli
```

---

## 📖 Usage

### Interactive REPL mode

```bash
free-cli                        # start with default model (glm4:9b)
free-cli -m llama3.1:8b         # start with a specific model
```

Then type naturally:
```
> Hello, what can you do?
> Write a Python function to sort a list
> Read the file src/index.ts and explain it
```

### One-shot mode

```bash
free-cli "Explain async/await in JavaScript"
free-cli -m llama3.1:8b "Translate 'hello' to French"
```

---

## 🎮 Slash Commands

Type any of these in the REPL:

### Model Management
| Command | Description |
|---------|-------------|
| `/help` | Show all available commands |
| `/model` | Show model catalogue + switch model |
| `/models` | List installed models |
| `/pull <tag>` | Download a model (e.g. `/pull glm4:9b`) |

### Chat & Sessions
| Command | Description |
|---------|-------------|
| `/clear` | Clear screen and start fresh chat |
| `/history` | List saved sessions |
| `/resume <id>` | Resume a saved session |

### File Operations
| Command | Description |
|---------|-------------|
| `/ls [path]` | List directory contents |
| `/tree [path] [depth]` | Show directory tree |
| `/read <path>` | Read a file |
| `/write <path> ;; <content>` | Write to a file |
| `/find <pattern>` | Find files by name |
| `/grep <pattern>` | Search file contents |

### Code & Shell
| Command | Description |
|---------|-------------|
| `/run <cmd>` | Execute a shell command |
| `/code <file>` | Run a code file (auto-detects language) |

### Web & Git
| Command | Description |
|---------|-------------|
| `/search <query>` | Search the web (DuckDuckGo, no API key) |
| `/git status` | Git status |
| `/git log [n]` | Git log (last n commits) |
| `/git diff [file]` | Show changes |
| `/git branches` | List branches |
| `/git add [files]` | Stage files |
| `/git commit <msg>` | Commit changes |
| `/git checkout <branch>` | Switch branch |

### Other
| Command | Description |
|---------|-------------|
| `/config` | Show current configuration |
| `/exit` | Exit the CLI (or press Ctrl+C twice) |

---

## 🤖 Available Models

| Model | Tag | Size | RAM | Best For |
|-------|-----|------|-----|----------|
| **GLM-4-9B** ⭐ | `glm4:9b` | ~5.5 GB | 8 GB+ | Arabic, coding, reasoning |
| Llama 3.1 8B | `llama3.1:8b` | ~4.7 GB | 8 GB+ | General purpose |
| Qwen 2.5 7B | `qwen2.5:7b` | ~4.4 GB | 8 GB+ | Arabic & Chinese |
| DeepSeek Coder V2 | `deepseek-coder-v2:16b` | ~8.9 GB | 16 GB+ | Programming |
| Mistral 7B | `mistral:7b` | ~4.1 GB | 6 GB+ | Fast & lightweight |
| Phi-3 Mini | `phi3:mini` | ~2.3 GB | 4 GB+ | Low-end machines |

Pull any model with: `ollama pull <tag>` or `/pull <tag>` inside the CLI.

---

## ⚙️ Configuration

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `OLLAMA_HOST` | `http://localhost:11434` | Ollama daemon URL |

### Config File

Edit `src/config.ts` to change:
- Default system prompt
- Max tokens / temperature
- Context window size
- History directory

---

## 🏗️ Project Structure

```
free-cli/
├── src/
│   ├── index.ts           # Entry point (CLI arg parsing)
│   ├── cli.ts             # REPL loop + command queue
│   ├── config.ts          # Models catalogue + config
│   ├── ollama.ts          # Ollama client wrapper
│   ├── session.ts         # Session persistence
│   ├── markdown.ts        # Markdown renderer
│   ├── commands/
│   │   └── index.ts       # All slash commands
│   ├── tools/
│   │   ├── files.ts       # File operations
│   │   ├── exec.ts        # Shell + code execution
│   │   ├── git.ts         # Git integration
│   │   └── search.ts      # Web + file search
│   └── types/
│       └── marked-terminal.d.ts
├── scripts/
│   └── mock-ollama.py     # Mock server for testing
├── package.json
├── tsconfig.json
└── README.md
```

---

## 🧪 Testing

A mock Ollama server is included for testing without installing Ollama:

```bash
# Start mock server
python3 scripts/mock-ollama.py &

# Run the CLI against it
OLLAMA_HOST=http://localhost:11434 node dist/index.js

# Or run the test suite
bash ../scripts/test-cli.sh
```

---

## ❓ FAQ

### Is this really 100% free?
**Yes.** Ollama runs models locally on your machine. No API keys, no credit card, no monthly limits. The only cost is electricity and RAM.

### What is GLM-4-9B?
It's the latest open-source model from Zhipu AI, released under a permissive license. It's the closest free, downloadable equivalent to the commercial "GLM-4.6" API. It excels at Arabic, Chinese, English, and coding tasks.

### Do I need an internet connection?
Only for:
1. Downloading Ollama (one-time)
2. Pulling models (one-time per model)
3. The `/search` web command

Everything else — chat, file ops, code execution, git — works fully offline.

### How much RAM do I need?
- **4 GB**: Phi-3 Mini
- **6 GB**: Mistral 7B
- **8 GB**: GLM-4-9B, Llama 3.1, Qwen 2.5
- **16 GB**: DeepSeek Coder V2

### Can I use this on Windows?
Yes. Install Ollama for Windows, then run Free CLI with Node.js (use WSL2 for best results).

### Is my data private?
**Completely.** All inference happens locally. No conversation data is sent to any server. The only network calls are:
- Ollama's model registry (when pulling models)
- DuckDuckGo (only when you use `/search`)

---

## 📄 License

MIT — use it, modify it, distribute it freely.

---

## 🙏 Acknowledgements

- [Ollama](https://ollama.com) — local LLM runtime
- [Zhipu AI](https://www.zhipuai.cn) — GLM-4-9B model
- [Meta AI](https://ai.meta.com) — Llama 3.1
- [Alibaba](https://qwenlm.ai) — Qwen 2.5
- [Microsoft](https://microsoft.com) — Phi-3
