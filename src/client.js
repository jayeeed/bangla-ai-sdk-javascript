import { Transport } from "./transport.js";
import { BanglaAIError } from "./exceptions.js";

/**
 * Normalizes input (string path, Buffer, Uint8Array, Blob, File) into a Blob for FormData.
 * Safely validates local filesystem paths in Node.js environments.
 *
 * @param {string | Uint8Array | Blob | File} input
 * @param {string} [filename]
 * @param {string} [contentType]
 * @returns {Promise<{ blob: Blob, filename: string }>}
 */
async function toBlob(input, filename = "file.bin", contentType = "application/octet-stream") {
  // 1. Browser or web File/Blob
  if (typeof Blob !== "undefined" && input instanceof Blob) {
    const fn = (input instanceof File && input.name) ? input.name : filename;
    return { blob: input, filename: fn };
  }

  // 2. Node.js Buffer or Uint8Array
  if (input instanceof Uint8Array || (typeof Buffer !== "undefined" && Buffer.isBuffer?.(input))) {
    return {
      blob: new Blob([input], { type: contentType }),
      filename,
    };
  }

  // 3. String path in Node.js
  if (typeof input === "string" && typeof process !== "undefined" && process.versions?.node) {
    try {
      const fs = await import("node:fs/promises");
      const pathMod = await import("node:path");
      const stat = await fs.stat(input);
      if (stat.isFile()) {
        const data = await fs.readFile(input);
        const fn = pathMod.basename(input);
        return {
          blob: new Blob([data], { type: contentType }),
          filename: fn,
        };
      }
    } catch (err) {
      // If caller passed a file path that cannot be read, fail explicitly
      if (input.includes("/") || input.includes("\\") || /\.[a-z0-9]{2,5}$/i.test(input)) {
        throw new BanglaAIError(`Failed to load file input "${input}": ${err.message}`);
      }
    }
  }

  // 4. Fallback string content
  return {
    blob: new Blob([String(input)], { type: contentType }),
    filename,
  };
}

/**
 * User Identity and Profile resource.
 */
class MeResource {
  constructor(transport) {
    this._transport = transport;
  }

  /**
   * Fetches the current user profile.
   * @returns {Promise<{ id: string, email: string, display_name: string, role: string, plan: string, monthly_quota: number }>}
   */
  async get() {
    return await this._transport.request("GET", "/v1/me");
  }

  /**
   * Updates user display settings.
   * @param {{ displayName: string }} options
   */
  async update({ displayName }) {
    return await this._transport.request("PATCH", "/v1/me", {
      json: { display_name: displayName },
    });
  }
}

/**
 * Developer API Keys management resource.
 */
class ApiKeysResource {
  constructor(transport) {
    this._transport = transport;
  }

  /**
   * Lists all active and revoked API keys for the current account.
   */
  async list() {
    return await this._transport.request("GET", "/v1/api-keys");
  }

  /**
   * Generates a new API key.
   * @param {Object} options
   * @param {string} options.name
   * @param {string[]} [options.scopes]
   * @param {string} [options.rateLimitTier]
   * @param {string} [options.rate_limit_tier]
   * @param {string[]} [options.allowedIps]
   * @param {string[]} [options.allowed_ips]
   * @param {string[]} [options.allowedOrigins]
   * @param {string[]} [options.allowed_origins]
   * @param {number} [options.expiresInDays]
   * @param {number} [options.expires_in_days]
   * @returns {Promise<{ id: string, name: string, key_prefix: string, raw_api_key: string, scopes: string[], is_active: boolean }>}
   */
  async create({
    name,
    scopes = ["all"],
    rateLimitTier,
    rate_limit_tier,
    allowedIps,
    allowed_ips,
    allowedOrigins,
    allowed_origins,
    expiresInDays = 365,
    expires_in_days,
  } = {}) {
    const payload = {
      name,
      scopes,
      expires_in_days: expires_in_days ?? expiresInDays,
    };
    const tier = rateLimitTier ?? rate_limit_tier;
    if (tier !== undefined) payload.rate_limit_tier = tier;
    const ips = allowedIps ?? allowed_ips;
    if (ips !== undefined) payload.allowed_ips = ips;
    const origins = allowedOrigins ?? allowed_origins;
    if (origins !== undefined) payload.allowed_origins = origins;

    return await this._transport.request("POST", "/v1/api-keys", {
      json: payload,
    });
  }

