#!/bin/bash
# Comprehensive test for Free CLI v2 with multi-provider support
set -e

CLI_DIR="/home/z/my-project/cli-tool"
MOCK_PID=""

cleanup() {
  if [ -n "$MOCK_PID" ] && kill -0 "$MOCK_PID" 2>/dev/null; then
    kill "$MOCK_PID" 2>/dev/null || true
  fi
}
trap cleanup EXIT

pkill -f mock-ollama 2>/dev/null || true
sleep 1

python3 "$CLI_DIR/scripts/mock-ollama.py" > /tmp/mock.log 2>&1 &
MOCK_PID=$!
sleep 2

if ! curl -s http://localhost:11434/api/tags > /dev/null 2>&1; then
  echo "FAILED: Mock server not running"
  exit 1
fi

echo "============================================"
echo "  Free CLI v2 - Multi-Provider Test Suite"
echo "============================================"
echo ""

PASS=0
FAIL=0

run_test() {
  local name="$1"
  local input="$2"
  local expected="$3"

  echo "--- Test: $name ---"
  local output
  output=$(printf "$input" | timeout 30 node "$CLI_DIR/dist/index.js" 2>&1 || true)

  if echo "$output" | grep -q "$expected"; then
    echo "PASS"
    PASS=$((PASS + 1))
  else
    echo "FAIL (expected: $expected)"
    echo "  Output was:"
    echo "$output" | tail -15 | sed 's/^/    /'
    FAIL=$((FAIL + 1))
  fi
  echo ""
}

# Test 1: Help
run_test "/help shows new commands" "/help\n/exit\n" "Available Commands"

# Test 2: Provider listing
run_test "/provider lists all providers" "/provider\n/exit\n" "AI Providers"

# Test 3: Z.ai shows in provider list
run_test "/provider shows Z.ai" "/provider\n/exit\n" "Z.ai"

# Test 4: OpenRouter shows in provider list
run_test "/provider shows OpenRouter" "/provider\n/exit\n" "OpenRouter"

# Test 5: Google Gemini shows in provider list
run_test "/provider shows Google" "/provider\n/exit\n" "Gemini"

# Test 6: Groq shows in provider list
run_test "/provider shows Groq" "/provider\n/exit\n" "Groq"

# Test 7: HuggingFace shows in provider list
run_test "/provider shows HuggingFace" "/provider\n/exit\n" "HuggingFace"

# Test 8: API key command
run_test "/apikey shows help" "/apikey\n/exit\n" "Get keys at"

# Test 9: Model command works
run_test "/model shows models" "/model\n/exit\n" "Models"

# Test 10: Config command
run_test "/config shows settings" "/config\n/exit\n" "Configuration"

# Test 11: Switch to Ollama provider
run_test "/provider ollama switch" "/provider ollama\n/exit\n" "Switched"

# Test 12: Ollama chat still works
run_test "Ollama chat returns response" "/provider ollama\nHello, what can you do?\n/exit\n" "running locally"

# Test 13: Git status
run_test "/git status works" "/git status\n/exit\n" "Branch"

echo "============================================"
echo "  Results: $PASS passed, $FAIL failed"
echo "============================================"
