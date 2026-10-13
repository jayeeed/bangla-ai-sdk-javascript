# Bangla AI JavaScript / TypeScript SDK (`bangla-ai`)

![Async](https://img.shields.io/badge/async-supported-blue)
![Node.js](https://img.shields.io/badge/node-18+-green)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![npm version](https://img.shields.io/badge/npm-0.1.0-orange.svg)](https://www.npmjs.com/package/bangla-ai)

The official Node.js, Browser, and TypeScript SDK for the **Bangla AI Gateway**. Easily connect your applications to state-of-the-art Bengali language AI microservices:
- 💬 **Large Language Model (LLM)**: Multi-branch conversation trees, message turn history, automatic idempotency keys, and token-by-token SSE streaming.
- 📄 **Document OCR**: High-accuracy Bengali document parsing with layout detection, bounding boxes, synchronous processing, and asynchronous batch jobs.
- 🎙️ **Speech-to-Text (ASR)**: Nemotron Bengali ASR for offline audio files, asynchronous batch jobs, YouTube transcription, and live 16 kHz PCM16 streaming.
- 🔊 **Speech Synthesis (TTS)**: Higgs TTS 3 (4B) neural voice synthesis returning 24 kHz WAV/PCM audio, asynchronous jobs, zero-shot voice cloning, and stateful incremental text sessions.
- 🗣️ **Speech-to-Speech (STS)**: LiveKit SFU WebRTC room token minting and zero-shot custom voice conditioning.
- 🔐 **Auth & API Keys**: User profiles, Google/Firebase authentication synchronization, API keys CRUD, and single-use WebSocket tickets.

---

## 🚀 Features

- **✅ Native Fetch (Zero Runtime Dependencies)**: Built on standard modern Fetch API (`fetch`, `FormData`, `ReadableStream`) supported out-of-the-box in Node 18+, Bun, Deno, and modern browsers.
- **⚡ Real-Time Streaming**: First-class Server-Sent Events (SSE) streaming for LLM tokens and 24 kHz raw PCM audio chunks for TTS using standard `for await (const chunk of stream)`.
- **🔄 Long-Running Async Jobs**: High-level `waitForJob()` helpers for ASR, OCR, and TTS async batch jobs with automatic polling and error resolution.
- **🎙️ Live ASR Streaming**: Stateful sessions supporting raw 16 kHz mono signed 16-bit PCM chunks with generation-based checkpointing.
- **🗣️ Reusable Voice Cloning**: Upload short reference audio samples once and reuse the generated `voice_id` across TTS and STS.
- **🛡️ Robust Error Handling**: Clean RFC 7807 typed exceptions (`RateLimitError`, `AuthenticationError`, `UpstreamServiceError`, etc.) with automatic exponential backoff retry.
- **🔐 Flexible Authentication**: Auto-discovers credentials from `BANGLA_AI_API_KEY` environment variables or `.env` file via `dotenv`.
- **📘 Full TypeScript Definitions**: First-class `.d.ts` declaration file included with autocompletion, type safety, and JSDoc documentation.

---

## 📦 Installation

```bash
npm install bangla-ai
```

Or using yarn / pnpm / bun:

```bash
pnpm add bangla-ai
# or
yarn add bangla-ai
# or
bun add bangla-ai
```

---

## ⚡ Quick Start

### 1. Configure Environment

Copy `.env.example` to `.env` and set your API key:

```bash
cp .env.example .env
```

```env
BANGLA_AI_API_KEY="sk_live_your_gateway_api_key_here"
BANGLA_AI_BASE_URL="https://banglai.acimisai.com"
```

### 2. Run Code

```javascript
import "dotenv/config";
import { BanglaAI } from "bangla-ai";

// Automatically reads BANGLA_AI_API_KEY from environment
const client = new BanglaAI();

// 1. Fetch user identity profile
const me = await client.me.get();
console.log(`Logged in as: ${me.display_name} (${me.email}) - Tier: ${me.plan}`);

// 2. Chat with the Bengali LLM
const chat = await client.chats.create({ title: "Introduction" });
const reply = await client.chats.turns.create(chat.id, {
  content: "বাংলা ব্যাকরণ অনুযায়ী সমাস কাকে বলে?",
});
console.log("AI:", reply.content);
```

---

## 📖 Complete Modality Guide

### 1. LLM & Conversational Chat

#### Token-by-Token Streaming (Server-Sent Events)
```javascript
const chat = await client.chats.create({
  title: "Programming Tutorial",
  instructions: "আপনি একজন অভিজ্ঞ পাইথন ও জাভাস্ক্রিপ্ট প্রোগ্রামার। প্রাতিষ্ঠানিক বাংলায় উত্তর দিন।",
});

// Stream tokens in real time (automatically includes RFC 4122 Idempotency-Key)
process.stdout.write("AI: ");
for await (const chunk of client.chats.turns.stream(chat.id, {
  content: "জাভাস্ক্রিপ্টে প্রমিজ (Promise) কী এবং এটি কীভাবে কাজ করে?",
})) {
  if (chunk.text) {
    process.stdout.write(chunk.text);
  }
}
console.log();
```

#### Uploading Chat Attachments & Message History
```javascript
// Upload document to MinIO
const att = await client.chats.attachments.upload(chat.id, "./invoice.pdf");
console.log(`Attached: ${att.filename} (${att.size_bytes} bytes)`);

// Submit prompt referencing the uploaded attachment
const reply = await client.chats.turns.create(chat.id, {
  content: "এই ইনভয়েসের মোট টাকার পরিমাণ কত?",
  attachmentIds: [att.id],
});
console.log("AI:", reply.content);

// Retrieve message turn history
const history = await client.chats.messages(chat.id);
for (const turn of history) {
  console.log(`[${turn.status}] User: ${turn.input_content} -> AI: ${turn.output_text}`);
}

// Fork conversation into a new branch
const branch = await client.chats.createBranch(chat.id, {
  sourceBranchId: chat.active_branch_id,
  targetTurnId: reply.turnId,
  action: "regenerate",
});
```

---

### 2. Document OCR

#### Synchronous Document OCR (Single-Page / Fast Scan)
```javascript
const result = await client.ocr.process("./nid_card.jpg");
console.log("Extracted Markdown:\n", result.markdown);

// Inspect layout regions and bounding boxes
for (const page of result.pages || []) {
  for (const region of page.regions || []) {
    console.log(`[${region.label}] (${region.box_2d}): ${region.text}`);
  }
}
```

#### Asynchronous Multi-Page Document OCR with Auto-Polling
```javascript
// Submits to Celery queue, polls until complete, and returns the result
const job = await client.ocr.waitForJob("./contract_30_pages.pdf", {
  pollInterval: 2000,
});
console.log("Finished OCR in:", job.result?.timing?.total_elapsed_ms, "ms");
console.log(job.result?.markdown);
```

---

### 3. Speech-to-Text (ASR)

#### Audio File Transcription (with Speaker Diarization)
```javascript
const result = await client.asr.transcribe("./meeting_recording.wav", { diarize: true });
console.log("Transcript:", result.text);
console.log(`Duration: ${result.duration_seconds}s | Processed in: ${result.processing_time_ms}ms`);
```

#### Asynchronous Long Audio Transcription
```javascript
// Submit job and poll until completion
const jobStatus = await client.asr.waitForJob("./long_lecture_2hours.mp3", { diarize: true });
console.log("Finished ASR:", jobStatus.result?.text);
```

#### YouTube Video Audio Transcription
```javascript
const ytResult = await client.asr.transcribeYoutube({
  url: "https://www.youtube.com/watch?v=example_video_id",
  diarize: true,
});
console.log("Video Title:", ytResult.title);
console.log("Diarization:", ytResult.diarization_text);
```

#### Live 16 kHz PCM16 Streaming
```javascript
// 1. Start streaming session
const session = await client.asr.createStream({ sampleRate: 16000 });

// 2. Feed 16-bit mono PCM chunks as they arrive from microphone
const chunk = await client.asr.streamChunkPcm(session.session_id, pcmBytes);
console.log("Partial:", chunk.partial_text);
if (chunk.final_text) {
  console.log("Final segment:", chunk.final_text);
}

// 3. Finalize stream
const res = await client.asr.finishStream(session.session_id);
```

---

### 4. Speech Synthesis (TTS)

#### Full WAV Audio Synthesis
```javascript
// Save speech directly to disk (Node.js)
await client.tts.synthesizeToFile(
  "স্বাগতম! বাংলা এআই প্ল্যাটফর্মে আপনাকে স্বাগতম।",
  "./welcome.wav",
  { voice: "female" }
);
```

#### Real-Time PCM Stream (24 kHz 16-bit Mono)
```javascript
// Stream PCM audio bytes directly for audio players or web audio
for await (const pcmChunk of client.tts.streamPcm("বাংলা ভাষার জন্য উচ্চগতির কণ্ঠ রূপান্তর প্রযুক্তি।")) {
  sendToAudioHardware(pcmChunk);
}
```

#### Reusable Voice Cloning & Upload
```javascript
// Upload reference audio to clone a reusable voice profile
const voiceInfo = await client.tts.createVoice("./my_voice.wav", { name: "My Voice" });
const voiceId = voiceInfo.voice_id;

// Synthesize speech using the cloned voice ID
const audioBytes = await client.tts.synthesize({
  text: "আমার ক্লোন করা কণ্ঠে এই বাক্যটি বলা হচ্ছে।",
  voiceId: voiceId,
});
```

#### Asynchronous Synthesis Batch Jobs
```javascript
// Enqueue long paragraph and wait for synthesized audio bytes
const audioBytes = await client.tts.waitForJob("দীর্ঘ বাংলা অনুচ্ছেদ যা সিন্থেসাইজ হতে সময় নেয়।");
await fs.writeFile("./long_speech.wav", audioBytes);
```

#### Incremental Text Streaming Sessions
```javascript
// Create low-latency incremental session
const session = await client.tts.createSession({ voice: "male" });

// Feed LLM tokens as they arrive
await client.tts.sendSessionText(session.session_id, "প্রথম বাক্য।");
await client.tts.sendSessionText(session.session_id, "দ্বিতীয় বাক্য।");

// Finish session
await client.tts.finishSession(session.session_id);
await client.tts.deleteSession(session.session_id);
```

#### Discover Capabilities & Queue Load
```javascript
const caps = await client.tts.capabilities();
console.log("Supported formats:", caps.response_formats);

const queue = await client.tts.queue();
console.log(`Queue load: ${queue.active} active / ${queue.capacity} capacity`);
```

---

### 5. Speech-to-Speech (STS) & LiveKit WebRTC

```javascript
// 1. Upload a cloned voice sample
const voiceRef = await client.sts.uploadVoiceReference("./my_voice.wav");
console.log(`Voice Reference ID: ${voiceRef.reference_id}`);

// 2. Mint LiveKit Room Token
const roomAccess = await client.sts.createToken({
  referenceId: voiceRef.reference_id,
  roomName: "bangla-sts-room",
  participantName: "web-user",
});

console.log("LiveKit URL:", roomAccess.livekitUrl);
console.log("Access Token:", roomAccess.token);
console.log("Room Name:   ", roomAccess.roomName);

// Connect with any LiveKit Client SDK:
// import { Room } from "livekit-client";
// const room = new Room();
// await room.connect(roomAccess.url, roomAccess.token);
```

---

### 6. Profile, Google Auth & API Keys

```javascript
// Synchronize Google / Firebase ID token
const authStatus = await client.auth.syncGoogle({ idToken: "firebase_jwt_token_here" });
console.log("Synced User:", authStatus.user?.email);

// Update display settings
await client.me.update({ displayName: "Rahim Ahmed", avatarUrl: "https://example.com/avatar.png" });

// Provision a new API key
const newKey = await client.apiKeys.create({
  name: "Crawler-Key",
  scopes: ["ocr", "asr"],
  expiresInDays: 30,
});
console.log("New Plaintext Key (save this now):", newKey.raw_api_key);

// List all keys
const keys = await client.apiKeys.list();
for (const key of keys) {
  console.log(`${key.id}: ${key.name} [${key.key_prefix}...] - Active: ${key.is_active}`);
}

// Revoke a key
await client.apiKeys.delete(newKey.id);

// Mint single-use WebSocket ticket (valid for 30 seconds)
const ticket = await client.wsTickets.create({ target: "asr_call" });
console.log("WebSocket Ticket:", ticket.ticket);
```

---

## 🛡️ Error Handling

All gateway errors raise typed exceptions inheriting from `BanglaAIError`:

```javascript
import {
  BanglaAI,
  AuthenticationError,
  RateLimitError,
  NotFoundError,
  UpstreamServiceError,
  APIConnectionError,
} from "bangla-ai";

const client = new BanglaAI({ apiKey: "sk_live_invalid" });

try {
  await client.me.get();
} catch (err) {
  if (err instanceof AuthenticationError) {
    console.error("Invalid or expired API Key.");
  } else if (err instanceof RateLimitError) {
    console.error(`Rate limited! Retry after ${err.retryAfter} seconds.`);
  } else if (err instanceof UpstreamServiceError) {
    console.error("GPU microservice temporarily unavailable.");
  } else if (err instanceof APIConnectionError) {
    console.error("Network connectivity issue.");
  }
}
```

---

## 🧪 Testing

```bash
# Run unit tests
npm test

# Run live gateway verification suite
npm run test:live
```

---

## 📄 License

MIT License. See [LICENSE](LICENSE) for details.
