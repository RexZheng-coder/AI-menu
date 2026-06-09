import type { Menu } from "../types/menu.js";
import { buildMenuFromLightweightExtraction } from "./lightweightMenuExtraction.js";
import { createMiMoConfig, type MiMoChatOptions } from "./mimoChatClient.js";
import { extractMenuTextWithMiMo } from "./mimoOcrExtractor.js";
import { structureMenuTextWithMiMo } from "./menuTextStructurer.js";
import type { ServerMenuImage } from "./menuImageInput.js";

export async function parseMenuWithMiMoOcrFirst(
  images: ServerMenuImage[],
  options: MiMoChatOptions = {},
): Promise<Menu> {
  const config = createMiMoConfig(options);
  const imageUrls = images.map((image) => image.name);

  console.info("[menu-parse]", {
    event: "ocr_start",
    imageCount: images.length,
  });
  const ocrText = await extractMenuTextWithMiMo(images, {
    ...options,
    apiKey: config.apiKey,
    baseUrl: config.baseUrl,
    model: config.model,
  });

  console.info("[menu-parse]", {
    event: "structure_start",
    textLength: ocrText.length,
  });
  const extraction = await structureMenuTextWithMiMo(ocrText, {
    ...options,
    apiKey: config.apiKey,
    baseUrl: config.baseUrl,
    model: config.model,
  });

  const now = new Date().toISOString();
  console.info("[menu-parse]", {
    event: "sanitize_start",
    model: config.model,
  });
  const menu = buildMenuFromLightweightExtraction(extraction, {
    imageUrls,
    model: config.model,
    now,
  });
  console.info("[menu-parse]", {
    event: "sanitize_done",
    categoryCount: menu.categories.length,
  });

  return menu;
}
