import { MENU_PARSE_JSON_SCHEMA, MENU_PARSE_PROMPT } from "../lib/menuParsePrompt.js";
import { sanitizeMenu } from "../lib/menuValidation.js";
import type { Menu } from "../types/menu.js";
import type { ServerMenuImage } from "./menuImageInput.js";

declare const process:
  | {
      env?: Record<string, string | undefined>;
    }
  | undefined;

type MiMoMenuParserOptions = {
  apiKey?: string;
  baseUrl?: string;
  model?: string;
  timeoutMs?: number;
  fetchFn?: typeof fetch;
};

type MiMoContentPart =
  | {
      type: "image_url";
      image_url: {
        url: string;
      };
    }
  | {
      type: "text";
      text: string;
    };

const defaultBaseUrl = "https://api.xiaomimimo.com/v1";
const defaultModel = "mimo-v2.5";
const defaultTimeoutMs = 20_000;

export async function parseMenuWithMiMo(
  images: ServerMenuImage[],
  options: MiMoMenuParserOptions = {},
): Promise<Menu> {
  const apiKey = options.apiKey ?? readEnv("MIMO_API_KEY");

  if (!apiKey) {
    throw new Error("MiMo API key is not configured. Set MIMO_API_KEY in Vercel environment variables.");
  }

  if (images.length === 0) {
    throw new Error("No menu images were provided.");
  }

  const model = options.model ?? readEnv("MIMO_MODEL") ?? defaultModel;
  const endpoint = createChatCompletionsUrl(options.baseUrl ?? readEnv("MIMO_BASE_URL") ?? defaultBaseUrl);
  const fetchFn = options.fetchFn ?? fetch;
  const timeoutMs = options.timeoutMs ?? defaultTimeoutMs;
  const imageUrls = images.map((image) => image.name);
  const abortController = new AbortController();
  const timeoutId = setTimeout(() => {
    abortController.abort();
  }, timeoutMs);

  let response: Response;
  let responseText: string;

  try {
    console.info("[menu-parse]", {
      event: "mimo_request_start",
      model,
      imageCount: images.length,
      timeoutMs,
    });

    response = await fetchFn(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "api-key": apiKey,
      },
      body: JSON.stringify(createMiMoRequestBody(model, images)),
      signal: abortController.signal,
    });

    console.info("[menu-parse]", {
      event: "mimo_response_status",
      status: response.status,
      ok: response.ok,
    });

    responseText = await response.text();
  } catch (error) {
    if (isAbortError(error)) {
      console.warn("[menu-parse]", {
        event: "mimo_timeout",
        code: "MIMO_TIMEOUT",
        timeoutMs,
      });
      throw new Error("MIMO_TIMEOUT");
    }

    console.warn("[menu-parse]", {
      event: "mimo_request_error",
      code: "MIMO_PARSE_FAILED",
    });
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }

  if (!response.ok) {
    throw new Error(`MiMo parsing request failed with status ${response.status}: ${extractErrorMessage(responseText)}`);
  }

  const responseBody = parseResponseJson(responseText);
  const modelText = extractMiMoOutputText(responseBody);
  const parsedJson = parseJsonFromText(modelText);
  const menu = sanitizeMenu(parsedJson, {
    imageUrls,
    now: new Date().toISOString(),
  });

  return {
    ...menu,
    metadata: {
      ...menu.metadata,
      ai_model: model,
      source_type: "image_upload",
      status: "completed",
    },
  };
}

function createMiMoRequestBody(model: string, images: ServerMenuImage[]): Record<string, unknown> {
  const userContent: MiMoContentPart[] = [
    ...images.map((image) => ({
      type: "image_url" as const,
      image_url: {
        url: image.dataUrl,
      },
    })),
    {
      type: "text",
      text: createMenuPrompt(),
    },
  ];

  return {
    model,
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
    max_completion_tokens: 4096,
    temperature: 0.1,
    stream: false,
  };
}

function createMenuPrompt(): string {
  return `${MENU_PARSE_PROMPT.trim()}

Use this JSON schema as the output contract. Return only one JSON object:
${JSON.stringify(MENU_PARSE_JSON_SCHEMA)}`;
}

function createChatCompletionsUrl(baseUrl: string): string {
  const trimmedBaseUrl = baseUrl.trim().replace(/\/+$/, "");

  return trimmedBaseUrl.endsWith("/chat/completions")
    ? trimmedBaseUrl
    : `${trimmedBaseUrl}/chat/completions`;
}

function extractMiMoOutputText(input: unknown): string {
  const body = asRecord(input);

  for (const choice of asArray(body.choices)) {
    const message = asRecord(asRecord(choice).message);
    const content = message.content;
    const directText = asString(content);

    if (directText) {
      return directText;
    }

    for (const part of asArray(content)) {
      const text = asString(asRecord(part).text);

      if (text) {
        return text;
      }
    }
  }

  throw new Error("MiMo response did not include menu JSON text.");
}

function parseResponseJson(text: string): unknown {
  try {
    return JSON.parse(text) as unknown;
  } catch (error) {
    throw new Error("MiMo response was not valid JSON.", { cause: error });
  }
}

function parseJsonFromText(text: string): unknown {
  const trimmedText = stripCodeFence(text.trim());

  try {
    return JSON.parse(trimmedText) as unknown;
  } catch {
    const start = trimmedText.indexOf("{");
    const end = trimmedText.lastIndexOf("}");

    if (start >= 0 && end > start) {
      return JSON.parse(trimmedText.slice(start, end + 1)) as unknown;
    }

    throw new Error("MiMo menu output was not valid JSON.");
  }
}

function stripCodeFence(text: string): string {
  return text
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();
}

function extractErrorMessage(responseText: string): string {
  if (!responseText.trim()) {
    return "empty response body";
  }

  try {
    const body = asRecord(JSON.parse(responseText) as unknown);
    const directError = asString(body.error);

    if (directError) {
      return directError;
    }

    const nestedError = asRecord(body.error);
    return asString(nestedError.message) ?? responseText.slice(0, 240);
  } catch {
    return responseText.slice(0, 240);
  }
}

function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === "AbortError";
}

function readEnv(name: string): string | undefined {
  const value = typeof process !== "undefined" ? process.env?.[name] : undefined;
  return value && value.trim().length > 0 ? value.trim() : undefined;
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
