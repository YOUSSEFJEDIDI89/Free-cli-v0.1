# Free CLI

A **multi-provider AI assistant** for your terminal. 100% free, with **zero-setup cloud** (Z.ai — no API key, no download), **local models** (Ollama), and **free-tier cloud APIs** (OpenRouter, Google Gemini, Groq, HuggingFace).

> **One-line install:** `curl -fsSL https://raw.githubusercontent.com/YOUSSEFJEDIDI89/Free-cli-v0.1/main/install.sh | bash`

---

## ✨ What's New in v2

| Feature | Description |
|---------|-------------|
| 🔌 **Multi-provider** | Switch between 6 providers with one command |
| 🌐 **Z.ai (zero-setup)** | Cloud, NO API key, NO download — uses bundled SDK |
| 🤖 **GLM-4.6 flagship** | Use Zhipu AI's latest model with zero configuration |
| ☁️ **OpenRouter free tier** | Llama 3.3 70B, Mistral, Gemma, Qwen, DeepSeek R1 — all free |
| 🎯 **Google Gemini** | Free tier with Gemini 1.5 Flash (1M context) and 2.0 Flash |
| ⚡ **Groq** | Ultra-fast inference (500+ tok/s) with Llama 3.3 70B |
| 🤗 **HuggingFace** | Free access to Llama 3.1, Mistral, Qwen, Gemma via Inference API |
| 🏠 **Ollama local** | 100% offline with GLM-4-9B, Llama 3.1, Qwen 2.5, etc. |
| 📜 **One-line install** | `curl ... \| bash` and you're ready to chat |

---

## 🚀 Quick Start

### Option 1: One-line install (recommended)

```bash
curl -fsSL https://raw.githubusercontent.com/YOUSSEFJEDIDI89/Free-cli-v0.1/main/install.sh | bash
```

Then run:
```bash
~/.free-cli/dist/index.js
# or if installed with --global:
free-cli
```

### Option 2: Manual install

```bash
git clone https://github.com/YOUSSEFJEDIDI89/Free-cli-v0.1.git free-cli
cd free-cli
npm install
npm run build
node dist/index.js
```

### Option 3: NPX (coming soon)

```bash
npx free-cli
```

---

## 🔌 Providers

Free CLI supports 6 providers. **Z.ai is the default** because it requires zero setup — no API key, no model download, just works out of the box.

### 1. Z.ai — Zero-Setup Cloud ⭐ Default

| Property | Value |
|----------|-------|
| Setup | **None** — works immediately |
| API key | **Not required** |
| Model download | **Not required** |
| Internet | Required |
| Cost | **Free** |
| Models | GLM-4.6 (flagship), GLM-4-Flash |

Uses the bundled `z-ai-web-dev-sdk` package. Perfect for instant use.

### 2. Ollama — 100% Local

| Property | Value |
|----------|-------|
| Setup | Install Ollama + pull a model |
| API key | Not required |
| Model download | **Required** (one-time per model) |
| Internet | Not required after download |
| Cost | **Free** |
| Models | GLM-4-9B, Llama 3.1, Qwen 2.5, DeepSeek Coder, Mistral, Phi-3 |

```bash
# Install Ollama
curl -fsSL https://ollama.com/install.sh | sh
ollama serve

# Pull a model
ollama pull glm4:9b     # ~5.5 GB, recommended
# or
ollama pull phi3:mini   # ~2.3 GB, for low-RAM machines

# Run Free CLI
free-cli
# Inside: /provider ollama
```

### 3. OpenRouter — Free Cloud API

| Property | Value |
|----------|-------|
| Setup | Sign up + get API key |
| API key | **Required** (free) |
| Model download | Not required |
| Internet | Required |
| Cost | **Free tier** (rate-limited) |
| Models | Llama 3.3 70B, Llama 3.1 8B, Mistral 7B, Gemma 2 9B, Qwen 2.5, DeepSeek R1, Hermes 3 405B |

