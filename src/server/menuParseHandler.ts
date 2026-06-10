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
  const provider = readAiProvider();

  console.info("[menu-parse]", {
    event: "parse_strategy",
    provider,
    strategy,
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

function readEnv(name: string): string | undefined {
  const value = typeof process !== "undefined" ? process.env?.[name] : undefined;
  return value && value.trim().length > 0 ? value.trim() : undefined;
}
