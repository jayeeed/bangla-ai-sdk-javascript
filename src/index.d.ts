export interface ClientOptions {
  apiKey?: string;
  baseUrl?: string;
  timeout?: number;
  maxRetries?: number;
  headers?: Record<string, string>;
}

export interface UserProfile {
  id: string;
  email?: string;
  display_name?: string;
  avatar_url?: string;
  role: string;
  plan: string;
  is_active?: boolean;
  preferences?: Record<string, any>;
  monthly_quota?: number;
  created_at?: string;
  updated_at?: string;
}

export interface GoogleAuthSyncResponse {
  status: string;
  user?: UserProfile;
  synced: boolean;
  provider: string;
  tier: string;
  scopes: string[];
}

export interface ApiKey {
  id: string;
  name: string;
  key_prefix: string;
  raw_api_key?: string;
  scopes: string[];
  is_active: boolean;
  rate_limit_tier?: string;
  expires_at?: string;
  created_at?: string;
}

export interface WsTicket {
  ticket: string;
  target: string;
  stream_session_id?: string;
  ttl_seconds: number;
  expires_at?: string | number;
}

export interface ChatSession {
  id: string;
  user_id?: string;
  title: string;
  primary_service?: string;
  is_archived?: boolean;
  active_branch_id?: string;
  context_state?: Record<string, any>;
  created_at?: string;
  updated_at?: string;
}

export interface ChatTurn {
  id: string;
  user_id?: string;
  chat_id?: string;
  branch_id?: string;
  input_content: string;
  output_text: string;
  status: string;
  created_at?: string;
  completed_at?: string;
}

export interface StreamChunk {
  event: string;
  text: string;
  turn_id?: string;
  branch_id?: string;
  data: any;
  raw?: string;
}

export interface ChatAttachment {
  id: string;
  chat_id?: string;
  user_id?: string;
  service?: string;
  kind?: string;
  filename: string;
  content_type: string;
  size_bytes: number;
  storage_key?: string;
  download_url?: string;
  is_attached?: boolean;
  created_at?: string;
}

export interface OCRRegion {
  label: string;
  box_2d: number[];
  text: string;
  score?: number;
}

export interface OCRPage {
  page_number: number;
  width: number;
  height: number;
  markdown: string;
  regions: OCRRegion[];
}

export interface OCRResult {
  markdown: string;
  pages: OCRPage[];
  timing?: {
    total_elapsed_ms: number;
  };
}

export interface OCRJob {
  job_id: string;
  status: "queued" | "processing" | "completed" | "failed" | string;
  status_url?: string;
  result?: OCRResult;
  error?: string;
}

export interface ASRResult {
  text: string;
  mode?: string;
  status?: string;
  duration_seconds?: number;
  processing_time_ms?: number;
  diarization?: Array<Record<string, any>>;
  diarization_text?: string;
  diarization_enabled?: boolean;
}

export interface ASRJobAccepted {
  job_id: string;
  status: string;
  status_url: string;
}

export interface ASRJobStatus {
  job_id: string;
  status: string;
  created_at?: string;
  completed_at?: string;
  error?: string;
  result?: Record<string, any>;
}

export interface YouTubeASRResult {
  title?: string;
  duration_seconds?: number;
  source_url: string;
  audio_download_url?: string;
  text: string;
  diarization?: Array<Record<string, any>>;
  diarization_text?: string;
}

export interface StreamSession {
  session_id: string;
  sample_rate: number;
  generation?: number;
  processing?: boolean;
  done?: boolean;
}

export interface LiveKitToken {
  url: string;
  token: string;
  room: string;
  readonly roomName: string;
  readonly livekitUrl: string;
}

export interface VoiceReference {
  reference_id: string;
  transcript?: string;
}

export interface TTSDiscovery {
  models: string[];
  voices: string[];
  speakers?: string[];
  default_voice: string;
  sample_rate: number;
  response_formats?: string[];
}

export interface TTSCapabilities {
  object: string;
  model: string;
  backend_contract?: string;
  response_formats: string[];
  speaking_speed: string[];
  streaming: boolean;
  rest_text_sessions: boolean;
  voice_cloning: boolean;
}

export interface TTSQueueStatus {
  object: string;
  active: number;
  queued: number;
  capacity: number;
  available: number;
}

export interface TTSVoiceUploadResponse {
  voice_id: string;
  status: string;
  reference_text?: string;
  duration_seconds?: number;
}

export interface TTSSessionResponse {
  object: string;
  session_id: string;
  status: string;
  text_url?: string;
  finish_url?: string;
  audio_format?: string;
  sample_rate?: number;
}

