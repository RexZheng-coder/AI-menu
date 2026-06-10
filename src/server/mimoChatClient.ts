declare const process:
  | {
      env?: Record<string, string | undefined>;
    }
  | undefined;

export type MiMoChatOptions = {
  apiKey?: string;
  baseUrl?: string;
  model?: string;
  timeoutMs?: number;
  fetchFn?: typeof fetch;
};

export type MiMoContentPart =
  | {
      type: "image_url";
      image_url: {
        url: string;
      };
    }
  | {
      type: "text";
      text: string;
    };

export type MiMoChatMessage = {
  role: "system" | "user" | "assistant";
  content: string | MiMoContentPart[];
};

type MiMoChatCompletionRequest = {
  model: string;
  messages: MiMoChatMessage[];
  max_completion_tokens: number;
  temperature: number;
  stream: false;
  thinking?: {
    type: "disabled";
  };
};

export type MiMoChatCompletionResult = {
  model: string;
  rawText: string;
  body: unknown;
  outputText: string;
  durationMs: number;
  finishReason?: string;
  usage: unknown;
};

export type MiMoChatDiagnostics = {
  provider: "mimo";
  model: string;
  durationMs: number;
  status?: number;
  finishReason?: string;
  bodyLength: number;
  outputLength: number;
  usage: unknown;
};

export type MiMoConfig = {
  apiKey: string;
  baseUrl: string;
  endpoint: string;
  model: string;
  fetchFn: typeof fetch;
  timeoutMs: number;
};

export type MiMoParserErrorCode =
  | "SERVER_CONFIG"
  | "MIMO_TIMEOUT"
  | "MIMO_API_ERROR"
  | "MIMO_UNSUPPORTED_MODEL"
  | "MIMO_PARSE_FAILED"
  | "AI_INVALID_JSON"
  | "EMPTY_MENU_EXTRACTION";

export class MiMoParserError extends Error {
  readonly code: MiMoParserErrorCode;
  readonly status?: number;

  constructor(code: MiMoParserErrorCode, message: string, options: { status?: number; cause?: unknown } = {}) {
    super(message);
    this.name = "MiMoParserError";
    this.code = code;
    this.status = options.status;
    this.cause = options.cause;
  }
}

export const defaultMiMoBaseUrl = "https://api.xiaomimimo.com/v1";
export const defaultMiMoModel = "mimo-v2.5";
export const defaultMiMoTimeoutMs = 24_000;

const imageCapableModels = new Set(["mimo-v2.5", "mimo-v2-omni"]);
let lastMiMoChatDiagnostics: MiMoChatDiagnostics | null = null;

export function createMiMoConfig(options: MiMoChatOptions = {}): MiMoConfig {
  const apiKey = options.apiKey ?? readEnv("MIMO_API_KEY");

  if (!apiKey) {
    throw new MiMoParserError(
      "SERVER_CONFIG",
      "MiMo API key is not configured. Set MIMO_API_KEY in Vercel environment variables.",
      { status: 503 },
    );
  }

  const baseUrl = options.baseUrl ?? readEnv("MIMO_BASE_URL") ?? defaultMiMoBaseUrl;
  const model = options.model ?? readEnv("MIMO_MODEL") ?? defaultMiMoModel;

  return {
    apiKey,
    baseUrl,
    endpoint: createChatCompletionsUrl(baseUrl),
    model,
    fetchFn: options.fetchFn ?? fetch,
    timeoutMs: options.timeoutMs ?? defaultMiMoTimeoutMs,
  };
}

export function assertMiMoImageModel(model: string): void {
  if (!imageCapableModels.has(model)) {
    throw new MiMoParserError(
      "MIMO_UNSUPPORTED_MODEL",
      `MiMo model ${model} is not configured for image understanding. Use mimo-v2.5 for pay-as-you-go image parsing.`,
      { status: 400 },
    );
  }
}

