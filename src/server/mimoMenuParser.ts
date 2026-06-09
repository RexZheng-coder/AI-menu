import type { Menu } from "../types/menu.js";
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

  const userContent: MiMoContentPart[] = [
    {
      type: "text",
      text: createMenuPrompt(),
    },
    ...images.map((image) => ({
      type: "image_url" as const,
      image_url: {
        url: image.dataUrl,
      },
    })),
  ];

  const result = await sendMiMoChatCompletion({
    config,
    messages: [
      {
        role: "system",
        content: "You extract restaurant menus from images. Return valid JSON only.",
      },
      {
        role: "user",
        content: userContent,
      },
    ],
    maxCompletionTokens: 2000,
    temperature: 0.1,
    logLabel: "mimo",
    imageCount: images.length,
  });
  const extraction = parseLightweightExtractionFromText(result.outputText);
  const now = new Date().toISOString();

  console.info("[menu-parse]", {
    event: "sanitize_start",
    model: config.model,
  });
  const menu = buildMenuFromLightweightExtraction(extraction, {
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

function createMenuPrompt(): string {
  return `Extract visible restaurant menu text from the image(s).
Return JSON only. Do not translate, tag, infer allergens, infer spice, or add commentary.
Keep item descriptions short. If a value is not visible, use null.
Use this exact lightweight JSON shape:
{
  "restaurant_name": string | null,
  "cuisine_type": string | null,
  "categories": [
    {
      "name_en": string,
      "items": [
        {
          "name_en": string,
          "description_en": string | null,
          "price_raw": string | null
        }
      ]
    }
  ]
}`;
}