  /**
   * Revokes an existing API key.
   * @param {string} keyId
   */
  async delete(keyId) {
    return await this._transport.request("DELETE", `/v1/api-keys/${encodeURIComponent(keyId)}`);
  }
}

/**
 * WebSocket single-use ticket resource.
 */
class WsTicketsResource {
  constructor(transport) {
    this._transport = transport;
  }

  /**
   * Mints a single-use ticket for connecting to stateful WebSocket endpoints.
   * @param {Object} [options]
   * @param {string} [options.target] - Target endpoint ('asr_call', 'tts_text', 'sts_livekit')
   * @param {string} [options.streamSessionId] - Optional bound stream session ID
   * @returns {Promise<{ ticket: string, target: string, ttl_seconds: number, expires_at: number }>}
   */
  async create({ target = "asr_call", streamSessionId } = {}) {
    const payload = { target };
    if (streamSessionId) {
      payload.stream_session_id = streamSessionId;
    }
    return await this._transport.request("POST", "/v1/ws/tickets", {
      json: payload,
    });
  }
}

/**
 * Chat Turns resource (Conversation & SSE Streaming).
 */
class ChatTurnsResource {
  constructor(transport) {
    this._transport = transport;
  }

  /**
   * Streams LLM tokens in real time via Server-Sent Events (SSE).
   * @param {string} chatId
   * @param {Object} options
   * @param {string} options.content
   * @param {string[]} [options.attachmentIds]
   * @param {string} [options.branchId]
   * @returns {AsyncGenerator<{ event: string, text: string, data: any }, void, unknown>}
   */
  async *stream(chatId, { content, attachmentIds = [], branchId } = {}) {
    const payload = {
      content,
      attachment_ids: attachmentIds,
      branch_id: branchId,
    };

    yield* this._transport.requestStream(`/v1/chats/${encodeURIComponent(chatId)}/turns`, {
      json: payload,
    });
  }

  /**
   * Convenience method to send a prompt and return the complete accumulated assistant text.
   * @param {string} chatId
   * @param {Object} options
   * @param {string} options.content
   * @param {string[]} [options.attachmentIds]
   * @param {string} [options.branchId]
   * @returns {Promise<string>}
   */
  async create(chatId, options) {
    let fullText = "";
    for await (const chunk of this.stream(chatId, options)) {
      if (chunk.text) {
        fullText += chunk.text;
      }
    }
    return fullText;
  }

  /**
   * Cancels an ongoing generation turn.
   * @param {string} chatId
   * @param {string} turnId
   */
  async cancel(chatId, turnId) {
    return await this._transport.request("POST", `/v1/chats/${encodeURIComponent(chatId)}/turns/${encodeURIComponent(turnId)}/cancel`);
  }
}

/**
 * MinIO Chat Attachments resource.
 */
class ChatAttachmentsResource {
  constructor(transport) {
    this._transport = transport;
  }

  /**
   * Uploads a document or image to MinIO and pins it to the specified chat session.
   * @param {string} chatId
   * @param {string | Uint8Array | Blob | File} file
   * @param {Object} [options]
   * @param {string} [options.filename]
   * @param {string} [options.contentType]
   */
  async upload(chatId, file, options = {}) {
    const { blob, filename } = await toBlob(file, options.filename || "attachment.bin", options.contentType);
    const formData = new FormData();
    formData.append("file", blob, filename);

    return await this._transport.postMultipart(`/v1/chats/${encodeURIComponent(chatId)}/attachments`, formData);
  }

