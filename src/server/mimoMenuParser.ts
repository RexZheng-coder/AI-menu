import type { Menu } from "../types/menu.js";
import {
  MENU_SINGLE_PASS_ACCURATE_RUNTIME_PROMPT,
  MENU_SINGLE_PASS_BALANCED_PROMPT,
  MENU_SINGLE_PASS_DENSE_FALLBACK_PROMPT,
  MENU_SINGLE_PASS_FAST_PROMPT,
  MENU_SINGLE_PASS_LOW_COUNT_RETRY_PROMPT,
  MENU_SINGLE_PASS_SYSTEM_PROMPT,
} from "../lib/menuSinglePassPrompt.js";
import {
  buildMenuFromLightweightExtraction,
  parseLightweightExtractionWithMetadata,
  type LightweightMenuExtraction,
} from "./lightweightMenuExtraction.js";
import {
  assertMiMoImageModel,
  createMiMoConfig,
  MiMoParserError,
  readEnv,
  sendMiMoChatCompletion,
  type MiMoChatOptions,
  type MiMoContentPart,
} from "./mimoChatClient.js";
import type { ServerMenuImage } from "./menuImageInput.js";
import {
  maxCompletionTokensAccurate,
  maxCompletionTokensBalanced,
  maxCompletionTokensFast,
  denseFallbackMaxTokens,
  miMoApiTimeoutMs,
  retryBudgetAccurateMs,
  retryBudgetFastOrBalancedMs,
} from "../lib/menuConfig.js";

export { MiMoParserError, type MiMoParserErrorCode } from "./mimoChatClient.js";

export type MenuParseDetail = "fast" | "balanced" | "accurate";

export type MiMoMenuParseDiagnostics = {
  detail: MenuParseDetail;
  durationMs: number;
  categoryCount: number;
  itemCount: number;
  finishReason?: string;
  contentLength: number;
  recoveredFromTruncation: boolean;
  retryCount: number;
  denseFallbackUsed: boolean;
};

type DetailConfig = {
  detail: MenuParseDetail;
  userPrompt: string;
  maxCompletionTokens: number;
  timeoutMs: number;
};

type ParseAttemptResult = {
  extraction: LightweightMenuExtraction;
  finishReason?: string;
  contentLength: number;
  recoveredFromTruncation: boolean;
};

type RetryKind = "dense_fallback";

const maxMiMoRequestTimeoutMs = miMoApiTimeoutMs;

let lastMiMoMenuParseDiagnostics: MiMoMenuParseDiagnostics | null = null;

export async function parseMenuWithMiMo(
  images: ServerMenuImage[],
  options: MiMoChatOptions = {},
): Promise<Menu> {
  lastMiMoMenuParseDiagnostics = null;

  if (images.length === 0) {
    throw new MiMoParserError("MIMO_PARSE_FAILED", "No menu images were provided.");
  }

  const detailConfig = createDetailConfig();
  const config = createMiMoConfig({
    ...options,
    timeoutMs: options.timeoutMs ?? detailConfig.timeoutMs,
  });
  assertMiMoImageModel(config.model);
  const startedAt = Date.now();

  console.info("[menu-parse]", {
    event: "mimo_input_summary",
    provider: "mimo",
    model: config.model,
    detail: detailConfig.detail,
    imageCount: images.length,
    timeoutMs: config.timeoutMs,
    originalBytes: images.reduce((sum, image) => sum + image.originalByteLength, 0),
    optimizedBytes: images.reduce((sum, image) => sum + image.optimizedByteLength, 0),
    imageHashes: images.map((image) => image.sha256.slice(0, 16)),
  });

  const result = await requestMenuExtraction({
    config,
    images,
    userPrompt: detailConfig.userPrompt,
    maxCompletionTokens: detailConfig.maxCompletionTokens,
    logLabel: "mimo",
  });
  const resolvedExtraction = await parseExtractionWithRetry({
    initialText: result.outputText,
    finishReason: result.finishReason,
    contentLength: result.outputText.length,
    startedAt,
    config,
    images,
    detailConfig,
  });
  const now = new Date().toISOString();

  console.info("[menu-parse]", {
    event: "sanitize_start",
    model: config.model,
  });
  const menu = buildMenuFromLightweightExtraction(resolvedExtraction, {
    imageUrls: images.map((image) => image.name),
    model: config.model,
    now,
  });
  console.info("[menu-parse]", {
    event: "sanitize_done",
    categoryCount: menu.categories.length,
  });
  lastMiMoMenuParseDiagnostics = {
    ...(lastMiMoMenuParseDiagnostics ?? createMenuDiagnostics(
      detailConfig,
      startedAt,
      {
        extraction: resolvedExtraction,
        finishReason: result.finishReason,
        contentLength: result.outputText.length,
        recoveredFromTruncation: false,
      },
      0,
      false,
    )),
    durationMs: Date.now() - startedAt,
    categoryCount: menu.categories.length,
    itemCount: countItems(resolvedExtraction),
  };

  return menu;
}

