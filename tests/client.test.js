import test from "node:test";
import assert from "node:assert/strict";
import { BanglaAI } from "../src/index.js";

// Mock server using globalThis.fetch interception
function createMockClient() {
  const client = new BanglaAI({ apiKey: "sk_live_test_123", baseUrl: "https://mock.bangla-ai.org" });

  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url, options = {}) => {
    const urlStr = String(url);
    const parsedUrl = new URL(urlStr);
    const pathname = parsedUrl.pathname;
    const method = options.method || "GET";
    const headers = options.headers || {};

    // Auth check
    const authHdr = headers["Authorization"] || headers["authorization"];
    const xKey = headers["X-API-Key"] || headers["x-api-key"];
    if (!authHdr && !xKey) {
      return new Response(JSON.stringify({ code: "UNAUTHORIZED", detail: "Missing API Key" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Health
    if (pathname === "/healthz") {
      return new Response(JSON.stringify({ status: "ok", service: "Bangla AI Gateway", version: "2.0.0" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }
    if (pathname === "/readyz") {
      return new Response(JSON.stringify({ status: "healthy", checks: { database: "ok", redis: "ok" } }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Me
    if (pathname === "/v1/me" && method === "GET") {
      return new Response(JSON.stringify({ id: "usr_123", email: "test@bangla.ai", display_name: "Test", role: "developer", plan: "pro" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }
    if (pathname === "/v1/me" && method === "PATCH") {
      const body = JSON.parse(options.body);
      return new Response(JSON.stringify({ id: "usr_123", display_name: body.display_name || "Updated" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Auth sync
    if (pathname === "/v1/auth/google" && method === "POST") {
      return new Response(JSON.stringify({ status: "synced", synced: true, provider: "google", user: { id: "usr_123" } }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }

    // API Keys
    if (pathname === "/v1/api-keys" && method === "GET") {
      return new Response(JSON.stringify([{ id: "key_1", name: "test-key" }]), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }
    if (pathname === "/v1/api-keys" && method === "POST") {
      const body = JSON.parse(options.body);
      return new Response(JSON.stringify({ id: "key_1", name: body.name, raw_api_key: "sk_live_123" }), {
        status: 201,
        headers: { "Content-Type": "application/json" },
      });
    }
    if (pathname.startsWith("/v1/api-keys/") && method === "DELETE") {
      return new Response(null, { status: 204 });
    }

    // WS Tickets (verify correct path)
    if (pathname === "/v1/ws/tickets" && method === "POST") {
      const body = JSON.parse(options.body);
      return new Response(JSON.stringify({ ticket: "tkt_123", target: body.target, ttl_seconds: 30 }), {
        status: 201,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Chats
    if (pathname === "/v1/chats" && method === "POST") {
      const body = JSON.parse(options.body);
      return new Response(JSON.stringify({ id: "cht_123", title: body.title }), {
        status: 201,
        headers: { "Content-Type": "application/json" },
      });
    }
    if (pathname === "/v1/chats" && method === "GET") {
      return new Response(JSON.stringify([{ id: "cht_123", title: "Test Chat" }]), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }
    if (pathname === "/v1/chats/cht_123" && method === "GET") {
      return new Response(JSON.stringify({ id: "cht_123", title: "Test Chat" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }
    if (pathname === "/v1/chats/cht_123" && method === "PATCH") {
      const body = JSON.parse(options.body);
      return new Response(JSON.stringify({ id: "cht_123", title: body.title }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }
    if (pathname === "/v1/chats/cht_123/messages" && method === "GET") {
      return new Response(JSON.stringify([{ id: "trn_1", input_content: "হ্যালো", output_text: "নমস্কার", status: "completed" }]), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }
    if (pathname === "/v1/chats/cht_123/branches" && method === "POST") {
      return new Response(JSON.stringify({ id: "cht_123", active_branch_id: "brn_2" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }
    if (pathname.endsWith("/turns") && method === "POST") {
      // Assert Idempotency-Key header was attached
      assert.ok(headers["Idempotency-Key"] || headers["idempotency-key"]);
      const sseContent =
        "event: token\n" +
        "data: {\"text\": \"বাংলা \"}\n\n" +
        "event: token\n" +
        "data: {\"text\": \"এআই\"}\n\n" +
        "event: turn_completed\n" +
        "data: {\"turn_id\": \"trn_1\"}\n\n";
      return new Response(sseContent, {
        status: 200,
        headers: { "Content-Type": "text/event-stream" },
      });
    }
    if (pathname.includes("/attachments") && method === "POST") {
      return new Response(JSON.stringify({ id: "att_1", filename: "test.pdf", size_bytes: 512 }), {
        status: 201,
        headers: { "Content-Type": "application/json" },
      });
    }
    if (pathname.includes("/attachments/") && method === "DELETE") {
      return new Response(null, { status: 204 });
    }

    // OCR
    if (pathname === "/v1/ocr" && method === "POST") {
      return new Response(JSON.stringify({ markdown: "# নথি", pages: [] }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }
    if (pathname === "/v1/ocr/jobs" && method === "POST") {
      return new Response(JSON.stringify({ job_id: "ocr_job_1", status: "queued", status_url: "/v1/ocr/jobs/ocr_job_1" }), {
        status: 202,
        headers: { "Content-Type": "application/json" },
      });
    }
    if (pathname === "/v1/ocr/jobs/ocr_job_1" && method === "GET") {
      return new Response(JSON.stringify({ job_id: "ocr_job_1", status: "completed", result: { markdown: "# সম্পন্ন" } }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }

    // ASR
    if (pathname === "/v1/asr/transcribe/offline" && method === "POST") {
      return new Response(JSON.stringify({ text: "বাংলা অডিও ট্রান্সক্রিপ্ট", duration_seconds: 3.5 }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }
    if (pathname === "/v1/asr/transcribe/offline/jobs" && method === "POST") {
      return new Response(JSON.stringify({ job_id: "job_asr_1", status: "queued", status_url: "/v1/asr/jobs/job_asr_1" }), {
        status: 202,
        headers: { "Content-Type": "application/json" },
      });
    }
    if (pathname === "/v1/asr/jobs/job_asr_1" && method === "GET") {
      return new Response(JSON.stringify({ job_id: "job_asr_1", status: "completed", result: { text: "অ্যাসিঙ্ক টেক্সট" } }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }
    if (pathname === "/v1/asr/transcribe/youtube" && method === "POST") {
      return new Response(JSON.stringify({ text: "ইউটিউব টেক্সট", source_url: "https://youtu.be/test" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }
    if (pathname === "/v1/asr/streams" && method === "POST") {
      return new Response(JSON.stringify({ session_id: "sess_asr_1", sample_rate: 16000 }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }
    if (pathname.includes("/chunk/pcm16") && method === "POST") {
      return new Response(JSON.stringify({ transcript: "লাইভ বাংলা", partial_text: "বাংলা" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }
    if (pathname.endsWith("/finish") && pathname.includes("/asr/streams/")) {
      return new Response(JSON.stringify({ status: "finished" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }

    // TTS
    if (pathname === "/v1/tts/simple" && method === "POST") {
      return new Response(new Uint8Array([82, 73, 70, 70]), {
        status: 200,
        headers: { "Content-Type": "audio/wav" },
      });
    }
    if (pathname === "/v1/tts/models" && method === "GET") {
      return new Response(JSON.stringify({ models: ["bosonai/higgs-tts-3-4b"], voices: ["male", "female"] }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }
    if (pathname === "/v1/capabilities" && method === "GET") {
      return new Response(JSON.stringify({ object: "tts_capabilities", streaming: true, voice_cloning: true }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }
    if (pathname === "/v1/queue" && method === "GET") {
      return new Response(JSON.stringify({ object: "tts_queue", capacity: 4, available: 4 }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }
    if (pathname === "/v1/tts/voices" && method === "POST") {
      return new Response(JSON.stringify({ voice_id: "voice_123", status: "ready" }), {
        status: 201,
        headers: { "Content-Type": "application/json" },
      });
    }
    if (pathname === "/v1/tts/simple/jobs" && method === "POST") {
      return new Response(JSON.stringify({ job_id: "tts_job_1", status: "queued", status_url: "/v1/tts/jobs/tts_job_1" }), {
        status: 202,
        headers: { "Content-Type": "application/json" },
      });
    }
    if (pathname === "/v1/tts/jobs/tts_job_1" && method === "GET") {
      return new Response(JSON.stringify({ job_id: "tts_job_1", status: "completed" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }
    if (pathname === "/v1/tts/jobs/tts_job_1/download" && method === "GET") {
      return new Response(new Uint8Array([82, 73, 70, 70, 1, 2]), {
        status: 200,
        headers: { "Content-Type": "audio/wav" },
      });
    }
    if (pathname === "/v1/tts/sessions" && method === "POST") {
      return new Response(JSON.stringify({ object: "tts_session", session_id: "tts_sess_1", status: "open" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }

    // STS
    if (pathname === "/v1/sts/voice/reference" && method === "POST") {
      return new Response(JSON.stringify({ reference_id: "ref_123", transcript: "নমুনা ভয়েস" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }
    if (pathname === "/v1/sts/livekit/token" && method === "POST") {
      return new Response(JSON.stringify({ url: "wss://livekit.io", token: "jwt_123", room: "room_123" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ detail: `Unhandled path: ${pathname}` }), {
      status: 404,
      headers: { "Content-Type": "application/json" },
    });
  };

  return { client, restore: () => { globalThis.fetch = originalFetch; } };
}

test("System health & ready checks", async () => {
  const { client, restore } = createMockClient();
  try {
    const health = await client.health();
    assert.strictEqual(health.status, "ok");

    const ready = await client.ready();
    assert.strictEqual(ready.status, "healthy");
  } finally {
    restore();
  }
});

test("User profile & Google auth sync", async () => {
  const { client, restore } = createMockClient();
  try {
    const me = await client.me.get();
    assert.strictEqual(me.id, "usr_123");

    const updated = await client.me.update({ displayName: "Updated User" });
    assert.strictEqual(updated.display_name, "Updated User");

    const authSync = await client.auth.syncGoogle({ idToken: "jwt_token" });
    assert.strictEqual(authSync.synced, true);
    assert.strictEqual(authSync.provider, "google");
  } finally {
    restore();
  }
});

test("API keys & WS ticket", async () => {
  const { client, restore } = createMockClient();
  try {
    const keys = await client.apiKeys.list();
    assert.strictEqual(keys.length, 1);

    const created = await client.apiKeys.create({ name: "my-key" });
    assert.strictEqual(created.name, "my-key");

    await client.apiKeys.delete(created.id);

    const ticket = await client.wsTickets.create({ target: "asr_call" });
    assert.strictEqual(ticket.ticket, "tkt_123");
  } finally {
    restore();
  }
});

test("Chat conversation, streaming turn, messages, and attachments", async () => {
  const { client, restore } = createMockClient();
  try {
    const chat = await client.chats.create({ title: "Smoke Chat" });
    assert.strictEqual(chat.id, "cht_123");

    const chatList = await client.chats.list();
    assert.strictEqual(chatList.length, 1);

    // Streaming turn
    let streamText = "";
    for await (const chunk of client.chats.turns.stream(chat.id, { content: "নমস্কার" })) {
      if (chunk.text) streamText += chunk.text;
    }
    assert.strictEqual(streamText, "বাংলা এআই");

    // Convenience create turn
    const reply = await client.chats.turns.create(chat.id, { content: "নমস্কার" });
    assert.strictEqual(String(reply), "বাংলা এআই");
    assert.strictEqual(reply.content, "বাংলা এআই");

    // Messages
    const msgs = await client.chats.messages(chat.id);
    assert.strictEqual(msgs.length, 1);
    assert.strictEqual(msgs[0].output_text, "নমস্কার");

    // Branch
    const branch = await client.chats.createBranch(chat.id, { sourceBranchId: "brn_1", targetTurnId: "trn_1" });
    assert.strictEqual(branch.active_branch_id, "brn_2");

    // Attachments
    const att = await client.chats.attachments.upload(chat.id, new Uint8Array([1, 2, 3]), { filename: "test.pdf" });
    assert.strictEqual(att.filename, "test.pdf");

    await client.chats.attachments.delete(chat.id, att.id);
  } finally {
    restore();
  }
});

test("OCR single-page and async batch jobs", async () => {
  const { client, restore } = createMockClient();
  try {
    const ocr = await client.ocr.process(new Uint8Array([1, 2, 3]));
    assert.strictEqual(ocr.markdown, "# নথি");

    const job = await client.ocr.createJob(new Uint8Array([1, 2, 3]));
    assert.strictEqual(job.job_id, "ocr_job_1");

    const waited = await client.ocr.waitForJob(job.job_id, { pollInterval: 5 });
    assert.strictEqual(waited.status, "completed");
  } finally {
    restore();
  }
});

test("ASR offline, async job, YouTube, and streaming", async () => {
  const { client, restore } = createMockClient();
  try {
    const res = await client.asr.transcribe(new Uint8Array([82, 73, 70, 70]));
    assert.strictEqual(res.text, "বাংলা অডিও ট্রান্সক্রিপ্ট");

    const job = await client.asr.createJob(new Uint8Array([82, 73, 70, 70]));
    assert.strictEqual(job.job_id, "job_asr_1");

    const waited = await client.asr.waitForJob(job.job_id, { pollInterval: 5 });
    assert.strictEqual(waited.status, "completed");

    const yt = await client.asr.transcribeYoutube({ url: "https://youtu.be/test" });
    assert.strictEqual(yt.text, "ইউটিউব টেক্সট");

    const stream = await client.asr.createStream({ sampleRate: 16000 });
    assert.strictEqual(stream.session_id, "sess_asr_1");

    const chunk = await client.asr.streamChunkPcm(stream.session_id, new Uint8Array([0, 0, 0, 0]));
    assert.strictEqual(chunk.transcript, "লাইভ বাংলা");

    const finished = await client.asr.finishStream(stream.session_id);
    assert.strictEqual(finished.status, "finished");
  } finally {
    restore();
  }
});

test("TTS synthesis, discovery, voice profile, async jobs, and sessions", async () => {
  const { client, restore } = createMockClient();
  try {
    // Models & Discovery
    const models = await client.tts.models();
    assert.ok(models.models.includes("bosonai/higgs-tts-3-4b"));

    const voices = await client.tts.listVoices();
    assert.ok(voices.voices.includes("female"));

    const caps = await client.tts.capabilities();
    assert.strictEqual(caps.streaming, true);

    const q = await client.tts.queue();
    assert.strictEqual(q.capacity, 4);

    // Synthesis
    const audio = await client.tts.synthesize({ text: "স্বাগতম" });
    assert.strictEqual(audio[0], 82);

    // Voice profile upload
    const voice = await client.tts.createVoice(new Uint8Array([82, 73, 70, 70]), { name: "custom-voice" });
    assert.strictEqual(voice.voice_id, "voice_123");

    // Async job & wait
    const job = await client.tts.createJob({ text: "অ্যাসিঙ্ক টেক্সট" });
    assert.strictEqual(job.job_id, "tts_job_1");

    const jobAudio = await client.tts.waitForJob(job.job_id, { pollInterval: 5 });
    assert.strictEqual(jobAudio[0], 82);

    // Sessions
    const sess = await client.tts.createSession();
    assert.strictEqual(sess.session_id, "tts_sess_1");
  } finally {
    restore();
  }
});

test("STS voice reference and LiveKit token minting", async () => {
  const { client, restore } = createMockClient();
  try {
    const ref = await client.sts.uploadVoiceReference(new Uint8Array([82, 73, 70, 70]));
    assert.strictEqual(ref.reference_id, "ref_123");

    const token = await client.sts.createToken({ roomName: "my-room" });
    assert.strictEqual(token.room, "room_123");
    assert.strictEqual(token.roomName, "room_123");
    assert.strictEqual(token.livekitUrl, "wss://livekit.io");
  } finally {
    restore();
  }
});
