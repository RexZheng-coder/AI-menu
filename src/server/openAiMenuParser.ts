import { MENU_PARSE_JSON_SCHEMA, MENU_PARSE_PROMPT } from "../lib/menuParsePrompt.js";
import { sanitizeMenu } from "../lib/menuValidation.js";
import type { Menu } from "../types/menu.js";

declare const process:
  | {
      env?: Record<string, string | undefined>;
    }
  | undefined;

export type ServerMenuImage = {
  name: string;
  mimeType: string;
  dataUrl: string;
};

type OpenAiMenuParserOptions = {
  apiKey?: string;
  model?: string;
  endpoint?: string;
  fetchFn?: typeof fetch;
};

type ResponseInputContent =
  | {
      type: "input_text";
      text: string;
    }
  | {
      type: "input_image";
      image_url: string;
      detail: "low" | "high" | "auto";
    };

const defaultEndpoint = "https://api.openai.com/v1/responses";
const defaultModel = "gpt-4.1-mini";

export async function parseMenuWithOpenAI(
  images: ServerMenuImage[],
  options: OpenAiMenuParserOptions = {},
): Promise<Menu> {
  const apiKey = options.apiKey ?? readEnv("AI_MENU_OPENAI_API_KEY") ?? readEnv("OPENAI_API_KEY");

  if (!apiKey) {
    throw new Error("Server AI API key is not configured.");
  }

  if (images.length === 0) {
    throw new Error("No menu images were provided.");
  }

  const fetchFn = options.fetchFn ?? fetch;
  const model = options.model ?? readEnv("AI_MENU_OPENAI_MODEL") ?? defaultModel;
  const endpoint = options.endpoint ?? readEnv("AI_MENU_OPENAI_RESPONSES_URL") ?? defaultEndpoint;
  const imageUrls = images.map((image) => image.name);
  let lastError: Error | null = null;

  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const response = await fetchFn(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify(createOpenAiRequestBody(model, images)),
      });

      if (!response.ok) {
        throw new Error(`AI parsing request failed with status ${response.status}.`);
      }

      const responseBody = await response.json() as unknown;
      const parsedJson = parseJsonFromText(extractOutputText(responseBody));
      const menu = sanitizeMenu(parsedJson, {
        imageUrls,
        now: new Date().toISOString(),
      });

      return {
        ...menu,
        metadata: {
          ...menu.metadata,
          ai_model: model,
        },
      };
    } catch (error) {
      lastError = error instanceof Error ? error : new Error("AI menu parsing failed.");
    }
  }

  throw lastError ?? new Error("AI menu parsing failed.");
}

function createOpenAiRequestBody(model: string, images: ServerMenuImage[]): Record<string, unknown> {
  const content: ResponseInputContent[] = [
    {
      type: "input_text",
      text: MENU_PARSE_PROMPT,
    },
    ...images.map((image) => ({
      type: "input_image" as const,
      image_url: image.dataUrl,
      detail: "high" as const,
    })),
  ];

  return {
    model,
    input: [
      {
        role: "user",
        content,
      },
    ],
    text: {
      format: {
        type: "json_schema",
        name: "ai_menu_assistant_menu",
        strict: false,
        schema: MENU_PARSE_JSON_SCHEMA,
      },
    },
  };
}

function extractOutputText(input: unknown): string {
  const response = asRecord(input);
  const directOutputText = asString(response.output_text);

  if (directOutputText) {
    return directOutputText;
  }

  for (const outputItem of asArray(response.output)) {
    for (const contentItem of asArray(asRecord(outputItem).content)) {
      const text = asString(asRecord(contentItem).text);

      if (text) {
        return text;
      }
    }
  }

  throw new Error("AI response did not include output text.");
}

function parseJsonFromText(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    const start = text.indexOf("{");
    const end = text.lastIndexOf("}");

    if (start >= 0 && end > start) {
      return JSON.parse(text.slice(start, end + 1));
    }

    throw new Error("AI response was not valid JSON.");
  }
}

function readEnv(name: string): string | undefined {
  return typeof process !== "undefined" ? process.env?.[name] : undefined;
}

function asRecord(input: unknown): Record<string, unknown> {
  if (typeof input === "object" && input !== null && !Array.isArray(input)) {
    return input as Record<string, unknown>;
  }

  return {};
}

function asArray(input: unknown): unknown[] {
  return Array.isArray(input) ? input : [];
}

function asString(input: unknown): string | undefined {
  return typeof input === "string" && input.trim().length > 0 ? input.trim() : undefined;
}
