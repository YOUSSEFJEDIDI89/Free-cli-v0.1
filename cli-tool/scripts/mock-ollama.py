#!/usr/bin/env python3
"""
Mock Ollama server for testing Free CLI without installing Ollama.

Implements the minimum API surface used by the `ollama` JS client:
  - GET  /api/tags         -> list models
  - POST /api/chat         -> chat (streaming)
  - POST /api/pull         -> pull model (fake progress)
"""

import json
import time
from http.server import BaseHTTPRequestHandler, HTTPServer

MOCK_MODELS = [
    {"name": "glm4:9b", "size": 5500000000, "modified_at": "2025-01-01T00:00:00Z"},
    {"name": "llama3.1:8b", "size": 4700000000, "modified_at": "2025-01-01T00:00:00Z"},
    {"name": "phi3:mini", "size": 2300000000, "modified_at": "2025-01-01T00:00:00Z"},
]


class MockHandler(BaseHTTPRequestHandler):
    def log_message(self, *args):
        pass  # silence

    def _send_json(self, data, status=200):
        body = json.dumps(data).encode()
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self):
        if self.path == "/api/tags":
            self._send_json({"models": MOCK_MODELS})
        else:
            self._send_json({"error": "not found"}, 404)

    def do_POST(self):
        length = int(self.headers.get("Content-Length", 0))
        body = self.rfile.read(length).decode() if length else "{}"
        try:
            payload = json.loads(body)
        except Exception:
            payload = {}

        if self.path == "/api/chat":
            self._handle_chat(payload)
        elif self.path == "/api/pull":
            self._handle_pull(payload)
        else:
            self._send_json({"error": "not found"}, 404)

    def _handle_chat(self, payload):
        model = payload.get("model", "glm4:9b")
        messages = payload.get("messages", [])
        last_user = next((m["content"] for m in reversed(messages) if m["role"] == "user"), "")
        stream = payload.get("stream", True)

        response = self._build_response(last_user, model)

        if not stream:
            self._send_json({
                "model": model,
                "message": {"role": "assistant", "content": response},
                "done": True,
            })
            return

        self.send_response(200)
        self.send_header("Content-Type", "application/x-ndjson")
        self.end_headers()

        words = response.split(" ")
        for i, word in enumerate(words):
            chunk = {
                "model": model,
                "message": {"role": "assistant", "content": word + (" " if i < len(words) - 1 else "")},
                "done": False,
            }
            self.wfile.write((json.dumps(chunk) + "\n").encode())
            self.wfile.flush()
            time.sleep(0.02)

        final = {
            "model": model,
            "message": {"role": "assistant", "content": ""},
            "done": True,
            "total_duration": 1000000000,
        }
        self.wfile.write((json.dumps(final) + "\n").encode())
        self.wfile.flush()

    def _build_response(self, user_input, model):
        user_lower = user_input.lower()
        if "hello" in user_lower or "hi" in user_lower:
            return f"Hello! I'm **{model}** running locally. How can I help you today?\n\n- I can read files\n- I can run code\n- I can search the web"
        if "code" in user_lower:
            return "Here's an example:\n\n```python\ndef greet(name):\n    return f'Hello, {name}!'\n\nprint(greet('World'))\n```\n\nThis defines a simple function and calls it."
        if "file" in user_lower:
            return "I can help with files! Use `/ls` to list files, `/read <path>` to read a file, or `/write <path> ;; <content>` to write one."
        return f"You said: **{user_input}**\n\nI'm a mock response from {model}. In production, this would be a real GLM-4-9B response streamed from Ollama."

    def _handle_pull(self, payload):
        model = payload.get("model", "glm4:9b")
        self.send_response(200)
        self.send_header("Content-Type", "application/x-ndjson")
        self.end_headers()

        steps = [
            ("pulling manifest", 0, 0),
            ("pulling 1234567890ab", 1000000, 5500000000),
            ("pulling 1234567890ab", 1000000000, 5500000000),
            ("pulling 1234567890ab", 3000000000, 5500000000),
            ("pulling 1234567890ab", 5500000000, 5500000000),
            ("verifying sha256 digest", 5500000000, 5500000000),
            ("writing manifest", 5500000000, 5500000000),
            ("success", 5500000000, 5500000000),
        ]
        for status, completed, total in steps:
            chunk = {"status": status, "completed": completed, "total": total}
            self.wfile.write((json.dumps(chunk) + "\n").encode())
            self.wfile.flush()
            time.sleep(0.3)


def main():
    server = HTTPServer(("localhost", 11434), MockHandler)
    print("Mock Ollama server running on http://localhost:11434")
    print("Available models: glm4:9b, llama3.1:8b, phi3:mini")
    print("Press Ctrl+C to stop")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nShutting down...")
        server.shutdown()


if __name__ == "__main__":
    main()