```bash
# Get free API key: https://openrouter.ai/keys
free-cli
# Inside:
# /apikey openrouter sk-or-xxxxxxxxxxxx
# /provider openrouter
```

### 4. Google Gemini — Free Cloud API

| Property | Value |
|----------|-------|
| Setup | Sign up + get API key |
| API key | **Required** (free) |
| Model download | Not required |
| Internet | Required |
| Cost | **Free tier** |
| Models | Gemini 1.5 Flash (1M context), Gemini 1.5 Flash-8B, Gemini 1.5 Pro, Gemini 2.0 Flash |
| Free limits | Flash: 15 RPM, 1500 req/day • Pro: 2 RPM, 50 req/day |

```bash
# Get free API key: https://aistudio.google.com/app/apikey
free-cli
# Inside:
# /apikey google AIzaSyXXXXXXXXXXXX
# /provider google
```

### 5. Groq — Ultra-Fast Cloud API

| Property | Value |
|----------|-------|
| Setup | Sign up + get API key |
| API key | **Required** (free) |
| Model download | Not required |
| Internet | Required |
| Cost | **Free tier** |
| Speed | **500+ tokens/sec** (custom LPU hardware) |
| Models | Llama 3.3 70B, Llama 3.1 8B, Llama 3 70B, Mixtral 8x7B, Gemma 2 9B |

```bash
# Get free API key: https://console.groq.com/keys
free-cli
# Inside:
# /apikey groq gsk_XXXXXXXXXXXX
# /provider groq
```

### 6. HuggingFace — Free Cloud API

| Property | Value |
|----------|-------|
| Setup | Sign up + get token |
| API key | **Required** (free) |
| Model download | Not required |
| Internet | Required |
| Cost | **Free tier** |
| Models | Llama 3.1 8B, Mistral 7B, Qwen 2.5, Gemma 2 9B, DeepSeek V2.5 |

```bash
# Get free token: https://huggingface.co/settings/tokens
free-cli
# Inside:
# /apikey huggingface hf_XXXXXXXXXXXX
# /provider huggingface
```

---

## 🎮 Slash Commands

### Provider & Model Management
| Command | Description |
|---------|-------------|
| `/provider` | List all providers and their status |
| `/provider <id>` | Switch to a provider (e.g. `/provider zai`) |
| `/apikey <provider> <key>` | Set API key for a cloud provider |
| `/model` | Show models for active provider |
| `/model <id>` | Switch model (e.g. `/model glm-4.6`) |
| `/models` | List installed models (Ollama only) |
| `/pull <tag>` | Download a model (Ollama only) |

### Chat & Sessions
| Command | Description |
|---------|-------------|
| `/help` | Show all commands |
| `/clear` | Clear screen and start fresh chat |
| `/history` | List saved sessions |
| `/resume <id>` | Resume a saved session |

### File Operations
| Command | Description |
|---------|-------------|
| `/ls [path]` | List directory |
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
| `/git status` / `/git log` / `/git diff` | Git operations |
| `/git add` / `/git commit <msg>` / `/git checkout <branch>` | Git workflow |

### Other
| Command | Description |
|---------|-------------|
| `/config` | Show current configuration |
| `/exit` | Exit (or press Ctrl+C twice) |

---

## 📋 Usage Examples

### Quick chat with Z.ai (zero setup)
```bash
$ free-cli
[provider: zai] Ready. Model: glm-4.6
> Explain async/await in JavaScript
[zai] AI: ...
```

### Switch to Groq for ultra-fast responses
```bash
> /apikey groq gsk_xxxxxxxxxxxx
✓ API key set for Groq
> /provider groq
✓ Switched to Groq
> Write a Python function to sort a list
[groq] AI: ...  (500+ tokens/sec!)
```

