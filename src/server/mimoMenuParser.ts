import type { Menu } from "../types/menu.js";
import {
  MENU_SINGLE_PASS_COMPACT_RETRY_PROMPT,
  MENU_SINGLE_PASS_RUNTIME_PROMPT,
  MENU_SINGLE_PASS_SYSTEM_PROMPT,
} from "../lib/menuSinglePassPrompt.js";
import { buildMenuFromLightweightExtraction, parseLightweightExtractionFromText } from "./lightweightMenuExtraction.js";
import {
  assertMiMoImageModel,
  createMiMoConfig,
  MiMoParserError,
  sendMiMoChatCompletion,
  type MiMoChatOptions,
  type MiMoContentPart,
} from "./mimoChatClient.js";
import type { ServerMenuImage } from "./menuImageInput.js";

export { MiMoParserError, type MiMoParserErrorCode } from "./mimoChatClient.js";

export async function parseMenuWithMiMo(
  images: ServerMenuImage[],
  options: MiMoChatOptions = {},
): Promise<Menu> {
  if (images.length === 0) {
    throw new MiMoParserError("MIMO_PARSE_FAILED", "No menu images were provided.");
  }

  const config = createMiMoConfig(options);
  assertMiMoImageModel(config.model);
  const startedAt = Date.now();

  console.info("[menu-parse]", {
    event: "mimo_input_summary",
    provider: "mimo",
    model: config.model,
    imageCount: images.length,
    originalBytes: images.reduce((sum, image) => sum + image.originalByteLength, 0),
    optimizedBytes: images.reduce((sum, image) => sum + image.optimizedByteLength, 0),
    imageHashes: images.map((image) => image.sha256.slice(0, 16)),
  });

  const result = await requestMenuExtraction({
    config,
    images,
    userPrompt: MENU_SINGLE_PASS_RUNTIME_PROMPT,
    maxCompletionTokens: 1900,
  });
  const resolvedExtraction = await parseExtractionWithRetry({
    initialText: result.outputText,
    finishReason: result.finishReason,
    startedAt,
    config,
    images,
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

  return menu;
}

async function parseExtractionWithRetry(options: {
  initialText: string;
  finishReason?: string;
  startedAt: number;
  config: ReturnType<typeof createMiMoConfig>;
  images: ServerMenuImage[];
}): Promise<ReturnType<typeof parseLightweightExtractionFromText>> {
  try {
    const extraction = parseLightweightExtractionFromText(options.initialText);
    assertExtractionHasItems(extraction);

    if (options.finishReason !== "length") {
      return extraction;
    }
  } catch (error) {
    if (error instanceof MiMoParserError && error.code === "EMPTY_MENU_EXTRACTION") {
      throw error;
    }

    if (!shouldRetryExtraction(options.startedAt)) {
      throw new MiMoParserError(
        "AI_INVALID_JSON",
        "The AI parser returned JSON we could not read. Please retry the scan.",
        { status: 400, cause: error },
      );
    }
  }

  if (!shouldRetryExtraction(options.startedAt)) {
    throw new MiMoParserError(
      "AI_INVALID_JSON",
      "The AI parser returned truncated JSON. Please retry with a clearer image.",
      { status: 400 },
    );
  }

  console.info("[menu-parse]", {
    event: "mimo_retry_compact_prompt",
    reason: options.finishReason === "length" ? "length" : "invalid_json",
  });
  const retryResult = await requestMenuExtraction({
    config: options.config,
    images: options.images,
    userPrompt: MENU_SINGLE_PASS_COMPACT_RETRY_PROMPT,
    maxCompletionTokens: 3500,
  });

  try {
    const extraction = parseLightweightExtractionFromText(retryResult.outputText);
    assertExtractionHasItems(extraction);
    return extraction;
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
    logLabel: "mimo",
    imageCount: options.images.length,
    includeThinking: true,
    retryWithoutThinking: true,
  });
}

function assertExtractionHasItems(extraction: ReturnType<typeof parseLightweightExtractionFromText>): void {
  const itemCount = extraction.categories.reduce((sum, category) => sum + category.items.length, 0);

  if (itemCount === 0) {
    throw new MiMoParserError(
      "EMPTY_MENU_EXTRACTION",
      "We could not find any dishes in that menu image. Please try a clearer photo or another page.",
      { status: 422 },
    );
  }
}

function shouldRetryExtraction(startedAt: number): boolean {
  return Date.now() - startedAt < 12_000;
}
