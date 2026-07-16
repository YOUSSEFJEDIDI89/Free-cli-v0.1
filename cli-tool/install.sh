#!/bin/bash
# One-line installer for Free CLI
# Usage:
#   curl -fsSL https://raw.githubusercontent.com/YOUSSEFJEDIDI89/Free-cli-v0.1/main/install.sh | bash
#
# Or with options:
#   curl -fsSL https://raw.githubusercontent.com/YOUSSEFJEDIDI89/Free-cli-v0.1/main/install.sh | bash -s -- --provider zai
#   curl -fsSL https://raw.githubusercontent.com/YOUSSEFJEDIDI89/Free-cli-v0.1/main/install.sh | bash -s -- --provider ollama
#   curl -fsSL https://raw.githubusercontent.com/YOUSSEFJEDIDI89/Free-cli-v0.1/main/install.sh | bash -s -- --global

set -e

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
CYAN='\033[0;36m'
NC='\033[0m'

echo ""
echo "  ╔══════════════════════════════════════════╗"
echo "  ║          Free CLI - Installer v2          ║"
echo "  ║  Multi-provider • Z.ai + Ollama + more    ║"
echo "  ╚══════════════════════════════════════════╝"
echo ""

INSTALL_DIR="${HOME}/.free-cli"
GLOBAL=false
PROVIDER=""

# Parse args
while [[ $# -gt 0 ]]; do
  case $1 in
    --global)
      GLOBAL=true
      shift
      ;;
    --provider)
      PROVIDER="$2"
      shift 2
      ;;
    --dir)
      INSTALL_DIR="$2"
      shift 2
      ;;
    --help)
      echo "Usage: bash install.sh [--global] [--provider <id>] [--dir <path>]"
      echo ""
      echo "Options:"
      echo "  --global            Install globally (npm link)"
      echo "  --provider <id>     Pre-configure default provider (zai, ollama, openrouter, google, groq, huggingface)"
      echo "  --dir <path>        Install directory (default: ~/.free-cli)"
      exit 0
      ;;
    *)
      echo "Unknown option: $1"
      exit 1
      ;;
  esac
done

# Detect Termux environment (Android terminal)
IS_TERMUX=false
if [ -n "$TERMUX_VERSION" ] || [ -d "/data/data/com.termux" ] || echo "$PREFIX" | grep -q "com.termux"; then
    IS_TERMUX=true
    echo -e "${YELLOW}📱 Detected Termux (Android). Using Termux-compatible setup.${NC}"
fi

# Step 1: Check Node.js
echo -e "${CYAN}[1/5]${NC} Checking Node.js..."
if ! command -v node &> /dev/null; then
    echo -e "${RED}✗ Node.js is not installed.${NC}"
    if [ "$IS_TERMUX" = true ]; then
        echo -e "  ${CYAN}Install in Termux:${NC}"
        echo "  pkg install nodejs"
    else
        echo "  Please install Node.js 18+ from https://nodejs.org"
        echo ""
        echo -e "  ${CYAN}Quick install via nvm:${NC}"
        echo "  curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash"
        echo "  source ~/.bashrc && nvm install 20"
    fi
    exit 1
fi
NODE_VERSION=$(node -v | sed 's/v//' | cut -d. -f1)
if [ "$NODE_VERSION" -lt 18 ]; then
    echo -e "${RED}✗ Node.js 18+ required (found $(node -v)).${NC}"
    if [ "$IS_TERMUX" = true ]; then
        echo -e "  ${CYAN}Update in Termux:${NC}"
        echo "  pkg upgrade nodejs"
    fi
    exit 1
fi
echo -e "${GREEN}✓${NC} Node.js $(node -v) detected"

# Step 2: Check/install Ollama (optional, only for local provider)
echo ""
echo -e "${CYAN}[2/5]${NC} Checking Ollama (optional, for local provider)..."
if ! command -v ollama &> /dev/null; then
    echo -e "${YELLOW}⚠ Ollama is not installed (optional — needed only for the 'ollama' provider).${NC}"
    if [ "$PROVIDER" = "ollama" ]; then
        echo -e "${CYAN}  Installing Ollama...${NC}"
        curl -fsSL https://ollama.com/install.sh | sh || true
        echo -e "${GREEN}✓${NC} Ollama installed"
    else
        echo -e "${YELLOW}  Skipped. You can use cloud providers (Groq/OpenRouter/Google) instead.${NC}"
        echo -e "${YELLOW}  Install Ollama later: curl -fsSL https://ollama.com/install.sh | sh${NC}"
    fi
else
    echo -e "${GREEN}✓${NC} Ollama detected"
fi

# Step 3: Clone or download the project
echo ""
echo -e "${CYAN}[3/5]${NC} Downloading Free CLI..."
mkdir -p "$(dirname "$INSTALL_DIR")"
if [ -d "$INSTALL_DIR" ]; then
    echo -e "${YELLOW}  Existing install found at $INSTALL_DIR, updating...${NC}"
    cd "$INSTALL_DIR"
    git pull --rebase 2>/dev/null || true
