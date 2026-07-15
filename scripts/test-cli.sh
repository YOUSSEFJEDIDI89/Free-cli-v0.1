#!/bin/bash
# Comprehensive test script for Free CLI
# Starts the mock Ollama server, runs all tests, then cleans up.

set -e

CLI_DIR="/home/z/my-project/cli-tool"
MOCK_PID=""

cleanup() {
  if [ -n "$MOCK_PID" ] && kill -0 "$MOCK_PID" 2>/dev/null; then
    kill "$MOCK_PID" 2>/dev/null || true
  fi
}
trap cleanup EXIT

# Kill any existing mock server
pkill -f mock-ollama 2>/dev/null || true
sleep 1

# Start mock server
python3 "$CLI_DIR/scripts/mock-ollama.py" > /tmp/mock.log 2>&1 &
MOCK_PID=$!
sleep 2

# Verify server is running
if ! curl -s http://localhost:11434/api/tags > /dev/null 2>&1; then
  echo "FAILED: Mock server not running"
  exit 1
fi

echo "============================================"
echo "  Free CLI - Comprehensive Test Suite"
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
  output=$(printf "$input" | node "$CLI_DIR/dist/index.js" 2>&1 || true)
  
  if echo "$output" | grep -q "$expected"; then
    echo "PASS"
    PASS=$((PASS + 1))
  else
    echo "FAIL (expected: $expected)"
    echo "  Output was:"
    echo "$output" | tail -10 | sed 's/^/    /'
    FAIL=$((FAIL + 1))
  fi
  echo ""
}

# Test 1: Help command
run_test "/help shows commands" "/help\n/exit\n" "Available Commands"

# Test 2: Models listing
run_test "/models lists installed" "/models\n/exit\n" "Installed Models"

# Test 3: Config
run_test "/config shows settings" "/config\n/exit\n" "Configuration"

# Test 4: Model switch
run_test "/model shows catalogue" "/model\n/exit\n" "Available Models"

# Test 5: List files
run_test "/ls lists files" "/ls src\n/exit\n" "commands"

# Test 6: Chat (streaming)
run_test "Chat returns response" "Hello, what can you do?\n/exit\n" "running locally"

# Test 7: Shell execution
run_test "/run executes shell" "/run echo test123\n/exit\n" "test123"

# Test 8: Read file
run_test "/read reads a file" "/read src/config.ts\n/exit\n" "ModelConfig"

# Test 9: Write file
run_test "/write creates a file" "/write /tmp/test-cli.txt ;; Hello World\n/exit\n" "Wrote"

# Test 10: Git status
run_test "/git status works" "/git status\n/exit\n" "Branch"

echo "============================================"
echo "  Results: $PASS passed, $FAIL failed"
echo "============================================"