export async function sendMiMoChatCompletion(options: {
  config: MiMoConfig;
  messages: MiMoChatMessage[];
  maxCompletionTokens: number;
  temperature: number;
  logLabel: string;
  imageCount?: number;
  includeThinking?: boolean;
  retryWithoutThinking?: boolean;
}): Promise<MiMoChatCompletionResult> {
  const includeThinking = options.includeThinking ?? true;

  try {
    return await sendMiMoChatCompletionOnce({
      ...options,
      includeThinking,
    });
  } catch (error) {
    if (
      includeThinking &&
      options.retryWithoutThinking !== false &&
      error instanceof MiMoParserError &&
      error.code === "MIMO_API_ERROR" &&
      looksLikeUnsupportedThinking(error.message)
    ) {
      console.info("[menu-parse]", {
        event: `${options.logLabel}_retry_without_thinking`,
        provider: "mimo",
        model: options.config.model,
      });

      return sendMiMoChatCompletionOnce({
        ...options,
        includeThinking: false,
      });
    }

    throw error;
  }
}

async function sendMiMoChatCompletionOnce(options: {
  config: MiMoConfig;
  messages: MiMoChatMessage[];
  maxCompletionTokens: number;
  temperature: number;
  logLabel: string;
  imageCount?: number;
  includeThinking: boolean;
}): Promise<MiMoChatCompletionResult> {
  const abortController = new AbortController();
  const timeoutId = setTimeout(() => {
    abortController.abort();
  }, options.config.timeoutMs);
  const requestStartedAt = Date.now();

  let response: Response;
  let responseText: string;

  try {
    console.info("[menu-parse]", {
      event: `${options.logLabel}_request_start`,
      provider: "mimo",
      endpointHost: safeUrlHost(options.config.endpoint),
      model: options.config.model,
      imageCount: options.imageCount,
      timeoutMs: options.config.timeoutMs,
      includeThinking: options.includeThinking,
    });

    response = await options.config.fetchFn(options.config.endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "api-key": options.config.apiKey,
      },
      body: JSON.stringify(createMiMoRequestBody(options)),
      signal: abortController.signal,
    });

    console.info("[menu-parse]", {
      event: `${options.logLabel}_response_status`,
      provider: "mimo",
      status: response.status,
      statusText: response.statusText,
      ok: response.ok,
    });

    responseText = await response.text();
  } catch (error) {
    if (isAbortError(error)) {
      console.warn("[menu-parse]", {
        event: `${options.logLabel}_timeout`,
        code: "MIMO_TIMEOUT",
        timeoutMs: options.config.timeoutMs,
      });
      throw new MiMoParserError(
        "MIMO_TIMEOUT",
        "Menu parsing timed out. Please try again with a clearer image.",
        { status: 504, cause: error },
      );
    }

    console.warn("[menu-parse]", {
      event: `${options.logLabel}_request_error`,
      code: "MIMO_PARSE_FAILED",
    });
    throw new MiMoParserError("MIMO_PARSE_FAILED", "MiMo request failed before receiving a response.", {
      cause: error,
    });
  } finally {
    clearTimeout(timeoutId);
  }

  const durationMs = Date.now() - requestStartedAt;

  if (!response.ok) {
    const errorMessage = extractErrorMessage(responseText);

    console.warn("[menu-parse]", {
      event: `${options.logLabel}_response_error`,
      provider: "mimo",
      code: "MIMO_API_ERROR",
      status: response.status,
      statusText: response.statusText,
      bodyPreview: responseText.slice(0, 500),
    });

    throw new MiMoParserError(
      "MIMO_API_ERROR",
      `MiMo API error ${response.status}: ${errorMessage}`,
      { status: response.status },
    );
  }

  const body = parseResponseJson(responseText);
  const finishReason = extractMiMoFinishReason(body);
  const usage = extractMiMoUsage(body);
  const outputText = extractMiMoOutputText(body);

  console.info("[menu-parse]", {
    event: `${options.logLabel}_response_summary`,
    provider: "mimo",
    durationMs,
    bodyLength: responseText.length,
    outputLength: outputText.length,
    finishReason,
    usage,
  });
  lastMiMoChatDiagnostics = {
    provider: "mimo",
    model: options.config.model,
    durationMs,
    status: response.status,
    finishReason,
    bodyLength: responseText.length,
    outputLength: outputText.length,
    usage,
  };

  return {
    model: options.config.model,
    rawText: responseText,
    body,
    outputText,
    durationMs,
    finishReason,
    usage,
  };
}