  /**
   * Lists all attachments uploaded to a chat session.
   * @param {string} chatId
   */
  async list(chatId) {
    return await this._transport.request("GET", `/v1/chats/${encodeURIComponent(chatId)}/attachments`);
  }

  /**
   * Gets metadata for a specific attachment.
   * @param {string} chatId
   * @param {string} attachmentId
   */
  async get(chatId, attachmentId) {
    return await this._transport.request("GET", `/v1/chats/${encodeURIComponent(chatId)}/attachments/${encodeURIComponent(attachmentId)}`);
  }

  /**
   * Deletes an attachment from the chat session.
   * @param {string} chatId
   * @param {string} attachmentId
   */
  async delete(chatId, attachmentId) {
    return await this._transport.request("DELETE", `/v1/chats/${encodeURIComponent(chatId)}/attachments/${encodeURIComponent(attachmentId)}`);
  }

  /**
   * Downloads raw attachment bytes from MinIO.
   * @param {string} chatId
   * @param {string} attachmentId
   * @returns {Promise<Uint8Array>}
   */
  async download(chatId, attachmentId) {
    return await this._transport.requestBinary("GET", `/v1/chats/${encodeURIComponent(chatId)}/attachments/${encodeURIComponent(attachmentId)}/download`);
  }
}

/**
 * Conversational LLM resource.
 */
class ChatsResource {
  constructor(transport) {
    this._transport = transport;
    this.turns = new ChatTurnsResource(transport);
    this.attachments = new ChatAttachmentsResource(transport);
  }

  /**
   * Creates a new chat conversation thread.
   * @param {Object} [options]
   * @param {string} [options.title]
   * @param {string} [options.instructions]
   * @param {boolean} [options.enableWebSearch]
   * @param {boolean} [options.enable_web_search]
   * @param {string[]} [options.customToolNames]
   * @param {string[]} [options.custom_tool_names]
   * @param {Object} [options.profile]
   * @param {string} [options.primaryService]
   * @param {Record<string, any>} [options.metadata]
   */
  async create({
    title = "New Chat",
    instructions,
    enableWebSearch = false,
    enable_web_search,
    customToolNames = [],
    custom_tool_names,
    profile,
    primaryService = "llm",
    metadata = {},
  } = {}) {
    const chatProfile = profile || {
      instructions: instructions || "",
      enable_web_search: enable_web_search ?? enableWebSearch,
      custom_tool_names: custom_tool_names ?? customToolNames,
    };

    const payload = {
      title,
      profile: chatProfile,
      primary_service: primaryService,
    };
    if (instructions) payload.instructions = instructions;
    if (metadata && Object.keys(metadata).length > 0) payload.metadata = metadata;

    return await this._transport.request("POST", "/v1/chats", {
      json: payload,
    });
  }

  /**
   * Lists existing chat threads.
   * @param {Object} [options]
   * @param {number} [options.limit]
   * @param {number} [options.offset]
   * @param {boolean} [options.includeArchived]
   */
  async list({ limit = 50, offset = 0, includeArchived = false } = {}) {
    return await this._transport.request("GET", "/v1/chats", {
      params: {
        limit,
        offset,
        include_archived: includeArchived,
      },
    });
  }

  /**
   * Fetches metadata for a single chat thread.
   * @param {string} chatId
   */
  async get(chatId) {
    return await this._transport.request("GET", `/v1/chats/${encodeURIComponent(chatId)}`);
  }

