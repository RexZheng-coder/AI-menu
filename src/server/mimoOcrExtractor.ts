import {
  assertMiMoImageModel,
  createMiMoConfig,
  MiMoParserError,
  sendMiMoChatCompletion,
  type MiMoChatOptions,
  type MiMoContentPart,
} from "./mimoChatClient.js";
import type { ServerMenuImage } from "./menuImageInput.js";

const defaultOcrTimeoutMs = 16_000;
const ocrPrompt =
  "Extract visible restaurant menu text in compact form. Include the restaurant/menu name if visible. Keep item order top to bottom. Use one line per section or item. For each item include name, exact visible price text, and DESC with at most 6 visible words. Do not copy full sentence descriptions. Return text only. Do not translate or explain.";

export async function extractMenuTextWithMiMo(
  images: ServerMenuImage[],
  options: MiMoChatOptions = {},
): Promise<string> {
  if (images.length === 0) {
    throw new MiMoParserError("MIMO_PARSE_FAILED", "No menu images were provided.");
  }

  const config = createMiMoConfig({
    ...options,
    timeoutMs: options.timeoutMs ?? defaultOcrTimeoutMs,
  });
  assertMiMoImageModel(config.model);

  const userContent: MiMoContentPart[] = [
    {
      type: "text",
      text: ocrPrompt,
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
        content: "You extract visible restaurant menu text. Return text only.",
      },
      {
        role: "user",
        content: userContent,
      },
    ],
    maxCompletionTokens: 1200,
    temperature: 0.1,
    logLabel: "ocr",
    imageCount: images.length,
  });
  const text = result.outputText.trim();

  if (!text) {
    throw new MiMoParserError("MIMO_PARSE_FAILED", "MiMo OCR returned empty menu text.");
  }

  console.info("[menu-parse]", {
    event: "ocr_done",
    durationMs: result.durationMs,
    outputLength: text.length,
  });

  return text;
}
