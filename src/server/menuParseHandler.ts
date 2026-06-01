import { parseMenuWithOpenAI, type ServerMenuImage } from "./openAiMenuParser.js";
import { createServerMenuImages, type ServerUploadedImageFile } from "./menuImageInput.js";
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
    return {
      ok: true,
      menu: await parseMenuWithOpenAI(request.images),
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