  /**
   * Updates chat thread title, archived flag, or context state.
   * @param {string} chatId
   * @param {Object} [options]
   * @param {string} [options.title]
   * @param {boolean} [options.isArchived]
   * @param {boolean} [options.is_archived]
   * @param {Record<string, any>} [options.contextState]
   * @param {Record<string, any>} [options.context_state]
   */
  async update(chatId, { title, isArchived, is_archived, contextState, context_state } = {}) {
    const payload = {};
    if (title !== undefined) payload.title = title;
    const archived = isArchived ?? is_archived;
    if (archived !== undefined) payload.is_archived = archived;
    const state = contextState ?? context_state;
    if (state !== undefined) payload.context_state = state;

    return await this._transport.request("PATCH", `/v1/chats/${encodeURIComponent(chatId)}`, {
      json: payload,
    });
  }

  /**
   * Deletes / archives a chat thread.
   * @param {string} chatId
   */
  async delete(chatId) {
    return await this._transport.request("DELETE", `/v1/chats/${encodeURIComponent(chatId)}`);
  }

  /**
   * Lists chronological conversation turns along the active or specified branch.
   * @param {string} chatId
   * @param {Object} [options]
   * @param {string} [options.branchId]
   * @param {string} [options.branch_id]
   */
  async messages(chatId, { branchId, branch_id } = {}) {
    const params = {};
    const bId = branchId ?? branch_id;
    if (bId) params.branch_id = bId;

    return await this._transport.request("GET", `/v1/chats/${encodeURIComponent(chatId)}/messages`, {
      params,
    });
  }

  /**
   * Forks the conversation tree into a new branch from a prior turn.
   * @param {string} chatId
   * @param {Object} options
   * @param {string} options.sourceBranchId
   * @param {string} [options.source_branch_id]
   * @param {string} [options.action]
   * @param {string} [options.targetTurnId]
   * @param {string} [options.target_turn_id]
   * @param {string} [options.editedContent]
   * @param {string} [options.edited_content]
   */
  async createBranch(chatId, {
    sourceBranchId,
    source_branch_id,
    action = "edit",
    targetTurnId,
    target_turn_id,
    editedContent,
    edited_content,
  } = {}) {
    const payload = {
      source_branch_id: sourceBranchId ?? source_branch_id,
      action,
      target_turn_id: targetTurnId ?? target_turn_id,
      edited_content: editedContent ?? edited_content,
    };

    return await this._transport.request("POST", `/v1/chats/${encodeURIComponent(chatId)}/branches`, {
      json: payload,
    });
  }
}

/**
 * Document OCR resource.
 */
class OCRResource {
  constructor(transport) {
    this._transport = transport;
  }

  /**
   * Synchronously processes a single-page document or image and returns markdown and layout boxes.
   * @param {string | Uint8Array | Blob | File} file
   * @param {Object} [options]
   * @param {string} [options.filename]
   * @param {string} [options.languages]
   * @param {string} [options.outputFormat]
   */
  async process(file, options = {}) {
    const { blob, filename } = await toBlob(file, options.filename || "document.png", "image/png");
    const formData = new FormData();
    formData.append("file", blob, filename);

    const params = {};
    if (options.languages) params.languages = options.languages;
    if (options.outputFormat) params.output_format = options.outputFormat;

    return await this._transport.postMultipart("/v1/ocr", formData, { params });
  }

  /**
   * Submits a multi-page document to the Celery asynchronous processing queue.
   * @param {string | Uint8Array | Blob | File} file
   * @param {Object} [options]
   */
  async createJob(file, options = {}) {
    const { blob, filename } = await toBlob(file, options.filename || "document.pdf", "application/pdf");
    const formData = new FormData();
    formData.append("file", blob, filename);

    return await this._transport.postMultipart("/v1/ocr/jobs", formData);
  }

  /**
   * Checks the progress of an asynchronous OCR job.
   * @param {string} jobId
   */
  async getJob(jobId) {
    return await this._transport.request("GET", `/v1/ocr/jobs/${encodeURIComponent(jobId)}`);
  }

