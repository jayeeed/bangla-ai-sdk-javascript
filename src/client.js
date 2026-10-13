import { Transport } from "./transport.js";

/**
 * Normalizes input (string path, Buffer, Uint8Array, Blob, File) into a Blob for FormData.
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
      const data = await fs.readFile(input);
      const fn = pathMod.basename(input);
      return {
        blob: new Blob([data], { type: contentType }),
        filename: fn,
      };
    } catch {
      // If file reading fails, treat string as text
    }
  }

  // 4. Fallback string content
  return {
    blob: new Blob([String(input)], { type: contentType }),
    filename,
  };
}

/**
 * Generates an RFC 4122 compliant UUID v4 string.
 * @returns {string}
 */
function generateUUID() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
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
   * Updates user display settings and profile metadata.
   * @param {Object} options
   * @param {string} [options.displayName]
   * @param {string} [options.avatarUrl]
   * @param {Record<string, any>} [options.preferences]
   */
  async update({ displayName, avatarUrl, preferences } = {}) {
    const json = {};
    if (displayName !== undefined) json.display_name = displayName;
    if (avatarUrl !== undefined) json.avatar_url = avatarUrl;
    if (preferences !== undefined) json.preferences = preferences;

    return await this._transport.request("PATCH", "/v1/me", { json });
  }
}

/**
 * Third-party Authentication Synchronization resource.
 */
class AuthResource {
  constructor(transport) {
    this._transport = transport;
  }

