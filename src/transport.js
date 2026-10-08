import { DEFAULT_BASE_URL, DEFAULT_MAX_RETRIES, DEFAULT_TIMEOUT, USER_AGENT } from "./constants.js";
import {
  APIConnectionError,
  APIStatusError,
  AuthenticationError,
  BadRequestError,
  InternalServerError,
  NotFoundError,
  PermissionDeniedError,
  RateLimitError,
  ServiceUnavailableError,
  UpstreamServiceError,
} from "./exceptions.js";
import { createLogger } from "./logger.js";

const logger = createLogger("transport");

/**
 * Parses RFC 7807 problem details or standard error payloads and throws typed exceptions.
 * @param {Response} response
 */
async function handleErrorResponse(response) {
  const status = response.status;
  if (status < 400) return;

  const requestId = response.headers.get("x-request-id") || undefined;
  const retryAfterHeader = response.headers.get("retry-after");
  const retryAfter = retryAfterHeader ? parseInt(retryAfterHeader, 10) : undefined;

  let code = "UNKNOWN_ERROR";
  let detail = "";
  let responseBody = {};

  try {
    const text = await response.text();
    try {
      responseBody = JSON.parse(text);
      if (responseBody && typeof responseBody === "object") {
        code = responseBody.code || code;
        detail = responseBody.detail || responseBody.message || text;
      }
    } catch {
      detail = text;
    }
  } catch (e) {
    detail = response.statusText || `HTTP Error ${status}`;
  }

  const errorOptions = {
    statusCode: status,
    code,
    requestId,
    retryAfter,
    responseBody,
  };

  switch (status) {
    case 400:
      throw new BadRequestError(detail, errorOptions);
    case 401:
      throw new AuthenticationError(detail, errorOptions);
    case 403:
      throw new PermissionDeniedError(detail, errorOptions);
    case 404:
      throw new NotFoundError(detail, errorOptions);
    case 429:
      throw new RateLimitError(detail, errorOptions);
    case 500:
      throw new InternalServerError(detail, errorOptions);
    case 502:
      throw new UpstreamServiceError(detail, errorOptions);
    case 503:
      throw new ServiceUnavailableError(detail, errorOptions);
    default:
      throw new APIStatusError(detail, errorOptions);
  }
}

/**
 * HTTP Transport Client using standard Fetch API (Node.js 18+, Browsers, Bun, Deno).
 */
export class Transport {
  /**
   * @param {Object} [config]
   * @param {string} [config.apiKey]
   * @param {string} [config.baseUrl]
   * @param {number} [config.timeout]
   * @param {number} [config.maxRetries]
   * @param {Record<string, string>} [config.headers]
   */
  constructor(config = {}) {
    const envApiKey = typeof process !== "undefined" ? process.env?.BANGLA_AI_API_KEY : undefined;
    const envBaseUrl = typeof process !== "undefined" ? process.env?.BANGLA_AI_BASE_URL : undefined;

    this.apiKey = config.apiKey || envApiKey || null;
    this.baseUrl = (config.baseUrl || envBaseUrl || DEFAULT_BASE_URL).replace(/\/+$/, "");
    this.timeout = config.timeout ?? DEFAULT_TIMEOUT;
    this.maxRetries = config.maxRetries ?? DEFAULT_MAX_RETRIES;
    this.customHeaders = config.headers || {};
  }

  /**
   * Builds request headers including auth tokens and User-Agent.
   * @param {Record<string, string>} [extraHeaders]
   * @returns {Record<string, string>}
   */
  getHeaders(extraHeaders = {}) {
    const headers = {
      "User-Agent": USER_AGENT,
      Accept: "application/json",
      ...this.customHeaders,
      ...extraHeaders,
    };

    if (this.apiKey) {
      headers["Authorization"] = `Bearer ${this.apiKey}`;
      headers["X-API-Key"] = this.apiKey;
    }

    return headers;
  }

  /**
   * Builds a full URL with query parameters.
   * @param {string} path
   * @param {Record<string, any>} [params]
   * @returns {string}
   */
  buildUrl(path, params) {
    const fullUrl = path.startsWith("http://") || path.startsWith("https://")
      ? path
      : `${this.baseUrl}${path.startsWith("/") ? "" : "/"}${path}`;

    if (!params || Object.keys(params).length === 0) {
      return fullUrl;
    }

    const url = new URL(fullUrl);
    for (const [key, val] of Object.entries(params)) {
      if (val !== undefined && val !== null) {
        url.searchParams.set(key, String(val));
      }
    }
    return url.toString();
  }