  /**
   * Submits a document job and polls until completion.
   * @param {string | Uint8Array | Blob | File} file
   * @param {Object} [options]
   * @param {number} [options.pollInterval] - Polling interval in ms (default: 2000)
   * @param {number} [options.timeout] - Max wait time in ms (default: 300000)
   */
  async waitForJob(file, options = {}) {
    const pollInterval = options.pollInterval ?? 2000;
    const timeout = options.timeout ?? 300000;
    const jobRes = await this.createJob(file, options);
    const jobId = jobRes?.job_id || jobRes?.id;

    if (!jobId) {
      throw new BanglaAIError("Failed to initiate OCR job: response did not include a valid job_id.");
    }

    const startTime = Date.now();
    while (Date.now() - startTime < timeout) {
      await new Promise((r) => setTimeout(r, pollInterval));
      const statusRes = await this.getJob(jobId);
      if (statusRes.status === "completed" || statusRes.status === "SUCCESS") {
        return statusRes;
      }
      if (statusRes.status === "failed" || statusRes.status === "FAILURE") {
        throw new BanglaAIError(`OCR Job ${jobId} failed: ${statusRes.error || "Unknown error"}`);
      }
    }
    throw new BanglaAIError(`OCR Job ${jobId} timed out after ${timeout}ms.`);
  }
}

/**
 * Speech-to-Text (ASR) resource.
 */
class ASRResource {
  constructor(transport) {
    this._transport = transport;
  }

  /**
   * Transcribes an audio file (.wav, .mp3, .ogg) with optional speaker diarization.
   * @param {string | Uint8Array | Blob | File} file
   * @param {Object} [options]
   * @param {string} [options.filename]
   * @param {boolean} [options.diarize]
   */
  async transcribe(file, options = {}) {
    const { blob, filename } = await toBlob(file, options.filename || "audio.wav", "audio/wav");
    const formData = new FormData();
    formData.append("file", blob, filename);
    formData.append("diarize", String(options.diarize ?? false));

    return await this._transport.postMultipart("/v1/asr/transcribe/offline", formData);
  }

  /**
   * Extracts audio from a YouTube video and transcribes it.
   * @param {Object} options
   * @param {string} options.url
   * @param {boolean} [options.diarize]
   * @param {boolean} [options.includeAudio]
   */
  async transcribeYoutube({ url, diarize = true, includeAudio = true } = {}) {
    return await this._transport.request("POST", "/v1/asr/transcribe/youtube", {
      json: { url, diarize, include_audio: includeAudio },
    });
  }

  /**
   * Initiates a stateful live PCM16 speech recognition stream.
   * @param {Object} [options]
   * @param {number} [options.sampleRate]
   * @param {number} [options.sample_rate]
   * @returns {Promise<{ session_id: string, sample_rate: number }>}
   */
  async createStream({ sampleRate = 16000, sample_rate } = {}) {
    return await this._transport.request("POST", "/v1/asr/streams", {
      params: { sample_rate: sample_rate ?? sampleRate },
    });
  }

  /**
   * Submits raw 16kHz signed 16-bit little-endian mono PCM audio chunk.
   * @param {string} sessionId
   * @param {Uint8Array | Buffer} pcmBytes
   * @param {Object} [options]
   * @param {number} [options.sampleRate]
   * @param {number} [options.sample_rate]
   * @param {number} [options.generation]
   * @param {number} [options.chunkSequence]
   * @param {number} [options.chunk_sequence]
   * @returns {Promise<{ transcript: string, partial_text: string, final_text: string, final_words: any[], event: string, turn_id?: string }>}
   */
  async streamChunk(sessionId, pcmBytes, {
    sampleRate = 16000,
    sample_rate,
    generation = 0,
    chunkSequence = 0,
    chunk_sequence,
  } = {}) {
    return await this._transport.request("POST", `/v1/asr/streams/${encodeURIComponent(sessionId)}/chunk/pcm16`, {
      body: pcmBytes,
      headers: { "Content-Type": "application/octet-stream" },
      params: {
        sample_rate: sample_rate ?? sampleRate,
        generation,
        chunk_sequence: chunk_sequence ?? chunkSequence,
      },
    });
  }

