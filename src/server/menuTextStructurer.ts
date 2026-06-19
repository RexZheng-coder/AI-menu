import {
  createMiMoConfig,
  MiMoParserError,
  sendMiMoChatCompletion,
  type MiMoChatOptions,
} from "./mimoChatClient.js";
import {
  parseLightweightExtractionFromText,
  type LightweightMenuExtraction,
} from "./lightweightMenuExtraction.js";
import { textStructuringTimeoutMs as defaultStructuringTimeoutMs } from "../lib/menuConfig.js";

export async function structureMenuTextWithMiMo(
  ocrText: string,
  options: MiMoChatOptions = {},
): Promise<LightweightMenuExtraction> {
  const trimmedText = ocrText.trim();

  if (!trimmedText) {
    throw new MiMoParserError("MIMO_PARSE_FAILED", "Cannot structure empty OCR text.");
  }

  const config = createMiMoConfig({
    ...options,
    timeoutMs: options.timeoutMs ?? defaultStructuringTimeoutMs,
  });
  const result = await sendMiMoChatCompletion({
    config,
    messages: [
      {
        role: "system",
        content: "You convert raw restaurant menu text into compact JSON. Return JSON only.",
      },
      {
        role: "user",
        content: createStructuringPrompt(trimmedText),
      },
    ],
    maxCompletionTokens: 2000,
    temperature: 0.1,
    logLabel: "structure",
  });

  const extraction = parseLightweightExtractionFromText(result.outputText);

  console.info("[menu-parse]", {
    event: "structure_done",
    durationMs: result.durationMs,
    outputLength: result.outputText.length,
    finishReason: result.finishReason,
    usage: result.usage,
    categoryCount: extraction.categories.length,
  });

  return extraction;
}

function createStructuringPrompt(ocrText: string): string {
  return `Convert this restaurant menu text into minified JSON only.
Translate item/category names and visible descriptions into concise natural Simplified Chinese (简体中文) for mainland Chinese readers. Every name_zh and description_zh value must use Simplified Chinese characters, never Traditional Chinese. Infer allergen categories conservatively from visible ingredients or strongly implied dish names. Estimate spicy_level from 0 to 5.
If a value is not visible, use null. Preserve visible price text exactly in price_raw.
Keep description_en short, maximum 8 words. Use null for add-on notes that are not dish descriptions.
Use [] when no allergen can be identified. Allowed allergens: gluten, dairy, egg, peanut, tree_nut, shellfish, mollusk, fish, seafood, soy, sesame, mustard, celery, sulfite, coconut.
Do not include markdown or whitespace outside JSON.
Use this exact shape:
{
  "restaurant_name": string | null,
  "cuisine_type": string | null,
  "categories": [
    {
      "name_en": string,
      "name_zh": string,
      "items": [
        {
          "name_en": string,
          "name_zh": string,
          "description_en": string | null,
          "description_zh": string | null,
          "price_raw": string | null,
          "spicy_level": 0 | 1 | 2 | 3 | 4 | 5,
          "allergens": string[]
        }
      ]
    }
  ]
}

Menu text:
${ocrText}`;
}