else
    git clone https://github.com/YOUSSEFJEDIDI89/Free-cli-v0.1.git "$INSTALL_DIR" 2>/dev/null || {
        echo -e "${YELLOW}  Git clone failed, downloading tarball...${NC}"
        mkdir -p "$INSTALL_DIR"
        curl -fsSL https://github.com/YOUSSEFJEDIDI89/Free-cli-v0.1/archive/refs/heads/main.tar.gz \
            | tar xz -C "$INSTALL_DIR" --strip-components=1
    }
fi
cd "$INSTALL_DIR"
echo -e "${GREEN}✓${NC} Downloaded to $INSTALL_DIR"

# Step 4: Install dependencies
echo ""
echo -e "${CYAN}[4/5]${NC} Installing dependencies (this includes Z.ai SDK)..."
npm install --silent 2>&1 | tail -3
echo -e "${GREEN}✓${NC} Dependencies installed"

# Step 5: Build
echo ""
echo -e "${CYAN}[5/5]${NC} Building project..."
npm run build --silent 2>&1 | tail -3
echo -e "${GREEN}✓${NC} Build complete"

# Link globally if requested
if [ "$GLOBAL" = true ]; then
    echo ""
    echo -e "${CYAN}Linking globally...${NC}"
    npm link --silent 2>/dev/null || true
    echo -e "${GREEN}✓${NC} 'free-cli' available globally"
    BINARY="free-cli"
else
    BINARY="node $INSTALL_DIR/dist/index.js"
    echo ""
    echo -e "${YELLOW}Tip: For global access, re-run with --global or add to PATH:${NC}"
    echo -e "  ${CYAN}export PATH=\$PATH:$INSTALL_DIR${NC}"
fi

# Configure provider if specified
if [ -n "$PROVIDER" ]; then
    echo ""
    echo -e "${CYAN}Setting default provider: $PROVIDER${NC}"
    echo "export FREE_CLI_PROVIDER=$PROVIDER" >> ~/.bashrc
    echo "export FREE_CLI_PROVIDER=$PROVIDER" >> ~/.zshrc 2>/dev/null || true
    export FREE_CLI_PROVIDER=$PROVIDER
fi

# Done
echo ""
echo "  ╔══════════════════════════════════════════╗"
echo "  ║            Installation Done!             ║"
echo "  ╚══════════════════════════════════════════╝"
echo ""
echo -e "  ${CYAN}Run Free CLI:${NC}"
echo -e "     ${GREEN}$BINARY${NC}"
echo ""
echo -e "  ${GREEN}✨ IT JUST WORKS! No setup needed.${NC}"
echo -e "     The CLI auto-uses Pollinations.ai (free cloud, no API key)."
echo -e "     Start typing immediately."
echo ""
echo -e "  ${CYAN}Want more power? Optional setup:${NC}"
echo ""
echo -e "  ${YELLOW}A. Use a local model file (.gguf, .safetensors, .onnx):${NC}"
echo -e "     Just put the file in this folder, then:"
echo -e "     ${CYAN}/provider local-models${NC}"
echo -e "     The CLI auto-detects it!"
echo ""
echo -e "  ${YELLOW}B. Ollama (more local models, 100% offline):${NC}"
if [ "$IS_TERMUX" = true ]; then
    echo -e "     ${YELLOW}⚠ Ollama doesn't run natively on Termux.${NC}"
    echo -e "     Use proot-distro: ${CYAN}pkg install proot-distro${NC}"
    echo -e "     Then: ${CYAN}proot-distro install debian${NC} and install Ollama inside."
else
    echo -e "     ${CYAN}ollama serve${NC}  (start daemon)"
    echo -e "     ${CYAN}ollama pull glm4:9b${NC}  (download model)"
    echo -e "     Then in CLI: ${CYAN}/provider ollama${NC}"
fi
echo ""
echo -e "  ${YELLOW}C. Free cloud API keys (faster, more models):${NC}"
echo -e "     Groq (500+ tok/s): ${CYAN}https://console.groq.com/keys${NC}"
echo -e "     OpenRouter:        ${CYAN}https://openrouter.ai/keys${NC}"
echo -e "     Google Gemini:     ${CYAN}https://aistudio.google.com/app/apikey${NC}"
echo -e "     Then in CLI: ${CYAN}/apikey groq gsk_yourkey${NC}"
echo -e "     (or just paste the key — auto-detected!)"
echo ""
echo -e "  ${CYAN}Inside the CLI:${NC}"
echo -e "    /help         Show all commands"
echo -e "    /provider     List/switch providers"
echo -e "    /model        List/switch models"
echo -e "    Just type     Chat with AI (no command needed)"
echo ""
