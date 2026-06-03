import { validateMenuHasItems } from "../lib/menuValidation.js";
import { createServerMenuImages, type ServerMenuImage, type ServerUploadedImageFile } from "./menuImageInput.js";
import { parseMenuWithMiMo } from "./mimoMenuParser.js";
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
      error: string;
    };

export async function parseMenuImagesOnServer(request: ParseMenuRequest): Promise<ParseMenuResponse> {
  try {
    const menu = await parseMenuWithMiMo(request.images);
    const validationError = validateMenuHasItems(menu);

    if (validationError) {
      return {
        ok: false,
        error: validationError,
      };
    }

    return {
      ok: true,
      menu,
    };
  } catch (error) {
    return {
      ok: false,
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
