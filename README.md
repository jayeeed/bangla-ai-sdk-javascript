# Bangla AI JavaScript / TypeScript SDK (`bangla-ai`)

![Async](https://img.shields.io/badge/async-supported-blue)
![Node.js](https://img.shields.io/badge/node-18+-green)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![npm version](https://img.shields.io/badge/npm-0.1.0-orange.svg)](https://www.npmjs.com/package/bangla-ai)

The official Node.js, Browser, and TypeScript SDK for the **Bangla AI Gateway**. Easily connect your applications to state-of-the-art Bengali language AI microservices:
- 💬 **Large Language Model (LLM)**: Multi-branch conversation trees and token-by-token SSE streaming.
- 📄 **Document OCR**: High-accuracy Bengali document parsing with layout detection, bounding boxes, and Markdown output.
- 🎙️ **Speech-to-Text (ASR)**: Nemotron Bengali ASR for offline audio files, YouTube transcription, and real-time streams.
- 🔊 **Speech Synthesis (TTS)**: Higgs TTS 3 (4B) neural voice synthesis returning 24 kHz WAV/PCM audio and zero-shot voice cloning.
- 🗣️ **Speech-to-Speech (STS)**: LiveKit SFU room token minting and custom voice clone references.

---

## 🚀 Features

- **✅ Native Fetch (Zero Runtime Dependencies)**: Built on standard modern Fetch API (`fetch`, `FormData`, `ReadableStream`) supported out-of-the-box in Node 18+, Bun, Deno, and modern browsers.
- **⚡ Real-Time Streaming**: First-class Server-Sent Events (SSE) streaming for LLM tokens and 24 kHz raw PCM audio chunks for TTS using standard `for await (const chunk of stream)`.
- **🛡️ Robust Error Handling**: Clean RFC 7807 typed exceptions (`RateLimitError`, `AuthenticationError`, `UpstreamServiceError`, etc.) with automatic retry on transient failures.
- **🔐 Flexible Authentication**: Auto-discovers credentials from `BANGLA_AI_API_KEY` environment variables or `.env` file via `dotenv`.
- **📘 Full TypeScript Definitions**: First-class `.d.ts` declaration file included with autocompletion, type safety, and JSDoc documentation.
- **📦 npm Deploy Ready**: Out-of-the-box standard `package.json`, automated GitHub Actions workflow, and smoke verification suite.

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

Copy [.env.example](.env.example) to `.env` and set your API key:

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
console.log("AI:", reply);
```

---

## 🧪 Smoke Testing

Run the included verification script to test your gateway connection and verify all endpoints:

```bash
node test.js
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

// Stream tokens in real time
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

#### Uploading Chat Attachments (PDF / Images)
```javascript
// Upload document to MinIO
const att = await client.chats.attachments.upload(chat.id, "./invoice.pdf");
console.log(`Attached: ${att.filename} (${att.size_bytes} bytes)`);

// Submit prompt referencing the uploaded attachment
const reply = await client.chats.turns.create(chat.id, {
  content: "এই ইনভয়েসের মোট টাকার পরিমাণ কত?",
  attachmentIds: [att.id],
});
console.log("AI:", reply);
```

---

### 2. Document OCR

#### Synchronous Document OCR (Single-Page / Fast Scan)
```javascript
const result = await client.ocr.process("./nid_card.jpg");
console.log("Extracted Markdown:\n", result.markdown);

// Inspect individual layout regions and bounding boxes
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

#### YouTube Video Audio Transcription
```javascript
const ytResult = await client.asr.transcribeYoutube({
  url: "https://www.youtube.com/watch?v=example_video_id",
  diarize: true,
});
console.log("Video Title:", ytResult.title);
console.log("Diarization:", ytResult.diarization_text);
```

---

### 4. Speech Synthesis (TTS)

#### Full WAV Audio Synthesis
```javascript
// Save speech directly to disk (Node.js)
await client.tts.synthesizeToFile(
  "স্বাগতম! বাংলা এআই প্ল্যাটফর্মে আপনাকে স্বাগতম।",
  "./welcome.wav",
  { voice: "female", emotion: "happy" }
);
```

#### Real-Time PCM Stream (24 kHz 16-bit Mono)
```javascript
// Stream PCM audio bytes directly for audio players or web audio
for await (const pcmChunk of client.tts.streamPcm("বাংলা ভাষার জন্য উচ্চগতির কণ্ঠ রূপান্তর প্রযুক্তি।")) {
  sendToAudioHardware(pcmChunk);
}
```

#### Zero-Shot Voice Cloning
```javascript
const audioBytes = await client.tts.advanced({
  input: "ক্লোন করা কণ্ঠস্বরে তৈরি বাক্য।",
  referenceAudio: {
    audio_base64: "UklGRiQAAABXQVZFZm10IBAAAA...",
    transcript: "রেফারেন্স অডিওতে বলা বাক্য",
  },
});
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

// Connect with LiveKit Client SDK:
// import { Room } from "livekit-client";
// const room = new Room();
// await room.connect(roomAccess.url, roomAccess.token);
```

---

### 6. Managing Profile & Developer API Keys

```javascript
// Update display name
await client.me.update({ displayName: "Rahim Ahmed" });

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

## 🚀 Automated npm Deployment

This package includes an automated GitHub Actions release workflow in [`.github/workflows/npm-publish.yml`](.github/workflows/npm-publish.yml).

To publish automatically to npm:
1. In your GitHub repository, add your npm access token under **Settings > Secrets and variables > Actions** as `NPM_TOKEN`.
2. Bump the `version` field in `package.json`.
3. Commit and push to `main`:
   ```bash
   git add .
   git commit -m "release: v0.1.0"
   git push origin main
   ```
4. GitHub Actions will verify and publish the package directly to the npm public registry.

---

## 📄 License

MIT License. See [LICENSE](LICENSE) for details.