  /**
   * Finalizes live ASR stream and records usage.
   * @param {string} sessionId
   * @returns {Promise<any>}
   */
  async finishStream(sessionId) {
    return await this._transport.request("POST", `/v1/asr/streams/${encodeURIComponent(sessionId)}/finish`);
  }

  /**
   * Aborts and releases a streaming session.
   * @param {string} sessionId
   * @returns {Promise<any>}
   */
  async abortStream(sessionId) {
    return await this._transport.request("DELETE", `/v1/asr/streams/${encodeURIComponent(sessionId)}`);
  }
}

/**
 * Speech Synthesis (TTS) resource.
 */
class TTSResource {
  constructor(transport) {
    this._transport = transport;
  }

  /**
   * Synthesizes Bengali text into full WAV audio using simple Higgs TTS synthesis.
   * @param {Object} options
   * @param {string} options.text
   * @param {string} [options.voice]
   * @param {string} [options.emotion]
   * @param {number} [options.speed]
   * @param {string} [options.format]
   * @param {number} [options.firstSegmentMaxChars]
   * @returns {Promise<Uint8Array>}
   */
  async synthesize({ text, voice = "male", emotion = "neutral", speed = 1.0, format = "wav", firstSegmentMaxChars = 45 } = {}) {
    return await this._transport.requestBinary("POST", "/v1/tts/simple", {
      json: {
        text,
        voice,
        emotion,
        speed,
        format,
        first_segment_max_chars: firstSegmentMaxChars,
      },
    });
  }

  /**
   * Synthesizes speech and writes it directly to disk (Node.js only).
   * @param {string} text
   * @param {string} filePath
   * @param {Object} [options]
   */
  async synthesizeToFile(text, filePath, options = {}) {
    const audioBytes = await this.synthesize({ text, ...options });
    if (typeof process !== "undefined" && process.versions?.node) {
      const fs = await import("node:fs/promises");
      await fs.writeFile(filePath, audioBytes);
    } else {
      throw new BanglaAIError("synthesizeToFile is only supported in Node.js environments.");
    }
  }

  /**
   * Streams 24 kHz 16-bit mono PCM audio chunks in real time.
   * @param {string} text
   * @param {Object} [options]
   * @param {string} [options.voice]
   * @param {string} [options.emotion]
   * @param {number} [options.speed]
   * @param {number} [options.firstSegmentMaxChars]
   * @returns {AsyncGenerator<Uint8Array, void, unknown>}
   */
  async *streamPcm(text, { voice = "male", emotion = "neutral", speed = 1.0, firstSegmentMaxChars = 45 } = {}) {
    yield* this._transport.requestRawStream("/v1/tts/simple/stream", {
      json: {
        text,
        voice,
        emotion,
        speed,
        first_segment_max_chars: firstSegmentMaxChars,
      },
    });
  }

  /**
   * Generates zero-shot voice cloned speech with reference audio.
   * @param {Object} options
   * @param {string} options.input
   * @param {Object} [options.referenceAudio]
   * @param {string} [options.voice]
   * @param {number} [options.speed]
   * @returns {Promise<Uint8Array>}
   */
  async advanced({ input, referenceAudio = {}, voice = "female", speed = 1.0 } = {}) {
    return await this._transport.requestBinary("POST", "/v1/tts/advanced", {
      json: {
        input,
        reference_audio: referenceAudio,
        voice,
        speed,
      },
    });
  }

  /**
   * Discovers available neural speaker voices, styles, and audio formats.
   */
  async models() {
    return await this._transport.request("GET", "/v1/tts/models");
  }

  /**
   * Alias for discovering models/voices.
   */
  async listVoices() {
    return await this.models();
  }
}

/**
 * Speech-to-Speech (STS) LiveKit WebRTC resource.
 */