export interface TTSJobAccepted {
  job_id: string;
  status: string;
  status_url: string;
}

export interface TTSJobStatus {
  job_id: string;
  status: string;
  created_at?: string;
  completed_at?: string;
  error?: string;
  download_url?: string;
  size_bytes?: number;
  format?: string;
}

export class MeResource {
  get(): Promise<UserProfile>;
  update(options: { displayName?: string; avatarUrl?: string; preferences?: Record<string, any> }): Promise<UserProfile>;
}

export class AuthResource {
  syncGoogle(options?: { idToken?: string; token?: string; provider?: string }): Promise<GoogleAuthSyncResponse>;
}

export class ApiKeysResource {
  list(): Promise<ApiKey[]>;
  create(options: { name: string; scopes?: string[]; expiresInDays?: number }): Promise<ApiKey>;
  delete(keyId: string): Promise<void>;
}

export class WsTicketsResource {
  create(options?: { target?: string; streamSessionId?: string }): Promise<WsTicket>;
}

export class ChatTurnsResource {
  stream(chatId: string, options: { content: string; attachmentIds?: string[]; branchId?: string; idempotencyKey?: string }): AsyncGenerator<StreamChunk, void, unknown>;
  create(chatId: string, options: { content: string; attachmentIds?: string[]; branchId?: string; idempotencyKey?: string }): Promise<string & { content: string; text: string; turnId?: string }>;
  cancel(chatId: string, turnId: string): Promise<any>;
}

export class ChatAttachmentsResource {
  upload(chatId: string, file: string | Uint8Array | Blob | File, options?: { filename?: string; contentType?: string }): Promise<ChatAttachment>;
  list(chatId: string): Promise<ChatAttachment[]>;
  get(chatId: string, attachmentId: string): Promise<ChatAttachment>;
  download(chatId: string, attachmentId: string): Promise<Uint8Array>;
  delete(chatId: string, attachmentId: string): Promise<void>;
}

export class ChatsResource {
  readonly turns: ChatTurnsResource;
  readonly attachments: ChatAttachmentsResource;

  create(options?: { title?: string; instructions?: string; enableWebSearch?: boolean; profile?: Record<string, any> }): Promise<ChatSession>;
  list(options?: { limit?: number; offset?: number }): Promise<ChatSession[]>;
  get(chatId: string): Promise<ChatSession>;
  update(chatId: string, options?: { title?: string; instructions?: string; enableWebSearch?: boolean }): Promise<ChatSession>;
  delete(chatId: string): Promise<void>;
  messages(chatId: string): Promise<ChatTurn[]>;
  createBranch(chatId: string, options: { sourceBranchId: string; targetTurnId: string; action?: string; editedContent?: string }): Promise<ChatSession>;
}

export class OCRResource {
  process(file: string | Uint8Array | Blob | File, options?: { filename?: string; languages?: string; outputFormat?: string }): Promise<OCRResult>;
  createJob(file: string | Uint8Array | Blob | File, options?: { filename?: string; languages?: string; outputFormat?: string }): Promise<OCRJob>;
  getJob(jobId: string): Promise<OCRJob>;
  waitForJob(fileOrJobId: string | Uint8Array | Blob | File | OCRJob, options?: { filename?: string; languages?: string; outputFormat?: string; pollInterval?: number; timeout?: number }): Promise<OCRJob>;
}

export class ASRResource {
  transcribe(file: string | Uint8Array | Blob | File, options?: { filename?: string; diarize?: boolean }): Promise<ASRResult>;
  createJob(file: string | Uint8Array | Blob | File, options?: { filename?: string; diarize?: boolean }): Promise<ASRJobAccepted>;
  getJob(jobId: string): Promise<ASRJobStatus>;
  waitForJob(fileOrJobId: string | Uint8Array | Blob | File | ASRJobAccepted, options?: { filename?: string; diarize?: boolean; pollInterval?: number; timeout?: number }): Promise<ASRJobStatus>;
  transcribeYoutube(options: { url: string; includeAudio?: boolean; diarize?: boolean }): Promise<YouTubeASRResult>;
  createYoutubeJob(options: { url: string; includeAudio?: boolean; diarize?: boolean }): Promise<ASRJobAccepted>;
  createStream(options?: { sampleRate?: number; diarizationEnabled?: boolean; revisionEnabled?: boolean }): Promise<StreamSession>;
  streamChunkPcm(sessionId: string, pcmBytes: Uint8Array, options?: { sampleRate?: number; generation?: number; chunkSequence?: number }): Promise<any>;
  streamChunk(sessionId: string, pcmBytes: Uint8Array, options?: { sampleRate?: number; generation?: number; chunkSequence?: number }): Promise<any>;
  finishStream(sessionId: string): Promise<any>;
  clearStream(sessionId: string): Promise<any>;
  keepaliveStream(sessionId: string): Promise<any>;
  abortStream(sessionId: string): Promise<void>;
}

