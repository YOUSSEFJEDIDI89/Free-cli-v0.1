#!/usr/bin/env node
/**
 * Quick test of the Z.ai provider (real, no mock).
 */
import { ZaiProvider } from "../src/providers/zai.js";

async function main() {
  console.log("Testing Z.ai provider...\n");
  const zai = new ZaiProvider();

  console.log("1. Pinging Z.ai...");
  const ok = await zai.ping();
  console.log(`   Available: ${ok}`);
  if (!ok) {
    console.log(`   Reason: ${zai.unavailableReason}`);
    process.exit(1);
  }

  console.log("\n2. Sending a test message (non-streaming)...");
  const response = await zai.chat(
    [
      { role: "system", content: "You are a helpful assistant. Be very brief." },
      { role: "user", content: "Say 'hello' in Arabic, French, and Japanese. One word each." },
    ],
    { maxTokens: 100 },
  );
  console.log("   Response:");
  console.log("   " + response.split("\n").join("\n   "));

  console.log("\n3. Streaming test...");
  process.stdout.write("   ");
  for await (const chunk of zai.stream(
    [{ role: "user", content: "Count from 1 to 5." }],
    { maxTokens: 50 },
  )) {
    process.stdout.write(chunk);
  }
  console.log("\n");

  console.log("✓ All Z.ai tests passed!");
}

main().catch((err) => {
  console.error("Failed:", err.message);
  process.exit(1);
});