### Use Ollama for fully offline use
```bash
> /provider ollama
✓ Switched to Ollama
> /model glm4:9b
✓ Switched to GLM-4-9B
> Hello!  (works offline, no internet needed)
```

### One-shot mode
```bash
free-cli "Translate 'hello' to French"
free-cli -m gemini-1.5-flash -p google "Write a haiku about coding"
```

---

## 🏗️ Architecture

```
free-cli/
├── src/
│   ├── index.ts              # Entry point
│   ├── cli.ts                # REPL loop
│   ├── config.ts             # Configuration
│   ├── session.ts            # Session persistence
│   ├── markdown.ts           # Markdown rendering
│   ├── ollama.ts             # Legacy Ollama client (kept for /pull command)
│   ├── providers/            # ← NEW: Multi-provider system
│   │   ├── types.ts          # Provider interface
│   │   ├── registry.ts       # Provider manager
│   │   ├── ollama.ts         # Local provider
│   │   ├── zai.ts            # Z.ai zero-setup cloud
│   │   ├── openrouter.ts     # OpenRouter free tier
│   │   ├── google.ts         # Google Gemini free tier
│   │   ├── groq.ts           # Groq ultra-fast
│   │   └── huggingface.ts    # HuggingFace Inference API
│   ├── commands/             # Slash commands
│   │   └── index.ts
│   ├── tools/                # File/shell/git/search tools
│   │   ├── files.ts
│   │   ├── exec.ts
│   │   ├── git.ts
│   │   └── search.ts
│   └── types/
│       └── marked-terminal.d.ts
├── scripts/
│   └── mock-ollama.py        # Mock server for testing
├── install.sh                # One-line installer
├── package.json
├── tsconfig.json
└── README.md
```

---

## ❓ FAQ

### Which provider should I use?

| Use case | Recommended provider |
|----------|---------------------|
| **Zero setup, instant use** | Z.ai (default) |
| **Privacy, fully offline** | Ollama |
| **Best quality (free)** | OpenRouter (Llama 3.3 70B) |
| **Fastest responses** | Groq (500+ tok/s) |
| **Long context (1M tokens)** | Google Gemini 1.5 Flash |
| **Low-RAM machine** | Ollama + Phi-3 Mini |

### Is this really 100% free?
**Yes.** All providers either:
- Bundle an SDK that authenticates without a personal key (Z.ai), OR
- Run locally on your machine (Ollama), OR
- Offer a free tier sufficient for personal use (OpenRouter, Google, Groq, HuggingFace)

### Do I need an internet connection?
- **Z.ai**: Yes (cloud)
- **Ollama**: No (after model download)
- **OpenRouter / Google / Groq / HuggingFace**: Yes (cloud APIs)

### Is my data private?
- **Ollama**: 100% private, never leaves your machine
- **Z.ai**: Uses Z.ai's cloud service
- **Cloud APIs (OpenRouter/Google/Groq/HF)**: Data goes to those services. Check their privacy policies.

### Can I use multiple providers?
Yes! Switch anytime with `/provider <id>`. Each provider keeps its own settings.

---

## 📄 License

MIT — use it, modify it, distribute it freely.

---

## 🙏 Acknowledgements

- [Z.ai](https://z.ai) — GLM-4.6 / GLM-4-Flash + the `z-ai-web-dev-sdk`
- [Ollama](https://ollama.com) — Local LLM runtime
- [Zhipu AI](https://www.zhipuai.cn) — GLM-4-9B model
- [OpenRouter](https://openrouter.ai) — Free cloud model aggregator
- [Google](https://ai.google.dev) — Gemini API
- [Groq](https://groq.com) — Ultra-fast LPU inference
- [HuggingFace](https://huggingface.co) — Inference API
- [Meta AI](https://ai.meta.com) — Llama 3.1 / 3.3
- [Alibaba](https://qwenlm.ai) — Qwen 2.5
- [Mistral AI](https://mistral.ai) — Mistral / Mixtral
