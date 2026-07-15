# Free CLI

<div align="center">

```
███████╗███████╗   ██████╗██╗      ██████╗ ██╔═══██╗██████╗
██╔════╝██╔════╝   ██╔════╝██║     ██╔═══██╗██║   ██║██╔══██╗
█████╗  ███████╗   ██║     ██║     ██║   ██║██║   ██║██████╔╝
██╔══╝  ╚════██║   ██║     ██║     ██║   ██║██║   ██║██╔══██╗
███████╗███████║   ╚██████╗███████╗╚██████╔╝╚██████╔╝██████╔╝
╚══════╝╚══════╝    ╚═════╝╚══════╝ ╚═════╝  ╚═════╝ ╚═════╝
```

### A 100% free, multi-provider AI assistant for your terminal

**Z.ai • Ollama • OpenRouter • Google Gemini • Groq • HuggingFace**

[![MIT License](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)
[![Node.js 18+](https://img.shields.io/badge/Node.js-18%2B-blue.svg)](https://nodejs.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.7-blue.svg)](https://www.typescriptlang.org/)
[![100% Free](https://img.shields.io/badge/100%25-Free-success.svg)](#)

**Zero-setup cloud (no API key, no download) • Local models • Free-tier cloud APIs**

</div>

---

## 🚀 One-Line Install

```bash
curl -fsSL https://raw.githubusercontent.com/YOUSSEFJEDIDI89/Free-cli-v0.1/main/cli-tool/install.sh | bash
```

Then start chatting:

```bash
~/.free-cli/dist/index.js
```

That's it — **Z.ai (GLM-4.6) works immediately with zero configuration.**

---

## 🔌 6 Providers, One CLI

| # | Provider | Setup | API Key | Download | Best For |
|---|----------|-------|---------|----------|----------|
| 1 | **Z.ai** ⭐ Default | **Zero** | ❌ No | ❌ No | Instant use, GLM-4.6 flagship |
| 2 | **Ollama** | Install daemon | ❌ No | ✅ Yes | 100% local, privacy, offline |
| 3 | **OpenRouter** | Sign up | ✅ Free | ❌ No | Llama 3.3 70B, DeepSeek R1 |
| 4 | **Google Gemini** | Sign up | ✅ Free | ❌ No | 1M context, Gemini 2.0 Flash |
| 5 | **Groq** | Sign up | ✅ Free | ❌ No | Ultra-fast (500+ tok/s) |
| 6 | **HuggingFace** | Sign up | ✅ Free | ❌ No | Largest model variety |

### Switch providers instantly:

```
> /provider zai          # Zero-setup cloud
> /provider ollama       # 100% local
> /provider openrouter   # Free cloud API (after /apikey)
> /provider google       # Free cloud API (after /apikey)
> /provider groq         # Ultra-fast cloud (after /apikey)
> /provider huggingface  # Free cloud API (after /apikey)
```

---

## ✨ Features

- 🤖 **Multi-turn chat** with streaming responses
- 📝 **Markdown rendering** with syntax-highlighted code blocks
- 📁 **File operations** — read, write, edit, ls, tree, find, grep
- ⚡ **Code execution** — Python, JS, TS, Go, Rust, C/C++, Java, shell
- 🌿 **Git integration** — status, log, diff, branches, add, commit, checkout
- 🔍 **Web search** via DuckDuckGo (no API key)
- 💾 **Session persistence** — save and resume chats
- 🎨 **Rich TUI** — colors, banners, progress bars, slash commands
- 📜 **History** with arrow-key navigation
- 🎯 **Tab completion** for slash commands

---

## 📦 Quick Start (Manual)

```bash
git clone https://github.com/YOUSSEFJEDIDI89/Free-cli-v0.1.git
cd Free-cli-v0.1/cli-tool
npm install
npm run build
node dist/index.js
```

**Optional — for local Ollama provider:**

```bash
curl -fsSL https://ollama.com/install.sh | sh
ollama serve
ollama pull glm4:9b
```

---

## 🎮 Usage

### Interactive REPL

```bash
free-cli                          # default provider (Z.ai)
free-cli -m glm-4-flash           # specific model
```

### One-shot mode

```bash
free-cli "Explain async/await"
free-cli -m gemini-1.5-flash -p google "Write a haiku"
```

### Slash commands (inside REPL)

| Command | Description |
|---------|-------------|
| `/help` | Show all commands |
| `/provider [id]` | List or switch providers |
| `/apikey <p> <key>` | Set API key for cloud provider |
| `/model [id]` | List or switch models |
| `/clear` | Clear screen + new chat |
| `/read <path>` | Read a file |
| `/write <path> ;; <content>` | Write a file |
| `/run <cmd>` | Execute shell command |
| `/search <query>` | Web search (DuckDuckGo) |
| `/git status` | Git operations |
| `/history` | List saved sessions |
| `/config` | Show configuration |
| `/exit` | Exit (or Ctrl+C twice) |

---

## 🤖 Available Models

### Z.ai (zero-setup)
- **GLM-4.6** (flagship) — best Arabic support, strong reasoning
- **GLM-4-Flash** — fast and efficient

### Ollama (local)
- GLM-4-9B, Llama 3.1 8B, Qwen 2.5 7B, DeepSeek Coder V2 16B, Mistral 7B, Phi-3 Mini

### OpenRouter (free)
- Llama 3.3 70B, Llama 3.1 8B, Mistral 7B, Gemma 2 9B, Qwen 2.5 7B, DeepSeek R1, Hermes 3 405B

### Google Gemini (free)
- Gemini 1.5 Flash (1M context), Gemini 1.5 Flash-8B, Gemini 1.5 Pro, Gemini 2.0 Flash

### Groq (free, ultra-fast)
- Llama 3.3 70B, Llama 3.1 8B, Llama 3 70B, Mixtral 8x7B, Gemma 2 9B

### HuggingFace (free)
- Llama 3.1 8B, Mistral 7B, Qwen 2.5 7B, Gemma 2 9B, DeepSeek V2.5

---

## 🔑 Get Free API Keys

| Provider | URL | Free Tier |
|----------|-----|-----------|
| OpenRouter | https://openrouter.ai/keys | Llama 3.3 70B + 50+ models |
| Google | https://aistudio.google.com/app/apikey | 1500 req/day (Flash) |
| Groq | https://console.groq.com/keys | 30 RPM, 14400 req/day |
| HuggingFace | https://huggingface.co/settings/tokens | Inference API access |

---

## 📂 Project Structure

```
Free-cli-v0.1/
├── README.md                  ← You are here
├── cli-tool/                  ← Main project
│   ├── src/
│   │   ├── index.ts           # Entry point
│   │   ├── cli.ts             # REPL loop
│   │   ├── config.ts          # Configuration
│   │   ├── providers/         # Multi-provider system
│   │   │   ├── types.ts       # Provider interface
│   │   │   ├── registry.ts    # Provider manager
│   │   │   ├── zai.ts         # Z.ai (zero-setup)
│   │   │   ├── ollama.ts      # Local
│   │   │   ├── openrouter.ts  # Free cloud API
│   │   │   ├── google.ts      # Gemini
│   │   │   ├── groq.ts        # Ultra-fast
│   │   │   └── huggingface.ts # HF Inference
│   │   ├── commands/          # Slash commands
│   │   ├── tools/             # File/shell/git/search
│   │   └── types/
│   ├── scripts/
│   │   └── mock-ollama.py     # Test server
│   ├── install.sh             # One-line installer
│   ├── package.json
│   ├── tsconfig.json
│   └── README.md              # Detailed docs
├── scripts/
│   ├── test-cli.sh            # v1 tests
│   └── test-cli-v2.sh         # v2 tests
└── LICENSE                    # MIT
```

---

## ❓ FAQ

### Which provider should I use?

| Use case | Recommended |
|----------|-------------|
| Zero setup, instant use | **Z.ai** (default) |
| Privacy, fully offline | **Ollama** |
| Best quality (free) | **OpenRouter** (Llama 3.3 70B) |
| Fastest responses | **Groq** (500+ tok/s) |
| Long context (1M tokens) | **Google Gemini 1.5 Flash** |
| Low-RAM machine | **Ollama + Phi-3 Mini** |

### Is this really 100% free?

**Yes.** All providers either:
- Bundle an SDK that authenticates without a personal key (Z.ai), OR
- Run locally on your machine (Ollama), OR
- Offer a free tier sufficient for personal use (OpenRouter, Google, Groq, HuggingFace)

### Is my data private?

- **Ollama**: 100% private, never leaves your machine
- **Z.ai**: Uses Z.ai's cloud (GLM-4.6)
- **Cloud APIs**: Data goes to those services — check their privacy policies

---

## 📄 License

MIT — use it, modify it, distribute it freely.

---

## 🙏 Acknowledgements

- [Z.ai](https://z.ai) — GLM-4.6 + z-ai-web-dev-sdk
- [Ollama](https://ollama.com) — Local LLM runtime
- [Zhipu AI](https://www.zhipuai.cn) — GLM-4-9B
- [OpenRouter](https://openrouter.ai) — Free cloud model aggregator
- [Google](https://ai.google.dev) — Gemini API
- [Groq](https://groq.com) — Ultra-fast LPU inference
- [HuggingFace](https://huggingface.co) — Inference API
- [Meta AI](https://ai.meta.com) — Llama 3.1 / 3.3
- [Alibaba](https://qwenlm.ai) — Qwen 2.5
- [Mistral AI](https://mistral.ai) — Mistral / Mixtral

---

<div align="center">

**⭐ If you find this useful, please star the repository! ⭐**

Made with ❤️ by [YOUSSEFJEDIDI89](https://github.com/YOUSSEFJEDIDI89)

</div>
