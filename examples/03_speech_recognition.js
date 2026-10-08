import { BanglaAI } from "../src/index.js";

const client = new BanglaAI();

async function run() {
  console.log("=== 1. Offline Audio File Transcription (with Diarization) ===");
  try {
    const res = await client.asr.transcribe("./meeting.wav", { diarize: true });
    console.log(`Transcript: ${res.text}`);
    console.log(`Duration: ${res.duration_seconds}s | Processed in: ${res.processing_time_ms}ms`);
  } catch (err) {
    console.log(`ASR notice: ${err.message}`);
  }

  console.log("\n=== 2. YouTube Audio Transcription ===");
  try {
    const ytRes = await client.asr.transcribeYoutube({
      url: "https://www.youtube.com/watch?v=example",
      diarize: true,
    });
    console.log(`Title: ${ytRes.title}`);
    console.log(`Transcript: ${ytRes.text}`);
  } catch (err) {
    console.log(`YouTube ASR notice: ${err.message}`);
  }
}

run().catch(console.error);
