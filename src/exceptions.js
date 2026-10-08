/**
 * Base exception for all Bangla AI Gateway errors.
 */
export class BanglaAIError extends Error {
  constructor(message) {
    super(message);
    this.name = "BanglaAIError";
  }
}

/**
 * Raised when an HTTP connection to the gateway cannot be established.
 */
export class APIConnectionError extends BanglaAIError {
  constructor(message, cause) {
    super(message);
    this.name = "APIConnectionError";
    this.cause = cause;
  }
}

/**
 * Raised when the gateway returns a non-2xx status code.
 */
export class APIStatusError extends BanglaAIError {
  constructor(message, { statusCode, code = "UNKNOWN_ERROR", requestId, responseBody = {} } = {}) {
    super(message || `API error with status ${statusCode}`);
    this.name = "APIStatusError";
    this.statusCode = statusCode;
    this.code = code;
    this.requestId = requestId;
    this.responseBody = responseBody;
  }
}

/**
 * Raised on 400 Bad Request.
 */
export class BadRequestError extends APIStatusError {
  constructor(message, options = {}) {
    super(message, { ...options, statusCode: 400 });
    this.name = "BadRequestError";
  }
}

/**
 * Raised on 401 Unauthorized (missing or invalid API key / token).
 */
export class AuthenticationError extends APIStatusError {
  constructor(message, options = {}) {
    super(message, { ...options, statusCode: 401 });
    this.name = "AuthenticationError";
  }
}

/**
 * Raised on 403 Forbidden (insufficient scope or permission denied).
 */
export class PermissionDeniedError extends APIStatusError {
  constructor(message, options = {}) {
    super(message, { ...options, statusCode: 403 });
    this.name = "PermissionDeniedError";
  }
}

/**
 * Raised on 404 Not Found.
 */
export class NotFoundError extends APIStatusError {
  constructor(message, options = {}) {
    super(message, { ...options, statusCode: 404 });
    this.name = "NotFoundError";
  }
}

/**
 * Raised on 429 Too Many Requests (rate limit or concurrency exceeded).
 */
export class RateLimitError extends APIStatusError {
  constructor(message, options = {}) {
    super(message, { ...options, statusCode: 429 });
    this.name = "RateLimitError";
    this.retryAfter = options.retryAfter ?? null;
  }
}

/**
 * Raised on 500 Internal Server Error.
 */
export class InternalServerError extends APIStatusError {
  constructor(message, options = {}) {
    super(message, { ...options, statusCode: 500 });
    this.name = "InternalServerError";
  }
}

/**
 * Raised on 502 Bad Gateway (upstream GPU microservice failed or returned invalid response).
 */
export class UpstreamServiceError extends APIStatusError {
  constructor(message, options = {}) {
    super(message, { ...options, statusCode: 502 });
    this.name = "UpstreamServiceError";
  }
}

/**
 * Raised on 503 Service Unavailable (queue full or upstream temporarily unavailable).
 */
export class ServiceUnavailableError extends APIStatusError {
  constructor(message, options = {}) {
    super(message, { ...options, statusCode: 503 });
    this.name = "ServiceUnavailableError";
    this.retryAfter = options.retryAfter ?? null;
  }
}
