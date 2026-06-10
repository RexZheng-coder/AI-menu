import { validateMenuHasItems } from "../lib/menuValidation.js";
import { createServerMenuImages, type ServerMenuImage, type ServerUploadedImageFile } from "./menuImageInput.js";
import {
  getLastMiMoMenuParseDiagnostics,
  MiMoParserError,
  parseMenuWithMiMo,
  type MiMoParserErrorCode,
} from "./mimoMenuParser.js";
import { parseMenuWithMiMoOcrFirst } from "./mimoOcrMenuParser.js";
import type { Menu } from "../types/menu.js";

declare const process:
  | {
      env?: Record<string, string | undefined>;
    }
  | undefined;

export type ParseMenuRequest = {
  images: ServerMenuImage[];
};

export type ParseMenuResponse =
  | {
      ok: true;
      menu: Menu;
      parse_metadata: ParseMetadata;
    }
  | {
      ok: false;
      code?: MiMoParserErrorCode | "EMPTY_MENU";
      status?: number;
      error: string;
    };

export type ParseMetadata = {
  item_count: number;
  category_count: number;
  parse_detail: string;
  provider: "mimo";
  recovered_from_truncation: boolean;
  retry_used: boolean;
  duration_ms: number | null;
};

type ParseStrategy = "ocr_first" | "vision";
type AiProvider = "mimo";

export async function parseMenuImagesOnServer(request: ParseMenuRequest): Promise<ParseMenuResponse> {
  try {
    const menu = await parseMenuWithStrategy(request.images);
    const validationError = validateMenuHasItems(menu);

    if (validationError) {
      return {
        ok: false,
        code: "EMPTY_MENU",
        status: 422,
        error: validationError,
      };
    }

    return {
      ok: true,
      menu,
      parse_metadata: createParseMetadata(menu),
    };
  } catch (error) {
    if (error instanceof MiMoParserError) {
      return {
        ok: false,
        code: error.code,
        status: error.status,
        error: error.message,
      };
    }

    return {
      ok: false,
      code: "MIMO_PARSE_FAILED",
      error: error instanceof Error ? error.message : "Menu parsing failed. Please try again.",
    };
  }
}

function createParseMetadata(menu: Menu): ParseMetadata {
  const diagnostics = getLastMiMoMenuParseDiagnostics();

  return {
    item_count: menu.categories.reduce((sum, category) => sum + category.items.length, 0),
    category_count: menu.categories.length,
    parse_detail: diagnostics?.detail ?? readParseDetail(),
    provider: "mimo",
    recovered_from_truncation: diagnostics?.recoveredFromTruncation ?? false,
    retry_used: (diagnostics?.retryCount ?? 0) > 0,
    duration_ms: diagnostics?.durationMs ?? null,
  };
}

export async function parseUploadedMenuFilesOnServer(
  files: ServerUploadedImageFile[],
): Promise<ParseMenuResponse> {
  return parseMenuImagesOnServer({
    images: await createServerMenuImages(files),
  });
}

async function parseMenuWithStrategy(images: ServerMenuImage[]): Promise<Menu> {
  const strategy = readParseStrategy();
  const provider = readAiProvider();
  const detail = readParseDetail();

  console.info("[menu-parse]", {
    event: "parse_strategy",
    provider,
    strategy,
    detail,
  });

  if (strategy === "ocr_first") {
    return parseMenuWithMiMoOcrFirst(images);
  }

  return parseMenuWithMiMo(images);
}

function readParseStrategy(): ParseStrategy {
  const value = readEnv("MENU_PARSE_STRATEGY");

  if (value === "ocr_first") {
    return "ocr_first";
  }

  return "vision";
}

function readAiProvider(): AiProvider {
  const value = readEnv("MENU_AI_PROVIDER");

  if (value !== "mimo" && value !== undefined) {
    console.warn("[menu-parse]", {
      event: "unsupported_provider_defaulted",
      provider: value,
      defaultProvider: "mimo",
    });
  }

  return "mimo";
}

function readParseDetail(): string {
  const value = readEnv("MENU_PARSE_DETAIL");

  if (value === "fast" || value === "balanced" || value === "accurate") {
    return value;
  }

  return "accurate";
}

function readEnv(name: string): string | undefined {
  const value = typeof process !== "undefined" ? process.env?.[name] : undefined;
  return value && value.trim().length > 0 ? value.trim() : undefined;
}
