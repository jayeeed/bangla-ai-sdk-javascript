import { BanglaAI } from "../src/index.js";

const client = new BanglaAI();

async function run() {
  console.log("=== 1. Discover Available Voices ===");
  try {
    const discovery = await client.tts.listVoices();
    console.log("Discovered voices:", discovery);
  } catch (err) {
    console.log(`TTS discovery notice: ${err.message}`);
  }

  console.log("\n=== 2. Synthesize Speech to Audio File ===");
  try {
    await client.tts.synthesizeToFile(
      "স্বাগতম! বাংলা এআই প্ল্যাটফর্মে আপনাকে স্বাগতম।",
      "./output_welcome.wav",
      { voice: "female", emotion: "happy", speed: 1.0 }
    );
    console.log("Saved audio to ./output_welcome.wav");
  } catch (err) {
    console.log(`TTS synthesis notice: ${err.message}`);
  }

  console.log("\n=== 3. Real-Time 24 kHz PCM Audio Streaming ===");
  try {
    let totalBytes = 0;
    for await (const pcmChunk of client.tts.streamPcm("বাংলা ভাষার জন্য উচ্চগতির কণ্ঠ রূপান্তর প্রযুক্তি।")) {
      totalBytes += pcmChunk.length;
      // In a real application, pipe chunk to web audio API or audio hardware
    }
    console.log(`Streamed ${totalBytes} bytes of 24 kHz 16-bit mono PCM audio.`);
  } catch (err) {
    console.log(`TTS stream notice: ${err.message}`);
  }
}

run().catch(console.error);