async function parseExtractionWithRetry(options: {
  initialText: string;
  finishReason?: string;
  contentLength: number;
  startedAt: number;
  config: ReturnType<typeof createMiMoConfig>;
  images: ServerMenuImage[];
  detailConfig: DetailConfig;
}): Promise<LightweightMenuExtraction> {
  let parsedAttempt: ParseAttemptResult | null = null;

  try {
    const parsed = parseLightweightExtractionWithMetadata(options.initialText);
    parsedAttempt = {
      extraction: parsed.extraction,
      finishReason: options.finishReason,
      contentLength: options.contentLength,
      recoveredFromTruncation: parsed.recoveredFromTruncation,
    };
    assertExtractionHasItems(parsed.extraction);

    const retryKind = getRetryKindForAttempt(parsedAttempt, options.detailConfig);

    if (!retryKind) {
      lastMiMoMenuParseDiagnostics = createMenuDiagnostics(options.detailConfig, options.startedAt, parsedAttempt, 0, false);
      return parsed.extraction;
    }
  } catch (error) {
    if (error instanceof MiMoParserError && error.code === "EMPTY_MENU_EXTRACTION") {
      throw error;
    }

    if (!shouldRetryExtraction(options.startedAt, options.detailConfig)) {
      throw new MiMoParserError(
        "AI_INVALID_JSON",
        "The AI parser returned JSON we could not read. Please retry the scan.",
        { status: 400, cause: error },
      );
    }

    return requestRetryExtraction({
      ...options,
      retryKind: "dense_fallback",
      retryReason: options.finishReason === "length" ? "length" : "invalid_json",
    });
  }

  if (!shouldRetryExtraction(options.startedAt, options.detailConfig)) {
    if (parsedAttempt) {
      console.warn("[menu-parse]", {
        event: "mimo_completeness_retry_skipped",
        reason: "time_budget",
        detail: options.detailConfig.detail,
        itemCount: countItems(parsedAttempt.extraction),
        finishReason: parsedAttempt.finishReason,
        recoveredFromTruncation: parsedAttempt.recoveredFromTruncation,
      });
      lastMiMoMenuParseDiagnostics = createMenuDiagnostics(options.detailConfig, options.startedAt, parsedAttempt, 0, false);
      return parsedAttempt.extraction;
    }

    throw new MiMoParserError(
      "AI_INVALID_JSON",
      "The AI parser returned truncated JSON. Please retry with a clearer image.",
      { status: 400 },
    );
  }

  const retryKind = parsedAttempt ? getRetryKindForAttempt(parsedAttempt, options.detailConfig) : "dense_fallback";
  return requestRetryExtraction({
    ...options,
    retryKind: retryKind ?? "dense_fallback",
    retryReason: parsedAttempt
      ? createCompletenessRetryReason(parsedAttempt)
      : options.finishReason === "length"
        ? "length"
        : "invalid_json",
  });
}

async function requestRetryExtraction(options: {
  startedAt: number;
  config: ReturnType<typeof createMiMoConfig>;
  images: ServerMenuImage[];
  detailConfig: DetailConfig;
  retryKind: RetryKind;
  retryReason: string;
}): Promise<LightweightMenuExtraction> {
  const denseFallbackUsed = options.retryKind === "dense_fallback";

  console.info("[menu-parse]", {
    event: denseFallbackUsed ? "mimo_retry_dense_fallback_prompt" : "mimo_retry_accuracy_prompt",
    detail: options.detailConfig.detail,
    reason: options.retryReason,
  });
  const retryResult = await requestMenuExtraction({
    config: options.config,
    images: options.images,
    userPrompt: denseFallbackUsed ? MENU_SINGLE_PASS_DENSE_FALLBACK_PROMPT : MENU_SINGLE_PASS_LOW_COUNT_RETRY_PROMPT,
    maxCompletionTokens: denseFallbackUsed ? denseFallbackMaxTokens : Math.max(options.detailConfig.maxCompletionTokens, 4500),
    logLabel: denseFallbackUsed ? "mimo_dense_fallback" : "mimo_retry",
  });

  try {
    const retryParsed = parseLightweightExtractionWithMetadata(retryResult.outputText);
    assertExtractionHasItems(retryParsed.extraction);

    const retryAttempt: ParseAttemptResult = {
      extraction: retryParsed.extraction,
      finishReason: retryResult.finishReason,
      contentLength: retryResult.outputText.length,
      recoveredFromTruncation: retryParsed.recoveredFromTruncation,
    };
    lastMiMoMenuParseDiagnostics = createMenuDiagnostics(
      options.detailConfig,
      options.startedAt,
      retryAttempt,
      1,
      denseFallbackUsed,
    );
    return retryParsed.extraction;
  } catch (error) {
    if (error instanceof MiMoParserError && error.code === "EMPTY_MENU_EXTRACTION") {
      throw error;
    }

    throw new MiMoParserError(
      "AI_INVALID_JSON",
      "The AI parser returned JSON we could not read. Please retry the scan.",
      { status: 400, cause: error },
    );
  }
}

