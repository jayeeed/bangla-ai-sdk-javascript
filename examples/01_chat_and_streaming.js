import { BanglaAI } from "../src/index.js";

const client = new BanglaAI();

async function run() {
  console.log("=== 1. Create a Chat Conversation ===");
  const chat = await client.chats.create({
    title: "Bengali Literature Discussion",
    instructions: "আপনি একজন দক্ষ বাংলা শিক্ষক। প্রাতিষ্ঠানিক ও শুদ্ধ বাংলায় উত্তর দিন।",
  });
  console.log(`Created chat thread: ${chat.id}`);

  console.log("\n=== 2. Real-Time Token Streaming ===");
  process.stdout.write("AI: ");
  for await (const chunk of client.chats.turns.stream(chat.id, {
    content: "গীতাঞ্জলি কাব্যগ্রন্থের গুরুত্ব সংক্ষেপে বলুন।",
  })) {
    if (chunk.text) {
      process.stdout.write(chunk.text);
    }
  }
  console.log("\n");

  console.log("=== 3. Non-Streaming Turn ===");
  const reply = await client.chats.turns.create(chat.id, {
    content: "ধন্যবাদ! রবীন্দ্রনাথ ঠাকুর কোন সালে নোবেল পুরস্কার পেয়েছিলেন?",
  });
  console.log(`AI: ${reply}`);
}

run().catch(console.error);
