export interface ClientOptions {
  apiKey?: string;
  baseUrl?: string;
  timeout?: number;
  maxRetries?: number;
  headers?: Record<string, string>;
}

export interface UserProfile {
  id: string;
  email: string;
  display_name: string;
  role: string;
  plan: string;
  monthly_quota: number;
  created_at?: string;
  updated_at?: string;
}

export interface ApiKey {
  id: string;
  name: string;
  key_prefix: string;
  raw_api_key?: string;
  scopes: string[];
  rate_limit_tier?: string;
  allowed_ips?: string[];
  allowed_origins?: string[];
  is_active: boolean;
  expires_at?: string;
  created_at?: string;
  last_used_at?: string;
}

export interface WsTicket {
  ticket: string;
  target: string;
  ttl_seconds: number;
  expires_at: number;
}

export interface ChatSession {
  id: string;
  user_id: string;
  title: string;
  primary_service: string;
  is_archived: boolean;
  active_branch_id?: string;
  context_state?: Record<string, any>;
  metadata?: Record<string, any>;
  created_at?: string;
  updated_at?: string;
}

export interface Turn {
  id: string;
  user_id: string;
  chat_id?: string;
  branch_id?: string;
  service: string;
  input_modality: string;
  output_modality: string;
  input_content: string;
  input_attachment_ids?: string[];
  output_text: string;
  output_items?: Array<Record<string, any>>;
  usage?: Record<string, any>;
  status: string;
  error_code?: string;
  created_at?: string;
  completed_at?: string;
}

export interface ChatBranch {
  id: string;
  chat_id: string;
  parent_branch_id?: string;
  fork_after_turn_id?: string;
  created_at?: string;
}

export interface StreamChunk {
  event: string;
  text: string;
  data: any;
  raw?: string;
}

export interface ChatAttachment {
  id: string;
  chat_id: string;
  user_id: string;
  service: string;
  kind: string;
  filename: string;
  content_type: string;
  size_bytes: number;
  storage_key: string;
  is_attached: boolean;
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
  status: "queued" | "processing" | "completed" | "failed";
  status_url?: string;
  result?: OCRResult;
  error?: string;
}

export interface ASRResult {
  text: string;
  duration_seconds: number;
  processing_time_ms: number;
  segments?: Array<{
    start: number;
    end: number;
    text: string;
    speaker?: string;
  }>;
  speakers?: string[];
}

export interface YouTubeASRResult {
  title: string;
  channel?: string;
  duration_seconds: number;
  text: string;
  diarization_text?: string;
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

export interface StreamSession {
  session_id: string;
  sample_rate: number;
}

export interface ASRStreamChunk {
  transcript: string;
  partial_text: string;
  final_text?: string;
  final_words?: Array<Record<string, any>>;
  event: string;
  turn_id?: string;
}

export interface TTSDiscovery {
  speakers?: string[];
  emotions?: string[];
  formats?: string[];
  models?: string[];
  voices?: string[];
  default_voice?: string;
  sample_rate?: number;
}

export class MeResource {
  get(): Promise<UserProfile>;
  update(options: { displayName: string }): Promise<UserProfile>;
}

export class ApiKeysResource {
  list(): Promise<ApiKey[]>;
  create(options: {
    name: string;
    scopes?: string[];
    rateLimitTier?: string;
    rate_limit_tier?: string;
    allowedIps?: string[];
    allowed_ips?: string[];
    allowedOrigins?: string[];
    allowed_origins?: string[];
    expiresInDays?: number;
    expires_in_days?: number;
  }): Promise<ApiKey>;
  delete(keyId: string): Promise<void>;
}

export class WsTicketsResource {
  create(options?: { target?: string; streamSessionId?: string }): Promise<WsTicket>;
}

export class ChatTurnsResource {
  stream(chatId: string, options: { content: string; attachmentIds?: string[]; branchId?: string }): AsyncGenerator<StreamChunk, void, unknown>;
  create(chatId: string, options: { content: string; attachmentIds?: string[]; branchId?: string }): Promise<string>;
  cancel(chatId: string, turnId: string): Promise<any>;
}

export class ChatAttachmentsResource {
  upload(chatId: string, file: string | Uint8Array | Blob | File, options?: { filename?: string; contentType?: string }): Promise<ChatAttachment>;
  list(chatId: string): Promise<ChatAttachment[]>;
  get(chatId: string, attachmentId: string): Promise<ChatAttachment>;
  delete(chatId: string, attachmentId: string): Promise<void>;
  download(chatId: string, attachmentId: string): Promise<Uint8Array>;
}

export class ChatsResource {
  readonly turns: ChatTurnsResource;
  readonly attachments: ChatAttachmentsResource;