export class TTSResource {
  synthesize(options: { text: string; voice?: string; voiceId?: string; responseFormat?: string; firstSegmentMaxChars?: number }): Promise<Uint8Array>;
  synthesizeToFile(text: string, filePath: string, options?: { voice?: string; voiceId?: string; responseFormat?: string; firstSegmentMaxChars?: number }): Promise<string>;
  streamPcm(text: string, options?: { voice?: string; voiceId?: string; firstSegmentMaxChars?: number }): AsyncGenerator<Uint8Array, void, unknown>;
  advanced(options: { input: string; voice?: string; voiceId?: string; model?: string; speed?: number; responseFormat?: string; controls?: any; customReference?: any }): Promise<Uint8Array>;
  createVoice(file: string | Uint8Array | Blob | File, options?: { name?: string; filename?: string }): Promise<TTSVoiceUploadResponse>;
  getVoice(voiceId: string): Promise<any>;
  deleteVoice(voiceId: string): Promise<void>;
  createJob(options: { text: string; voice?: string; voiceId?: string; responseFormat?: string }): Promise<TTSJobAccepted>;
  getJob(jobId: string): Promise<TTSJobStatus>;
  downloadJob(jobId: string): Promise<Uint8Array>;
  waitForJob(textOrJob: string | TTSJobAccepted, options?: { voice?: string; voiceId?: string; responseFormat?: string; pollInterval?: number; timeout?: number }): Promise<Uint8Array>;
  createSession(options?: { voice?: string; voiceId?: string }): Promise<TTSSessionResponse>;
  sendSessionText(sessionId: string, text: string): Promise<any>;
  finishSession(sessionId: string): Promise<any>;
  clearSession(sessionId: string): Promise<any>;
  keepaliveSession(sessionId: string): Promise<any>;
  deleteSession(sessionId: string): Promise<void>;
  models(): Promise<TTSDiscovery>;
  listVoices(): Promise<TTSDiscovery>;
  capabilities(): Promise<TTSCapabilities>;
  queue(): Promise<TTSQueueStatus>;
}

export class STSResource {
  uploadVoiceReference(file: string | Uint8Array | Blob | File, options?: { filename?: string }): Promise<VoiceReference>;
  getLiveKitToken(options?: { voice?: string; referenceId?: string; phoneNumber?: string; mode?: string; tenantId?: string; customerId?: string; roomName?: string; participantName?: string }): Promise<LiveKitToken>;
  createToken(options?: { voice?: string; referenceId?: string; phoneNumber?: string; mode?: string; tenantId?: string; customerId?: string; roomName?: string; participantName?: string }): Promise<LiveKitToken>;
}

export class BanglaAI {
  constructor(config?: ClientOptions);
  readonly me: MeResource;
  readonly auth: AuthResource;
  readonly apiKeys: ApiKeysResource;
  readonly wsTickets: WsTicketsResource;
  readonly chats: ChatsResource;
  readonly ocr: OCRResource;
  readonly asr: ASRResource;
  readonly tts: TTSResource;
  readonly sts: STSResource;

  health(): Promise<{ status: string; service: string; version: string }>;
  ready(): Promise<{ status: string; timestamp: number; checks: Record<string, string> }>;
}

export default BanglaAI;

export class BanglaAIError extends Error {}
export class APIConnectionError extends BanglaAIError {}
export class APIStatusError extends BanglaAIError {
  statusCode: number;
  code: string;
  requestId?: string;
  responseBody: any;
}
export class BadRequestError extends APIStatusError {}
export class AuthenticationError extends APIStatusError {}
export class PermissionDeniedError extends APIStatusError {}
export class NotFoundError extends APIStatusError {}
export class RateLimitError extends APIStatusError {
  retryAfter?: number | null;
}
export class InternalServerError extends APIStatusError {}
export class UpstreamServiceError extends APIStatusError {}
export class ServiceUnavailableError extends APIStatusError {
  retryAfter?: number | null;
}

export const DEFAULT_BASE_URL: string;
export const DEFAULT_MAX_RETRIES: number;
export const DEFAULT_TIMEOUT: number;
export const USER_AGENT: string;
export const VERSION: string;