  /**
   * Performs an HTTP request with automatic retries on 429 and 503.
   * @param {string} method
   * @param {string} path
   * @param {Object} [options]
   * @param {any} [options.json]
   * @param {Record<string, any>} [options.params]
   * @param {Record<string, string>} [options.headers]
   * @param {AbortSignal} [options.signal]
   * @returns {Promise<any>}
   */
  async request(method, path, options = {}) {
    const url = this.buildUrl(path, options.params);
    let retries = 0;

    while (true) {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.timeout);

      // Link external signal if provided
      if (options.signal) {
        options.signal.addEventListener("abort", () => controller.abort());
      }

      const headers = this.getHeaders(options.headers);
      let body = undefined;

      if (options.json !== undefined) {
        headers["Content-Type"] = "application/json";
        body = JSON.stringify(options.json);
      }

      try {
        const response = await fetch(url, {
          method,
          headers,
          body,
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        // Check if retryable error
        if ((response.status === 429 || response.status === 503) && retries < this.maxRetries) {
          retries++;
          const retryAfterHeader = response.headers.get("retry-after");
          const delaySec = retryAfterHeader ? parseFloat(retryAfterHeader) : Math.pow(2, retries) * 0.5;
          logger.warn(`Request failed with HTTP ${response.status}. Retrying in ${delaySec}s (attempt ${retries}/${this.maxRetries})...`);
          await new Promise((resolve) => setTimeout(resolve, delaySec * 1000));
          continue;
        }

        if (!response.ok) {
          await handleErrorResponse(response);
        }

        if (response.status === 204) {
          return null;
        }

        const contentType = response.headers.get("content-type") || "";
        if (contentType.includes("application/json")) {
          return await response.json();
        }
        return await response.text();
      } catch (err) {
        clearTimeout(timeoutId);

        if (err instanceof APIStatusError) {
          throw err;
        }

        if (retries < this.maxRetries && err.name !== "AbortError") {
          retries++;
          const delaySec = Math.pow(2, retries) * 0.5;
          logger.warn(`Network connection error (${err.message}). Retrying in ${delaySec}s...`);
          await new Promise((resolve) => setTimeout(resolve, delaySec * 1000));
          continue;
        }

        throw new APIConnectionError(`Failed to connect to gateway at ${url}: ${err.message}`, err);
      }
    }
  }

  /**
   * Executes a multipart/form-data upload.
   * @param {string} path
   * @param {FormData} formData
   * @param {Object} [options]
   * @returns {Promise<any>}
   */
  async postMultipart(path, formData, options = {}) {
    const url = this.buildUrl(path, options.params);
    const headers = this.getHeaders(options.headers);
    // Note: Do NOT set Content-Type header so the runtime generates the multipart boundary automatically
    delete headers["Content-Type"];

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    try {
      const response = await fetch(url, {
        method: "POST",
        headers,
        body: formData,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        await handleErrorResponse(response);
      }

      const contentType = response.headers.get("content-type") || "";
      if (contentType.includes("application/json")) {
        return await response.json();
      }
      return await response.text();
    } catch (err) {
      clearTimeout(timeoutId);
      if (err instanceof APIStatusError) throw err;
      throw new APIConnectionError(`Multipart upload failed to ${url}: ${err.message}`, err);
    }
  }

  /**
   * Fetches binary content (audio, PDF, etc.).
   * @param {string} method
   * @param {string} path
   * @param {Object} [options]
   * @returns {Promise<Uint8Array>}
   */
  async requestBinary(method, path, options = {}) {
    const url = this.buildUrl(path, options.params);
    const headers = this.getHeaders(options.headers);
    headers["Accept"] = "*/*";

    let body = undefined;
    if (options.json !== undefined) {
      headers["Content-Type"] = "application/json";
      body = JSON.stringify(options.json);
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    try {
      const response = await fetch(url, {
        method,
        headers,
        body,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        await handleErrorResponse(response);
      }

      const buffer = await response.arrayBuffer();
      return new Uint8Array(buffer);
    } catch (err) {
      clearTimeout(timeoutId);
      if (err instanceof APIStatusError) throw err;
      throw new APIConnectionError(`Binary request failed to ${url}: ${err.message}`, err);
    }
  }

  /**
   * Consumes a Server-Sent Events (SSE) stream and yields events as an async generator.
   * @param {string} path
   * @param {Object} [options]
   * @param {any} [options.json]
   * @param {Record<string, any>} [options.params]
   * @param {Record<string, string>} [options.headers]
   * @returns {AsyncGenerator<{ event: string, data: any, text: string, raw: string }, void, unknown>}
   */
  async *requestStream(path, options = {}) {
    const url = this.buildUrl(path, options.params);
    const headers = this.getHeaders(options.headers);
    headers["Accept"] = "text/event-stream";
    headers["Cache-Control"] = "no-cache";

    let body = undefined;
    if (options.json !== undefined) {
      headers["Content-Type"] = "application/json";
      body = JSON.stringify(options.json);
    }

    const controller = new AbortController();
    if (options.signal) {
      options.signal.addEventListener("abort", () => controller.abort());
    }

    let response;
    try {
      response = await fetch(url, {
        method: "POST",
        headers,
        body,
        signal: controller.signal,
      });
    } catch (err) {
      throw new APIConnectionError(`Stream connection failed to ${url}: ${err.message}`, err);
    }

    if (!response.ok) {
      await handleErrorResponse(response);
    }

    if (!response.body) {
      throw new APIConnectionError("Streaming response has no readable body stream.");
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder("utf-8");
    let buffer = "";

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        // Normalize CRLF to LF for robust cross-platform parsing
        const normalized = buffer.replace(/\r\n/g, "\n");
        const parts = normalized.split("\n\n");
        buffer = parts.pop() || "";

        for (const message of parts) {
          if (!message.trim()) continue;

          let eventName = "message";
          let dataLines = [];
          let hasData = false;

          const lines = message.split("\n");
          for (const line of lines) {
            const trimmed = line.trim();
            if (trimmed.startsWith(":")) {
              continue; // SSE heartbeat comment
            }
            if (trimmed.startsWith("event:")) {
              eventName = trimmed.slice(6).trim();
            } else if (trimmed.startsWith("data:")) {
              hasData = true;
              dataLines.push(trimmed.slice(5).trim());
            }
          }

          if (!hasData && eventName === "message") {
            continue;
          }

          const rawData = dataLines.join("\n");
          let parsedData = rawData;
          try {
            parsedData = JSON.parse(rawData);
          } catch {
            // Keep as string if not JSON
          }

          const textChunk = typeof parsedData === "object" && parsedData !== null
            ? (parsedData.text || "")
            : "";

          yield {
            event: eventName,
            data: parsedData,
            text: textChunk,
            raw: rawData,
          };

          if (eventName === "turn_completed") {
            return;
          }
        }
      }
    } finally {
      controller.abort();
      try {
        reader.releaseLock();
      } catch {
        // Safe lock release
      }
    }
  }

  /**
   * Consumes a raw binary stream (e.g. 24 kHz PCM audio) and yields Uint8Array chunks.
   * @param {string} path
   * @param {Object} [options]
   * @returns {AsyncGenerator<Uint8Array, void, unknown>}
   */
  async *requestRawStream(path, options = {}) {
    const url = this.buildUrl(path, options.params);
    const headers = this.getHeaders(options.headers);

    let body = undefined;
    if (options.json !== undefined) {
      headers["Content-Type"] = "application/json";
      body = JSON.stringify(options.json);
    }

    const controller = new AbortController();
    if (options.signal) {
      options.signal.addEventListener("abort", () => controller.abort());
    }

    const response = await fetch(url, {
      method: "POST",
      headers,
      body,
      signal: controller.signal,
    });

    if (!response.ok) {
      await handleErrorResponse(response);
    }

    if (!response.body) {
      throw new APIConnectionError("Binary stream has no readable body.");
    }

    const reader = response.body.getReader();
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        if (value) {
          yield value;
        }
      }
    } finally {
      controller.abort();
      try {
        reader.releaseLock();
      } catch {
        // Safe lock release
      }
    }
  }
}