export function getLastMiMoChatDiagnostics(): MiMoChatDiagnostics | null {
  return lastMiMoChatDiagnostics;
}

export function readEnv(name: string): string | undefined {
  const value = typeof process !== "undefined" ? process.env?.[name] : undefined;
  return value && value.trim().length > 0 ? value.trim() : undefined;
}

export function createChatCompletionsUrl(baseUrl: string): string {
  const trimmedBaseUrl = baseUrl.trim().replace(/\/+$/, "");

  return trimmedBaseUrl.endsWith("/chat/completions")
    ? trimmedBaseUrl
    : `${trimmedBaseUrl}/chat/completions`;
}

export function extractErrorMessage(responseText: string): string {
  if (!responseText.trim()) {
    return "empty response body";
  }

  try {
    const body = asRecord(JSON.parse(responseText) as unknown);
    const directError = asString(body.error);

    if (directError) {
      return directError;
    }

    const nestedError = asRecord(body.error);
    return asString(nestedError.message) ?? responseText.slice(0, 240);
  } catch {
    return responseText.slice(0, 240);
  }
}

function createMiMoRequestBody(options: {
  config: MiMoConfig;
  messages: MiMoChatMessage[];
  maxCompletionTokens: number;
  temperature: number;
  includeThinking: boolean;
}): MiMoChatCompletionRequest {
  return {
    model: options.config.model,
    messages: options.messages,
    max_completion_tokens: options.maxCompletionTokens,
    temperature: options.temperature,
    stream: false,
    ...(options.includeThinking
      ? {
          thinking: {
            type: "disabled",
          },
        }
      : {}),
  };
}

function looksLikeUnsupportedThinking(text: string): boolean {
  const lowerText = text.toLowerCase();
  return lowerText.includes("thinking") || lowerText.includes("unknown parameter");
}

function safeUrlHost(url: string): string {
  try {
    return new URL(url).host;
  } catch {
    return "invalid-url";
  }
}

function extractMiMoFinishReason(input: unknown): string | undefined {
  const body = asRecord(input);
  const firstChoice = asRecord(asArray(body.choices)[0]);

  return asString(firstChoice.finish_reason);
}

function extractMiMoUsage(input: unknown): unknown {
  return asRecord(input).usage;
}

function extractMiMoOutputText(input: unknown): string {
  const body = asRecord(input);

  for (const choice of asArray(body.choices)) {
    const message = asRecord(asRecord(choice).message);
    const content = message.content;
    const directText = asString(content);

    if (directText) {
      return directText;
    }

    for (const part of asArray(content)) {
      const text = asString(asRecord(part).text);

      if (text) {
        return text;
      }
    }
  }

  throw new MiMoParserError("MIMO_PARSE_FAILED", "MiMo response did not include output text.");
}

function parseResponseJson(text: string): unknown {
  try {
    return JSON.parse(text) as unknown;
  } catch (error) {
    throw new MiMoParserError("MIMO_PARSE_FAILED", "MiMo response was not valid JSON.", {
      cause: error,
    });
  }
}

function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === "AbortError";
}

function asRecord(input: unknown): Record<string, unknown> {
  if (typeof input === "object" && input !== null && !Array.isArray(input)) {
    return input as Record<string, unknown>;
  }

  return {};
}

function asArray(input: unknown): unknown[] {
  return Array.isArray(input) ? input : [];
}

function asString(input: unknown): string | undefined {
  return typeof input === "string" && input.trim().length > 0 ? input.trim() : undefined;
}