async function requestMenuExtraction(options: {
  config: ReturnType<typeof createMiMoConfig>;
  images: ServerMenuImage[];
  userPrompt: string;
  maxCompletionTokens: number;
  logLabel: string;
}): Promise<Awaited<ReturnType<typeof sendMiMoChatCompletion>>> {
  const userContent: MiMoContentPart[] = [
    {
      type: "text",
      text: options.userPrompt,
    },
    ...options.images.map((image) => ({
      type: "image_url" as const,
      image_url: {
        url: image.dataUrl,
      },
    })),
  ];

  return sendMiMoChatCompletion({
    config: options.config,
    messages: [
      {
        role: "system",
        content: MENU_SINGLE_PASS_SYSTEM_PROMPT,
      },
      {
        role: "user",
        content: userContent,
      },
    ],
    maxCompletionTokens: options.maxCompletionTokens,
    temperature: 0.1,
    logLabel: options.logLabel,
    imageCount: options.images.length,
    includeThinking: true,
    retryWithoutThinking: true,
  });
}

function assertExtractionHasItems(extraction: LightweightMenuExtraction): void {
  const itemCount = extraction.categories.reduce((sum, category) => sum + category.items.length, 0);

  if (itemCount === 0) {
    throw new MiMoParserError(
      "EMPTY_MENU_EXTRACTION",
      "We could not find any dishes in that menu image. Please try a clearer photo or another page.",
      { status: 422 },
    );
  }
}

function createDetailConfig(): DetailConfig {
  const detail = readParseDetail();

  if (detail === "fast") {
    return {
      detail,
      userPrompt: MENU_SINGLE_PASS_FAST_PROMPT,
      maxCompletionTokens: maxCompletionTokensFast,
      timeoutMs: maxMiMoRequestTimeoutMs,
    };
  }

  if (detail === "balanced") {
    return {
      detail,
      userPrompt: MENU_SINGLE_PASS_BALANCED_PROMPT,
      maxCompletionTokens: maxCompletionTokensBalanced,
      timeoutMs: maxMiMoRequestTimeoutMs,
    };
  }

  return {
    detail,
    userPrompt: MENU_SINGLE_PASS_ACCURATE_RUNTIME_PROMPT,
    maxCompletionTokens: maxCompletionTokensAccurate,
    timeoutMs: maxMiMoRequestTimeoutMs,
  };
}

function readParseDetail(): MenuParseDetail {
  const value = readEnv("MENU_PARSE_DETAIL");

  if (value === "fast" || value === "balanced" || value === "accurate") {
    return value;
  }

  return "accurate";
}

function shouldRetryForCompleteness(attempt: ParseAttemptResult, detailConfig: DetailConfig): boolean {
  return getRetryKindForAttempt(attempt, detailConfig) !== null;
}

function getRetryKindForAttempt(attempt: ParseAttemptResult, detailConfig: DetailConfig): RetryKind | null {
  return attempt.finishReason === "length" || attempt.recoveredFromTruncation ? "dense_fallback" : null;
}

function createCompletenessRetryReason(attempt: ParseAttemptResult): string {
  if (attempt.finishReason === "length") {
    return "length";
  }

  if (attempt.recoveredFromTruncation) {
    return "recovered_from_truncation";
  }

  return "invalid_json";
}

function shouldRetryExtraction(startedAt: number, detailConfig: DetailConfig): boolean {
  const elapsedMs = Date.now() - startedAt;
  const retryBudgetMs = detailConfig.detail === "accurate" ? retryBudgetAccurateMs : retryBudgetFastOrBalancedMs;
  return elapsedMs < retryBudgetMs;
}

function createMenuDiagnostics(
  detailConfig: DetailConfig,
  startedAt: number,
  attempt: ParseAttemptResult,
  retryCount: number,
  denseFallbackUsed: boolean,
): MiMoMenuParseDiagnostics {
  return {
    detail: detailConfig.detail,
    durationMs: Date.now() - startedAt,
    categoryCount: attempt.extraction.categories.length,
    itemCount: countItems(attempt.extraction),
    finishReason: attempt.finishReason,
    contentLength: attempt.contentLength,
    recoveredFromTruncation: attempt.recoveredFromTruncation,
    retryCount,
    denseFallbackUsed,
  };
}

export function getLastMiMoMenuParseDiagnostics(): MiMoMenuParseDiagnostics | null {
  return lastMiMoMenuParseDiagnostics;
}

function countItems(extraction: LightweightMenuExtraction): number {
  return extraction.categories.reduce((sum, category) => sum + category.items.length, 0);
}