class STSResource {
  constructor(transport) {
    this._transport = transport;
  }

  /**
   * Uploads a reference audio clip (.wav) to clone a voice for STS conversations.
   * @param {string | Uint8Array | Blob | File} file
   * @param {Object} [options]
   * @param {string} [options.filename]
   */
  async uploadVoiceReference(file, options = {}) {
    const { blob, filename } = await toBlob(file, options.filename || "reference.wav", "audio/wav");
    const formData = new FormData();
    formData.append("file", blob, filename);

    return await this._transport.postMultipart("/v1/sts/voice/reference", formData);
  }

  /**
   * Mints a scoped LiveKit SFU room token for real-time speech-to-speech interaction.
   * @param {Object} [options]
   * @param {string} [options.voice]
   * @param {string} [options.referenceId]
   * @param {string} [options.phoneNumber]
   * @param {string} [options.mode]
   * @param {string} [options.tenantId]
   * @param {string} [options.customerId]
   * @param {string} [options.roomName]
   * @param {string} [options.participantName]
   */
  async getLiveKitToken(options = {}) {
    const payload = {
      tenant_id: options.tenantId || "default",
      customer_id: options.customerId || "default",
      voice: options.voice,
      reference_id: options.referenceId,
      phone_number: options.phoneNumber,
      mode: options.mode,
    };
    if (options.roomName) payload.room_name = options.roomName;
    if (options.participantName) payload.participant_name = options.participantName;

    const res = await this._transport.request("POST", "/v1/sts/livekit/token", {
      json: payload,
    });

    // Provide convenience getter properties
    return {
      ...res,
      get roomName() { return this.room; },
      get livekitUrl() { return this.url; },
    };
  }

  /**
   * Convenience alias for getLiveKitToken.
   */
  async createToken(options = {}) {
    return await this.getLiveKitToken(options);
  }
}

/**
 * Top-level Bangla AI Gateway Client.
 *
 * Usage:
 * ```javascript
 * import { BanglaAI } from "bangla-ai";
 *
 * const client = new BanglaAI({ apiKey: "sk_live_..." });
 * const me = await client.me.get();
 * ```
 */
export class BanglaAI {
  /**
   * @param {Object} [config]
   * @param {string} [config.apiKey] - Gateway API key (defaults to process.env.BANGLA_AI_API_KEY)
   * @param {string} [config.baseUrl] - Base endpoint (defaults to https://banglai.acimisai.com)
   * @param {number} [config.timeout] - Request timeout in ms (default: 60000)
   * @param {number} [config.maxRetries] - Max retry attempts for 429/503 (default: 2)
   * @param {Record<string, string>} [config.headers] - Custom HTTP headers
   */
  constructor(config = {}) {
    this._transport = new Transport(config);

    // Modality Sub-resources
    this.me = new MeResource(this._transport);
    this.apiKeys = new ApiKeysResource(this._transport);
    this.wsTickets = new WsTicketsResource(this._transport);
    this.chats = new ChatsResource(this._transport);
    this.ocr = new OCRResource(this._transport);
    this.asr = new ASRResource(this._transport);
    this.tts = new TTSResource(this._transport);
    this.sts = new STSResource(this._transport);

    // Snake_case aliases for Python ecosystem compatibility
    this.api_keys = this.apiKeys;
    this.ws_tickets = this.wsTickets;
  }

  /**
   * Checks gateway server liveness.
   * @returns {Promise<{ status: string, service: string, version: string }>}
   */
  async health() {
    return await this._transport.request("GET", "/healthz");
  }

  /**
   * Checks composite readiness of database, redis, minio, and upstreams.
   * @returns {Promise<{ status: string, timestamp: number, checks: Record<string, string> }>}
   */
  async ready() {
    return await this._transport.request("GET", "/readyz");
  }

  /**
   * Closes underlying client resources (no-op for Fetch API; mirrors Python close()).
   */
  close() {}
}
