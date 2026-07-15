#!/bin/bash
# Publish Free CLI to GitHub - 3 methods
# Run this on your local machine after downloading the project.
#
# Prerequisites:
#   - A GitHub account
#   - Git installed (https://git-scm.com)
#   - Either gh CLI (recommended) OR a GitHub Personal Access Token
#
# Usage:
#   bash publish-github.sh

set -e

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
RED='\033[0;31m'
NC='\033[0m'

echo ""
echo "  ╔══════════════════════════════════════════╗"
echo "  ║      Free CLI - GitHub Publisher          ║"
echo "  ╚══════════════════════════════════════════╝"
echo ""

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# Ask for repo name
read -p "  Repository name [free-cli]: " REPO_NAME
REPO_NAME=${REPO_NAME:-free-cli}

read -p "  Repository description [100% local AI CLI assistant]: " REPO_DESC
REPO_DESC=${REPO_DESC:-"100% local AI CLI assistant powered by Ollama + GLM-4-9B"}

read -p "  Make it public? [Y/n]: " -n 1 -r
echo ""
if [[ $REPLY =~ ^[Nn]$ ]]; then
    VISIBILITY="--private"
    VIS_TEXT="private"
else
    VISIBILITY="--public"
    VIS_TEXT="public"
fi

echo ""
echo -e "  ${CYAN}Repository:${NC} $REPO_NAME"
echo -e "  ${CYAN}Description:${NC} $REPO_DESC"
echo -e "  ${CYAN}Visibility:${NC} $VIS_TEXT"
echo ""

# Method 1: GitHub CLI (recommended)
if command -v gh &> /dev/null; then
    echo -e "${GREEN}✓${NC} GitHub CLI detected"
    echo -e "${CYAN}[Method 1]${NC} Publishing with gh CLI..."

    # Ensure authenticated
    if ! gh auth status &> /dev/null; then
        echo -e "${YELLOW}  Not authenticated. Starting login...${NC}"
        gh auth login --web
    fi

    # Create the repo
    gh repo create "$REPO_NAME" $VISIBILITY \
        --description "$REPO_DESC" \
        --source=. \
        --remote=origin \
        --push

    echo ""
    echo -e "${GREEN}✓ Published successfully!${NC}"
    echo -e "  ${CYAN}URL:${NC} https://github.com/$(gh api user --jq .login)/$REPO_NAME"
    echo ""
    exit 0
fi

# Method 2: Manual with HTTPS + token
echo -e "${YELLOW}⚠ gh CLI not found.${NC}"
echo ""
echo -e "${CYAN}[Method 2]${NC} Manual HTTPS push with Personal Access Token"
echo ""
echo "  Steps:"
echo "  1. Create a new repo on GitHub:"
echo -e "     ${GREEN}https://github.com/new${NC}"
echo -printf "     - Name: %s\n" "$REPO_NAME"
printf "     - Description: %s\n" "$REPO_DESC"
printf "     - Visibility: %s\n" "$VIS_TEXT"
echo "     - DO NOT initialize with README/license/gitignore"
echo ""
echo "  2. Create a Personal Access Token:"
echo -e "     ${GREEN}https://github.com/settings/tokens/new?scopes=repo${NC}"
echo "     - Save the token (you'll only see it once)"
echo ""
echo "  3. Add the remote (replace USERNAME and TOKEN):"
echo -e "     ${GREEN}git remote add origin https://USERNAME:TOKEN@github.com/USERNAME/$REPO_NAME.git${NC}"
echo ""
echo "  4. Push:"
echo -e "     ${GREEN}git branch -M main${NC}"
echo -e "     ${GREEN}git push -u origin main${NC}"
echo ""
echo -e "  ${CYAN}Or run this one-liner (after creating the repo + token):${NC}"
echo ""
read -p "  Enter your GitHub username: " GH_USER
read -sp "  Enter your Personal Access Token: " GH_TOKEN
echo ""
read -p "  Confirm push to $GH_USER/$REPO_NAME? [y/N]: " -n 1 -r
echo ""
if [[ $REPLY =~ ^[Yy]$ ]]; then
    git remote remove origin 2>/dev/null || true
    git remote add origin "https://${GH_USER}:${GH_TOKEN}@github.com/${GH_USER}/${REPO_NAME}.git"
    git branch -M main
    git push -u origin main
    # Remove token from remote URL for safety
    git remote set-url origin "https://github.com/${GH_USER}/${REPO_NAME}.git"
    echo ""
    echo -e "${GREEN}✓ Published successfully!${NC}"
    echo -e "  ${CYAN}URL:${NC} https://github.com/${GH_USER}/${REPO_NAME}"
fi
echo ""

# Method 3: SSH
echo -e "${CYAN}[Method 3]${NC} Alternative: SSH"
echo "  If you have SSH keys set up with GitHub:"
echo -e "  ${GREEN}git remote add origin git@github.com:USERNAME/$REPO_NAME.git${NC}"
echo -e "  ${GREEN}git branch -M main${NC}"
echo -e "  ${GREEN}git push -u origin main${NC}"
echo ""