  /**
   * Synchronizes Google / Firebase authentication token with PostgreSQL backend user record.
   * @param {Object} [options]
   * @param {string} [options.idToken] - Firebase or Google ID Token JWT
   * @param {string} [options.token] - Alias for idToken
   * @param {string} [options.provider] - Provider identifier ('google')
   */
  async syncGoogle({ idToken, token, provider = "google" } = {}) {
    const jwt = idToken || token;
    const json = { provider };
    if (jwt) json.id_token = jwt;

    const headers = {};
    if (jwt) headers["Authorization"] = `Bearer ${jwt}`;

    return await this._transport.request("POST", "/v1/auth/google", {
      json,
      headers: Object.keys(headers).length > 0 ? headers : undefined,
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
   * @param {number} [options.expiresInDays]
   * @returns {Promise<{ id: string, name: string, key_prefix: string, raw_api_key: string, scopes: string[], is_active: boolean }>}
   */
  async create({ name, scopes = ["all"], expiresInDays = 365 } = {}) {
    return await this._transport.request("POST", "/v1/api-keys", {
      json: {
        name,
        scopes,
        expires_in_days: expiresInDays,
      },
    });
  }

  /**
   * Revokes an existing API key.
   * @param {string} keyId
   */
  async delete(keyId) {
    return await this._transport.request("DELETE", `/v1/api-keys/${keyId}`);
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
   * @param {string} [options.target] - Target modality ('asr_call', 'sts')
   * @param {string} [options.streamSessionId] - Associated stream session ID
   * @returns {Promise<{ ticket: string, target: string, ttl_seconds: number, expires_at: string }>}
   */
  async create({ target = "asr_call", streamSessionId } = {}) {
    const json = { target };
    if (streamSessionId) json.stream_session_id = streamSessionId;

    return await this._transport.request("POST", "/v1/ws/tickets", { json });
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
   * Automatically passes an RFC 4122 Idempotency-Key header.
   * @param {string} chatId
   * @param {Object} options
   * @param {string} options.content
   * @param {string[]} [options.attachmentIds]
   * @param {string} [options.branchId]
   * @param {string} [options.idempotencyKey]
   * @returns {AsyncGenerator<{ event: string, text: string, turn_id?: string, branch_id?: string, data: any }, void, unknown>}
   */
  async *stream(chatId, { content, attachmentIds = [], branchId, idempotencyKey } = {}) {
    const payload = {
      content,
      attachment_ids: attachmentIds,
      branch_id: branchId,
    };
    const key = idempotencyKey || generateUUID();
    const headers = { "Idempotency-Key": key };

    for await (const chunk of this._transport.requestStream(`/v1/chats/${chatId}/turns`, {
      json: payload,
      headers,
    })) {
      const parsed = chunk.data && typeof chunk.data === "object" ? chunk.data : {};
      yield {
        event: chunk.event,
        text: chunk.text || parsed.text || "",
        turn_id: parsed.turn_id,
        branch_id: parsed.branch_id,
        data: chunk.data,
      };
    }
  }

  /**
   * Convenience method to send a prompt and return the complete accumulated assistant text.
   * Returns a string that also has .content and .turnId properties for convenience.
   * @param {string} chatId
   * @param {Object} options
   * @param {string} options.content
   * @param {string[]} [options.attachmentIds]
   * @param {string} [options.branchId]
   * @param {string} [options.idempotencyKey]
   * @returns {Promise<string>}
   */
  async create(chatId, options) {
    let fullText = "";
    let lastTurnId = null;
    for await (const chunk of this.stream(chatId, options)) {
      if (chunk.text) {
        fullText += chunk.text;
      }
      if (chunk.turn_id) {
        lastTurnId = chunk.turn_id;
      }
    }
    const resultStr = new String(fullText);
    resultStr.content = fullText;
    resultStr.text = fullText;
    resultStr.turnId = lastTurnId;
    return resultStr;
  }

  /**
   * Cancels an ongoing generation turn.
   * @param {string} chatId
   * @param {string} turnId
   */
  async cancel(chatId, turnId) {
    return await this._transport.request("POST", `/v1/chats/${chatId}/turns/${turnId}/cancel`);
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

    return await this._transport.postMultipart(`/v1/chats/${chatId}/attachments`, formData);
  }

  /**
   * Lists all attachments uploaded to a chat session.
   * @param {string} chatId
   */
  async list(chatId) {
    return await this._transport.request("GET", `/v1/chats/${chatId}/attachments`);
  }

  /**
   * Gets metadata for a specific attachment.
   * @param {string} chatId
   * @param {string} attachmentId
   */
  async get(chatId, attachmentId) {
    return await this._transport.request("GET", `/v1/chats/${chatId}/attachments/${attachmentId}`);
  }

  /**
   * Downloads raw attachment bytes from MinIO.
   * @param {string} chatId
   * @param {string} attachmentId
   * @returns {Promise<Uint8Array>}
   */
  async download(chatId, attachmentId) {
    return await this._transport.requestBinary("GET", `/v1/chats/${chatId}/attachments/${attachmentId}/download`);
  }

  /**
   * Deletes an attachment from MinIO and unpins it from the conversation.
   * @param {string} chatId
   * @param {string} attachmentId
   */
  async delete(chatId, attachmentId) {
    return await this._transport.request("DELETE", `/v1/chats/${chatId}/attachments/${attachmentId}`);
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
   * @param {Record<string, any>} [options.profile]
   */
  async create({ title = "New Chat", instructions = "", enableWebSearch = false, profile } = {}) {
    const chatProfile = profile || {
      instructions,
      enable_web_search: enableWebSearch,
    };
    return await this._transport.request("POST", "/v1/chats", {
      json: {
        title,
        profile: chatProfile,
      },
    });
  }

  /**
   * Lists existing chat threads.
   * @param {Object} [options]
   * @param {number} [options.limit]
   * @param {number} [options.offset]
   */
  async list({ limit = 50, offset = 0 } = {}) {
    return await this._transport.request("GET", "/v1/chats", {
      params: { limit, offset },
    });
  }

  /**
   * Fetches metadata for a single chat thread.
   * @param {string} chatId
   */
  async get(chatId) {
    return await this._transport.request("GET", `/v1/chats/${chatId}`);
  }

  /**
   * Updates title or system instructions for a chat thread.
   * @param {string} chatId
   * @param {Object} options
   * @param {string} [options.title]
   * @param {string} [options.instructions]
   * @param {boolean} [options.enableWebSearch]
   */
  async update(chatId, { title, instructions, enableWebSearch } = {}) {
    const json = {};
    if (title !== undefined) json.title = title;
    if (instructions !== undefined || enableWebSearch !== undefined) {
      json.profile = {};
      if (instructions !== undefined) json.profile.instructions = instructions;
      if (enableWebSearch !== undefined) json.profile.enable_web_search = enableWebSearch;
    }
    return await this._transport.request("PATCH", `/v1/chats/${chatId}`, { json });
  }

  /**
   * Deletes / archives a chat thread.
   * @param {string} chatId
   */
  async delete(chatId) {
    return await this._transport.request("DELETE", `/v1/chats/${chatId}`);
  }

  /**
   * Retrieves full chronological message history for a chat.
   * @param {string} chatId
   * @returns {Promise<Array<{ id: string, input_content: string, output_text: string, status: string }>>}
   */
  async messages(chatId) {
    return await this._transport.request("GET", `/v1/chats/${chatId}/messages`);
  }

  /**
   * Forks or branches a conversation thread from an existing turn.
   * @param {string} chatId
   * @param {Object} options
   * @param {string} options.sourceBranchId
   * @param {string} options.targetTurnId
   * @param {string} [options.action] - 'regenerate' or 'edit'
   * @param {string} [options.editedContent]
   */
  async createBranch(chatId, { sourceBranchId, targetTurnId, action = "regenerate", editedContent } = {}) {
    return await this._transport.request("POST", `/v1/chats/${chatId}/branches`, {
      json: {
        source_branch_id: sourceBranchId,
        target_turn_id: targetTurnId,
        action,
        edited_content: editedContent,
      },
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
   * Submits a multi-page document to the asynchronous processing queue (HTTP 202).
   * @param {string | Uint8Array | Blob | File} file
   * @param {Object} [options]
   * @param {string} [options.filename]
   * @param {string} [options.languages]
   * @param {string} [options.outputFormat]
   */
  async createJob(file, options = {}) {
    const { blob, filename } = await toBlob(file, options.filename || "document.pdf", "application/pdf");
    const formData = new FormData();
    formData.append("file", blob, filename);

    const params = {};
    if (options.languages) params.languages = options.languages;
    if (options.outputFormat) params.output_format = options.outputFormat;

    return await this._transport.postMultipart("/v1/ocr/jobs", formData, { params });
  }

  /**
   * Checks the progress of an asynchronous OCR job.
   * @param {string} jobId
   */
  async getJob(jobId) {
    return await this._transport.request("GET", `/v1/ocr/jobs/${jobId}`);
  }

  /**
   * Submits a document job and polls until completion.
   * @param {string | Uint8Array | Blob | File} fileOrJobId
   * @param {Object} [options]
   * @param {number} [options.pollInterval] - Polling interval in ms (default: 2000)
   * @param {number} [options.timeout] - Max wait time in ms (default: 300000)
   */
  async waitForJob(fileOrJobId, options = {}) {
    const pollInterval = options.pollInterval ?? 2000;
    const timeout = options.timeout ?? 300000;
    let jobId;

    if (typeof fileOrJobId === "string" && (fileOrJobId.startsWith("ocr_job_") || fileOrJobId.startsWith("job_"))) {
      jobId = fileOrJobId;
    } else if (fileOrJobId && typeof fileOrJobId === "object" && (fileOrJobId.job_id || fileOrJobId.id)) {
      jobId = fileOrJobId.job_id || fileOrJobId.id;
    } else {
      const jobRes = await this.createJob(fileOrJobId, options);
      jobId = jobRes.job_id || jobRes.id;
    }

    const startTime = Date.now();
    while (Date.now() - startTime < timeout) {
      const statusRes = await this.getJob(jobId);
      if (statusRes.status === "completed" || statusRes.status === "done" || statusRes.status === "SUCCESS") {
        return statusRes;
      }
      if (statusRes.status === "failed" || statusRes.status === "error" || statusRes.status === "FAILURE") {
        throw new Error(`OCR Job ${jobId} failed: ${statusRes.error || "Unknown error"}`);
      }
      await new Promise((r) => setTimeout(r, pollInterval));
    }
    throw new Error(`OCR Job ${jobId} timed out after ${timeout}ms.`);
  }
}

/**
 * Speech Recognition (ASR), YouTube Transcription & Live Streaming resource.
 */
class ASRResource {
  constructor(transport) {
    this._transport = transport;
  }

  /**
   * Transcribes an audio file (.wav, .mp3, .ogg, .flac, .webm, .m4a) synchronously.
   * @param {string | Uint8Array | Blob | File} file
   * @param {Object} [options]
   * @param {string} [options.filename]
   * @param {boolean} [options.diarize] - Enable speaker diarization
   */
  async transcribe(file, options = {}) {
    const { blob, filename } = await toBlob(file, options.filename || "audio.wav", "audio/wav");
    const formData = new FormData();
    formData.append("file", blob, filename);

    const data = {};
    if (options.diarize !== undefined) data.diarize = String(options.diarize);

    return await this._transport.postMultipart("/v1/asr/transcribe/offline", formData, {
      params: options.diarize !== undefined ? { diarize: options.diarize } : undefined,
    });
  }

  /**
   * Submits an audio file for asynchronous transcription (HTTP 202).
   * @param {string | Uint8Array | Blob | File} file
   * @param {Object} [options]
   * @param {string} [options.filename]
   * @param {boolean} [options.diarize]
   */
  async createJob(file, options = {}) {
    const { blob, filename } = await toBlob(file, options.filename || "audio.wav", "audio/wav");
    const formData = new FormData();
    formData.append("file", blob, filename);

    return await this._transport.postMultipart("/v1/asr/transcribe/offline/jobs", formData, {
      params: options.diarize !== undefined ? { diarize: options.diarize } : undefined,
    });
  }

  /**
   * Polls the status of an asynchronous ASR transcription job.
   * @param {string} jobId
   */
  async getJob(jobId) {
    return await this._transport.request("GET", `/v1/asr/jobs/${jobId}`);
  }

  /**
   * Submits an audio file and polls until transcription finishes.
   * @param {string | Uint8Array | Blob | File} fileOrJobId
   * @param {Object} [options]
   * @param {number} [options.pollInterval]
   * @param {number} [options.timeout]
   */
  async waitForJob(fileOrJobId, options = {}) {
    const pollInterval = options.pollInterval ?? 2000;
    const timeout = options.timeout ?? 300000;
    let jobId;

    if (typeof fileOrJobId === "string" && (fileOrJobId.startsWith("job_") || fileOrJobId.startsWith("asr_job_"))) {
      jobId = fileOrJobId;
    } else if (fileOrJobId && typeof fileOrJobId === "object" && (fileOrJobId.job_id || fileOrJobId.id)) {
      jobId = fileOrJobId.job_id || fileOrJobId.id;
    } else {
      const res = await this.createJob(fileOrJobId, options);
      jobId = res.job_id || res.id;
    }

    const startTime = Date.now();
    while (Date.now() - startTime < timeout) {
      const statusRes = await this.getJob(jobId);
      if (statusRes.status === "completed" || statusRes.status === "done" || statusRes.status === "SUCCESS") {
        return statusRes;
      }
      if (statusRes.status === "failed" || statusRes.status === "error" || statusRes.status === "FAILURE") {
        throw new Error(`ASR Job ${jobId} failed: ${statusRes.error || "Unknown error"}`);
      }
      await new Promise((r) => setTimeout(r, pollInterval));
    }
    throw new Error(`ASR Job ${jobId} timed out after ${timeout}ms.`);
  }

  /**
   * Transcribes audio directly from a YouTube video URL synchronously.
   * @param {Object} options
   * @param {string} options.url
   * @param {boolean} [options.includeAudio]
   * @param {boolean} [options.diarize]
   */
  async transcribeYoutube({ url, includeAudio = true, diarize = true } = {}) {
    return await this._transport.request("POST", "/v1/asr/transcribe/youtube", {
      json: { url, include_audio: includeAudio, diarize },
    });
  }

  /**
   * Submits a YouTube video URL for asynchronous transcription (HTTP 202).
   * @param {Object} options
   * @param {string} options.url
   * @param {boolean} [options.includeAudio]
   * @param {boolean} [options.diarize]
   */
  async createYoutubeJob({ url, includeAudio = true, diarize = true } = {}) {
    return await this._transport.request("POST", "/v1/asr/transcribe/youtube/jobs", {
      json: { url, include_audio: includeAudio, diarize },
    });
  }

  // --- Real-Time Streaming Lifecycle ---
  /**
   * Initiates a stateful live PCM16 speech recognition stream.
   * @param {Object} [options]
   * @param {number} [options.sampleRate] - Default 16000
   * @param {boolean} [options.diarizationEnabled]
   * @param {boolean} [options.revisionEnabled]
   */
  async createStream({ sampleRate = 16000, diarizationEnabled = false, revisionEnabled = false } = {}) {
    return await this._transport.request("POST", "/v1/asr/streams", {
      json: {
        sample_rate: sampleRate,
        diarization_enabled: diarizationEnabled,
        revision_enabled: revisionEnabled,
      },
      params: { sample_rate: sampleRate },
    });
  }

  /**
   * Submits raw 16kHz signed 16-bit little-endian mono PCM audio chunk.
   * @param {string} sessionId
   * @param {Uint8Array | Buffer} pcmBytes
   * @param {Object} [options]
   * @param {number} [options.sampleRate]
   * @param {number} [options.generation]
   * @param {number} [options.chunkSequence]
   */
  async streamChunkPcm(sessionId, pcmBytes, { sampleRate = 16000, generation = 0, chunkSequence = 0 } = {}) {
    return await this._transport.request("POST", `/v1/asr/streams/${sessionId}/chunk/pcm16`, {
      body: pcmBytes,
      headers: { "Content-Type": "application/octet-stream" },
      params: {
        sample_rate: sampleRate,
        generation,
        chunk_sequence: chunkSequence,
      },
    });
  }

  /**
   * Alias for streamChunkPcm.
   */
  async streamChunk(sessionId, pcmBytes, options) {
    return await this.streamChunkPcm(sessionId, pcmBytes, options);
  }

  /**
   * Finalizes the live streaming session and records usage.
   * @param {string} sessionId
   */
  async finishStream(sessionId) {
    return await this._transport.request("POST", `/v1/asr/streams/${sessionId}/finish`);
  }

  /**
   * Clears pending audio buffers and advances generation.
   * @param {string} sessionId
   */
  async clearStream(sessionId) {
    return await this._transport.request("POST", `/v1/asr/streams/${sessionId}/clear`);
  }

  /**
   * Keeps streaming session alive to avoid inactivity timeout.
   * @param {string} sessionId
   */
  async keepaliveStream(sessionId) {
    return await this._transport.request("POST", `/v1/asr/streams/${sessionId}/keepalive`);
  }

  /**
   * Aborts and destroys the streaming session.
   * @param {string} sessionId
   */
  async abortStream(sessionId) {
    return await this._transport.request("DELETE", `/v1/asr/streams/${sessionId}`);
  }
}

/**
 * Speech Synthesis (TTS) Higgs 3 resource.
 */
class TTSResource {
  constructor(transport) {
    this._transport = transport;
  }

  /**
   * Synthesizes Bengali text into full WAV audio bytes.
   * @param {Object} options
   * @param {string} options.text
   * @param {string} [options.voice] - Preset voice ('default', 'male', 'female')
   * @param {string} [options.voiceId] - Custom uploaded voice ID
   * @param {string} [options.responseFormat] - 'wav', 'mp3', 'flac', 'opus', 'aac', 'pcm'
   * @param {number} [options.firstSegmentMaxChars]
   * @returns {Promise<Uint8Array>}
   */
  async synthesize({ text, voice = "male", voiceId, responseFormat = "wav", firstSegmentMaxChars = 45 } = {}) {
    const json = {
      text,
      voice,
      response_format: responseFormat,
      first_segment_max_chars: firstSegmentMaxChars,
    };
    if (voiceId) json.voice_id = voiceId;

    return await this._transport.requestBinary("POST", "/v1/tts/simple", { json });
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
      return filePath;
    }
    throw new Error("synthesizeToFile is only supported in Node.js environments.");
  }

  /**
   * Streams 24 kHz 16-bit mono PCM audio chunks in real time.
   * @param {string} text
   * @param {Object} [options]
   * @param {string} [options.voice]
   * @param {string} [options.voiceId]
   * @param {number} [options.firstSegmentMaxChars]
   * @returns {AsyncGenerator<Uint8Array, void, unknown>}
   */
  async *streamPcm(text, { voice = "male", voiceId, firstSegmentMaxChars = 45 } = {}) {
    const json = {
      text,
      voice,
      first_segment_max_chars: firstSegmentMaxChars,
    };
    if (voiceId) json.voice_id = voiceId;

    yield* this._transport.requestRawStream("/v1/tts/simple/stream", { json });
  }

  /**
   * Advanced voice synthesis with zero-shot voice cloning, emotional controls, and speeds.
   * @param {Object} options
   * @param {string} options.input
   * @param {string} [options.voice]
   * @param {string} [options.voiceId]
   * @param {string} [options.model]
   * @param {number} [options.speed]
   * @param {string} [options.responseFormat]
   * @param {Object} [options.controls] - { emotion, style, sound_effect }
   * @param {Object} [options.customReference]
   * @returns {Promise<Uint8Array>}
   */
  async advanced({
    input,
    voice = "female",
    voiceId,
    model = "bosonai/higgs-tts-3-4b",
    speed = 1.0,
    responseFormat = "wav",
    controls,
    customReference,
  } = {}) {
    const json = {
      model,
      input,
      voice,
      speed,
      response_format: responseFormat,
      stream: false,
    };
    if (voiceId) json.voice_id = voiceId;
    if (controls) json.controls = controls;
    if (customReference) json.custom_reference = customReference;

    return await this._transport.requestBinary("POST", "/v1/tts/advanced", { json });
  }

  // --- Voice Profile Management ---
  /**
   * Uploads reference audio to clone a reusable voice profile.
   * @param {string | Uint8Array | Blob | File} file
   * @param {Object} [options]
   * @param {string} [options.name]
   * @param {string} [options.filename]
   */
  async createVoice(file, options = {}) {
    const { blob, filename } = await toBlob(file, options.filename || "voice_sample.wav", "audio/wav");
    const formData = new FormData();
    formData.append("file", blob, filename);
    if (options.name) formData.append("name", options.name);

    return await this._transport.postMultipart("/v1/tts/voices", formData);
  }

  /**
   * Fetches metadata for an uploaded custom voice profile.
   * @param {string} voiceId
   */
  async getVoice(voiceId) {
    return await this._transport.request("GET", `/v1/tts/voices/${voiceId}`);
  }

  /**
   * Deletes an uploaded custom voice profile.
   * @param {string} voiceId
   */
  async deleteVoice(voiceId) {
    return await this._transport.request("DELETE", `/v1/tts/voices/${voiceId}`);
  }

  // --- Asynchronous Synthesis Jobs ---
  /**
   * Submits text for asynchronous synthesis (HTTP 202).
   * @param {Object} options
   * @param {string} options.text
   * @param {string} [options.voice]
   * @param {string} [options.voiceId]
   * @param {string} [options.responseFormat]
   */
  async createJob({ text, voice = "default", voiceId, responseFormat = "wav" } = {}) {
    const json = { text, voice, response_format: responseFormat };
    if (voiceId) json.voice_id = voiceId;

    return await this._transport.request("POST", "/v1/tts/simple/jobs", { json });
  }

  /**
   * Polls the status and download metadata of an async synthesis job.
   * @param {string} jobId
   */
  async getJob(jobId) {
    return await this._transport.request("GET", `/v1/tts/jobs/${jobId}`);
  }

  /**
   * Downloads synthesized audio bytes for a completed job.
   * @param {string} jobId
   * @returns {Promise<Uint8Array>}
   */
  async downloadJob(jobId) {
    return await this._transport.requestBinary("GET", `/v1/tts/jobs/${jobId}/download`);
  }

  /**
   * Submits or waits for an async TTS job to finish, returning audio bytes.
   * @param {string | Object} textOrJob
   * @param {Object} [options]
   */
  async waitForJob(textOrJob, options = {}) {
    const pollInterval = options.pollInterval ?? 2000;
    const timeout = options.timeout ?? 300000;
    let jobId;

    if (typeof textOrJob === "string" && (textOrJob.startsWith("job_") || textOrJob.startsWith("tts_job_"))) {
      jobId = textOrJob;
    } else if (textOrJob && typeof textOrJob === "object" && (textOrJob.job_id || textOrJob.id)) {
      jobId = textOrJob.job_id || textOrJob.id;
    } else {
      const text = typeof textOrJob === "string" ? textOrJob : textOrJob?.text;
      const res = await this.createJob({ text, ...options });
      jobId = res.job_id || res.id;
    }

    const startTime = Date.now();
    while (Date.now() - startTime < timeout) {
      const statusRes = await this.getJob(jobId);
      if (statusRes.status === "completed" || statusRes.status === "done" || statusRes.status === "SUCCESS") {
        return await this.downloadJob(jobId);
      }
      if (statusRes.status === "failed" || statusRes.status === "error" || statusRes.status === "FAILURE") {
        throw new Error(`TTS Job ${jobId} failed: ${statusRes.error || "Unknown error"}`);
      }
      await new Promise((r) => setTimeout(r, pollInterval));
    }
    throw new Error(`TTS Job ${jobId} timed out after ${timeout}ms.`);
  }

  // --- Stateful REST Text Streaming Sessions ---
  /**
   * Creates a stateful session for incremental token-by-token synthesis.
   * @param {Object} [options]
   * @param {string} [options.voice]
   * @param {string} [options.voiceId]
   */
  async createSession({ voice = "default", voiceId } = {}) {
    const json = { voice };
    if (voiceId) json.voice_id = voiceId;

    return await this._transport.request("POST", "/v1/tts/sessions", { json });
  }

  /**
   * Feeds incremental text into the open streaming session.
   * @param {string} sessionId
   * @param {string} text
   */
  async sendSessionText(sessionId, text) {
    return await this._transport.request("POST", `/v1/tts/sessions/${sessionId}/text`, {
      json: { text },
    });
  }

  /**
   * Finalizes the session to produce concluding audio.
   * @param {string} sessionId
   */
  async finishSession(sessionId) {
    return await this._transport.request("POST", `/v1/tts/sessions/${sessionId}/finish`);
  }

  /**
   * Clears pending text in the session.
   * @param {string} sessionId
   */
  async clearSession(sessionId) {
    return await this._transport.request("POST", `/v1/tts/sessions/${sessionId}/clear`);
  }

  /**
   * Refreshes the session TTL timer.
   * @param {string} sessionId
   */
  async keepaliveSession(sessionId) {
    return await this._transport.request("POST", `/v1/tts/sessions/${sessionId}/keepalive`);
  }

  /**
   * Closes and cleans up the session.
   * @param {string} sessionId
   */
  async deleteSession(sessionId) {
    return await this._transport.request("DELETE", `/v1/tts/sessions/${sessionId}`);
  }

  // --- Discovery ---
  /**
   * Discovers available TTS models and preset voices.
   */
  async models() {
    return await this._transport.request("GET", "/v1/tts/models");
  }

  /**
   * Alias for models().
   */
  async listVoices() {
    return await this.models();
  }

  /**
   * Discovers gateway capabilities and supported formats.
   */
  async capabilities() {
    return await this._transport.request("GET", "/v1/capabilities");
  }

  /**
   * Inspects inference queue capacity and active load.
   */
  async queue() {
    return await this._transport.request("GET", "/v1/queue");
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
    this.auth = new AuthResource(this._transport);
    this.apiKeys = new ApiKeysResource(this._transport);
    this.wsTickets = new WsTicketsResource(this._transport);
    this.chats = new ChatsResource(this._transport);
    this.ocr = new OCRResource(this._transport);
    this.asr = new ASRResource(this._transport);
    this.tts = new TTSResource(this._transport);
    this.sts = new STSResource(this._transport);
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
}
