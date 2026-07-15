#!/bin/bash
# Quick install script for Free CLI
# Usage: bash install.sh

set -e

echo ""
echo "  ╔══════════════════════════════════════════╗"
echo "  ║          Free CLI - Installer             ║"
echo "  ║  100% local • no API • no credit card     ║"
echo "  ╚══════════════════════════════════════════╝"
echo ""

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
CYAN='\033[0;36m'
NC='\033[0m'

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Step 1: Check Node.js
echo -e "${CYAN}[1/5]${NC} Checking Node.js..."
if ! command -v node &> /dev/null; then
    echo -e "${RED}✗ Node.js is not installed.${NC}"
    echo "  Please install Node.js 18+ from https://nodejs.org"
    exit 1
fi
NODE_VERSION=$(node -v | sed 's/v//' | cut -d. -f1)
if [ "$NODE_VERSION" -lt 18 ]; then
    echo -e "${RED}✗ Node.js 18+ required (found $(node -v)).${NC}"
    exit 1
fi
echo -e "${GREEN}✓${NC} Node.js $(node -v) detected"

# Step 2: Check/install Ollama
echo ""
echo -e "${CYAN}[2/5]${NC} Checking Ollama..."
if ! command -v ollama &> /dev/null; then
    echo -e "${YELLOW}⚠ Ollama is not installed.${NC}"
    echo ""
    read -p "  Install Ollama now? [Y/n] " -n 1 -r
    echo ""
    if [[ $REPLY =~ ^[Yy]$ ]] || [[ -z $REPLY ]]; then
        echo "  Installing Ollama..."
        curl -fsSL https://ollama.com/install.sh | sh
        echo -e "${GREEN}✓${NC} Ollama installed"
    else
        echo -e "${YELLOW}  Skipped. Install manually: curl -fsSL https://ollama.com/install.sh | sh${NC}"
    fi
else
    echo -e "${GREEN}✓${NC} Ollama detected"
fi

# Step 3: Install npm dependencies
echo ""
echo -e "${CYAN}[3/5]${NC} Installing npm dependencies..."
cd "$SCRIPT_DIR"
npm install --silent
echo -e "${GREEN}✓${NC} Dependencies installed"

# Step 4: Build TypeScript
echo ""
echo -e "${CYAN}[4/5]${NC} Building project..."
npm run build --silent
echo -e "${GREEN}✓${NC} Build complete"

# Step 5: Link globally
echo ""
echo -e "${CYAN}[5/5]${NC} Linking global command..."
npm link --silent 2>/dev/null || true
echo -e "${GREEN}✓${NC} 'free-cli' command available globally"

echo ""
echo "  ╔══════════════════════════════════════════╗"
echo "  ║            Installation Done!            ║"
echo "  ╚══════════════════════════════════════════╝"
echo ""
echo -e "  ${CYAN}Next steps:${NC}"
echo ""
echo "  1. Start Ollama daemon (if not running):"
echo -e "     ${GREEN}ollama serve${NC}"
echo ""
echo "  2. Pull the default model (GLM-4-9B, ~5.5 GB):"
echo -e "     ${GREEN}ollama pull glm4:9b${NC}"
echo ""
echo "     Or a smaller model for low-RAM machines:"
echo -e "     ${GREEN}ollama pull phi3:mini${NC}   (~2.3 GB)"
echo ""
echo "  3. Run Free CLI:"
echo -e "     ${GREEN}free-cli${NC}"
echo ""
echo -e "  ${CYAN}Tips:${NC}"
echo "  • Type /help inside the CLI for all commands"
echo "  • Use /model to switch between installed models"
echo "  • Use /pull <tag> to download more models"
echo ""