  create(options?: {
    title?: string;
    instructions?: string;
    enableWebSearch?: boolean;
    enable_web_search?: boolean;
    customToolNames?: string[];
    custom_tool_names?: string[];
    profile?: Record<string, any>;
    primaryService?: string;
    metadata?: Record<string, any>;
  }): Promise<ChatSession>;
  list(options?: { limit?: number; offset?: number; includeArchived?: boolean }): Promise<ChatSession[]>;
  get(chatId: string): Promise<ChatSession>;
  update(chatId: string, options?: {
    title?: string;
    isArchived?: boolean;
    is_archived?: boolean;
    contextState?: Record<string, any>;
    context_state?: Record<string, any>;
  }): Promise<ChatSession>;
  delete(chatId: string): Promise<void>;
  messages(chatId: string, options?: { branchId?: string; branch_id?: string }): Promise<Turn[]>;
  createBranch(chatId: string, options: {
    sourceBranchId?: string;
    source_branch_id?: string;
    action?: string;
    targetTurnId?: string;
    target_turn_id?: string;
    editedContent?: string;
    edited_content?: string;
  }): Promise<ChatSession>;
}

export class OCRResource {
  process(file: string | Uint8Array | Blob | File, options?: { filename?: string; languages?: string; outputFormat?: string }): Promise<OCRResult>;
  createJob(file: string | Uint8Array | Blob | File, options?: { filename?: string; languages?: string }): Promise<OCRJob>;
  getJob(jobId: string): Promise<OCRJob>;
  waitForJob(file: string | Uint8Array | Blob | File, options?: { filename?: string; languages?: string; pollInterval?: number; timeout?: number }): Promise<OCRJob>;
}

export class ASRResource {
  transcribe(file: string | Uint8Array | Blob | File, options?: { filename?: string; diarize?: boolean }): Promise<ASRResult>;
  transcribeYoutube(options: { url: string; diarize?: boolean; includeAudio?: boolean }): Promise<YouTubeASRResult>;
  createStream(options?: { sampleRate?: number; sample_rate?: number }): Promise<StreamSession>;
  streamChunk(sessionId: string, pcmBytes: Uint8Array | Buffer, options?: { sampleRate?: number; sample_rate?: number; generation?: number; chunkSequence?: number; chunk_sequence?: number }): Promise<ASRStreamChunk>;
  finishStream(sessionId: string): Promise<Record<string, any>>;
  abortStream(sessionId: string): Promise<void>;
}

export class TTSResource {
  synthesize(options: { text: string; voice?: string; emotion?: string; speed?: number; format?: string; firstSegmentMaxChars?: number }): Promise<Uint8Array>;
  synthesizeToFile(text: string, filePath: string, options?: { voice?: string; emotion?: string; speed?: number; format?: string; firstSegmentMaxChars?: number }): Promise<void>;
  streamPcm(text: string, options?: { voice?: string; emotion?: string; speed?: number; firstSegmentMaxChars?: number }): AsyncGenerator<Uint8Array, void, unknown>;
  advanced(options: { input: string; referenceAudio?: Record<string, any>; voice?: string; speed?: number }): Promise<Uint8Array>;
  models(): Promise<TTSDiscovery>;
  listVoices(): Promise<TTSDiscovery>;
}

export class STSResource {
  uploadVoiceReference(file: string | Uint8Array | Blob | File, options?: { filename?: string }): Promise<VoiceReference>;
  getLiveKitToken(options?: { voice?: string; referenceId?: string; phoneNumber?: string; mode?: string; tenantId?: string; customerId?: string; roomName?: string; participantName?: string }): Promise<LiveKitToken>;
  createToken(options?: { voice?: string; referenceId?: string; phoneNumber?: string; mode?: string; tenantId?: string; customerId?: string; roomName?: string; participantName?: string }): Promise<LiveKitToken>;
}

export class BanglaAI {
  constructor(config?: ClientOptions);
  readonly me: MeResource;
  readonly apiKeys: ApiKeysResource;
  readonly api_keys: ApiKeysResource;
  readonly wsTickets: WsTicketsResource;
  readonly ws_tickets: WsTicketsResource;
  readonly chats: ChatsResource;
  readonly ocr: OCRResource;
  readonly asr: ASRResource;
  readonly tts: TTSResource;
  readonly sts: STSResource;

  health(): Promise<{ status: string; service: string; version: string }>;
  ready(): Promise<{ status: string; timestamp: number; checks: Record<string, string> }>;
  close(): void;
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
