import { validateMenuHasItems } from "../lib/menuValidation.js";
import { createServerMenuImages, type ServerMenuImage, type ServerUploadedImageFile } from "./menuImageInput.js";
import { MiMoParserError, parseMenuWithMiMo, type MiMoParserErrorCode } from "./mimoMenuParser.js";
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
    }
  | {
      ok: false;
      code?: MiMoParserErrorCode | "EMPTY_MENU";
      status?: number;
      error: string;
    };

type ParseStrategy = "ocr_first" | "vision";

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

export async function parseUploadedMenuFilesOnServer(
  files: ServerUploadedImageFile[],
): Promise<ParseMenuResponse> {
  return parseMenuImagesOnServer({
    images: await createServerMenuImages(files),
  });
}

async function parseMenuWithStrategy(images: ServerMenuImage[]): Promise<Menu> {
  const strategy = readParseStrategy();

  console.info("[menu-parse]", {
    event: "parse_strategy",
    strategy,
  });

  if (strategy === "vision") {
    return parseMenuWithMiMo(images);
  }

  try {
    return await parseMenuWithMiMoOcrFirst(images);
  } catch (error) {
    if (!shouldFallbackToVision(error)) {
      throw error;
    }

    console.warn("[menu-parse]", {
      event: "fallback_to_vision",
      code: error instanceof MiMoParserError ? error.code : "MIMO_PARSE_FAILED",
      message: error instanceof Error ? error.message : "Unknown OCR-first parsing failure.",
    });

    return parseMenuWithMiMo(images, {
      timeoutMs: 10_000,
    });
  }
}

function readParseStrategy(): ParseStrategy {
  const value = readEnv("MIMO_PARSE_STRATEGY");

  if (value === "vision") {
    return "vision";
  }

  return "ocr_first";
}

function shouldFallbackToVision(error: unknown): boolean {
  if (!(error instanceof MiMoParserError)) {
    return true;
  }

  return (
    error.code !== "SERVER_CONFIG" &&
    error.code !== "MIMO_UNSUPPORTED_MODEL" &&
    error.code !== "MIMO_TIMEOUT"
  );
}

function readEnv(name: string): string | undefined {
  const value = typeof process !== "undefined" ? process.env?.[name] : undefined;
  return value && value.trim().length > 0 ? value.trim() : undefined;
}
