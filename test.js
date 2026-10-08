// Optional dotenv loading
try {
  const dotenv = await import("dotenv");
  dotenv.config();
} catch {
  // Dotenv not available, rely on process.env
}

import { BanglaAI } from "./src/index.js";
import { APIConnectionError, AuthenticationError } from "./src/exceptions.js";

function maskKey(key) {
  if (!key) return "<not set>";
  if (key.length <= 8) return "***";
  return `${key.slice(0, 6)}...${key.slice(-4)}`;
}

async function main() {
  const apiKey = (process.env.BANGLA_AI_API_KEY || "").trim();
  const baseUrl = (process.env.BANGLA_AI_BASE_URL || "https://banglai.acimisai.com").trim();

  console.log("╔════════════════════════════════════════════════════════════╗");
  console.log("║     Bangla AI JavaScript SDK (Node.js) - Verification      ║");
  console.log("╚════════════════════════════════════════════════════════════╝");
  console.log(`Target Gateway URL: ${baseUrl}`);
  console.log(`Configured API Key: ${maskKey(apiKey)}\n`);

  const client = new BanglaAI({ apiKey: apiKey || undefined, baseUrl });

  // 1. Gateway Health & Readiness
  console.log("--- 1. Checking Gateway Health (/healthz & /readyz) ---");
  try {
    const health = await client.health();
    console.log(`✅ Health status:`, health);

    const ready = await client.ready();
    console.log(`✅ Ready status: `, ready);
  } catch (err) {
    if (err instanceof APIConnectionError) {
      console.log(`❌ Connection failed: Gateway at ${baseUrl} is unreachable (${err.message}).`);
      return;
    }
    console.log(`⚠️ Health check notice: ${err.name}: ${err.message}`);
  }

  if (!apiKey) {
    console.log("\n⚠️ Skipping authenticated endpoints (BANGLA_AI_API_KEY is not set).");
    console.log("💡 Tip: Copy .env.example to .env and configure BANGLA_AI_API_KEY to test all features.");
    console.log("\n============================================================");
    console.log("🎉 Verification run complete!");
    console.log("============================================================");
    return;
  }

  // 2. User Profile (Identity)
  console.log("\n--- 2. Fetching User Identity (client.me.get) ---");
  try {
    const me = await client.me.get();
    console.log(`✅ Authenticated as: ${me.display_name} (${me.email}) | Plan: ${me.plan}`);
  } catch (err) {
    if (err instanceof AuthenticationError) {
      console.log(`⚠️ Authentication notice: ${err.message}`);
      console.log("💡 Configure a valid BANGLA_AI_API_KEY in .env to test authenticated routes.");
      return;
    }
    console.log(`⚠️ Me check notice: ${err.name}: ${err.message}`);
    return;
  }

  // 3. LLM Chat & Turn
  console.log("\n--- 3. LLM Chat Conversation (Create & Turn) ---");
  let chatId;
  try {
    const chat = await client.chats.create({
      title: "JS SDK Smoke Test",
      instructions: "বাংলা ব্যাকরণ ও সাধারণ জ্ঞানের উত্তর দিন।",
    });
    chatId = chat.id;
    console.log(`✅ Chat session created: id=${chat.id}`);

    const reply = await client.chats.turns.create(chat.id, {
      content: "বাংলাদেশের জাতীয় কবি কে?",
    });
    console.log(`✅ Response received: ${reply}`);
  } catch (err) {
    console.log(`⚠️ Chat turn notice: ${err.name}: ${err.message}`);
  }

  // 4. LLM Streaming Turn (SSE)
  if (chatId) {
    console.log("\n--- 4. LLM Real-Time Streaming Turn (SSE) ---");
    try {
      process.stdout.write("Stream output: ");
      let chunksCount = 0;
      for await (const chunk of client.chats.turns.stream(chatId, {
        content: "এক বাক্যে কৃত্রিম বুদ্ধিমত্তা কী ব্যাখ্যা করুন।",
      })) {
        if (chunk.text) {
          process.stdout.write(chunk.text);
          chunksCount++;
        }
      }
      console.log(`\n✅ Streaming finished successfully (${chunksCount} chunks received).`);
    } catch (err) {
      console.log(`\n⚠️ Chat stream notice: ${err.name}: ${err.message}`);
    }
  }

  // 5. Speech-to-Speech (STS Token)
  console.log("\n--- 5. Speech-to-Speech (STS LiveKit Token) ---");
  try {
    const token = await client.sts.createToken({
      roomName: "smoke-test-room",
      participantName: "js-tester",
    });
    console.log(`✅ LiveKit Token generated: room=${token.roomName}, url=${token.livekitUrl}`);
  } catch (err) {
    console.log(`⚠️ STS token notice: ${err.name}: ${err.message}`);
  }

  // 6. Speech Synthesis (TTS Discovery)
  console.log("\n--- 6. TTS Voice Discovery ---");
  try {
    const voices = await client.tts.listVoices();
    const speakers = voices.speakers || voices.voices || [];
    console.log(`✅ TTS Voices available: ${speakers.length} voices found.`);
  } catch (err) {
    console.log(`⚠️ TTS discovery notice: ${err.name}: ${err.message}`);
  }

  console.log("\n============================================================");
  console.log("🎉 Verification run complete!");
  console.log("============================================================");
}

main().catch((err) => {
  console.error("Fatal test error:", err);
  process.exit(1);
});
