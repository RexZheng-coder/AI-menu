import { validateMenuHasItems } from "../lib/menuValidation.js";
import { createServerMenuImages, type ServerMenuImage, type ServerUploadedImageFile } from "./menuImageInput.js";
import { MiMoParserError, parseMenuWithMiMo, type MiMoParserErrorCode } from "./mimoMenuParser.js";
import type { Menu } from "../types/menu.js";

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

export async function parseMenuImagesOnServer(request: ParseMenuRequest): Promise<ParseMenuResponse> {
  try {
    const menu = await parseMenuWithMiMo(request.images);
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
