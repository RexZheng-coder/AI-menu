import { mockMenu } from "../mock/menuMock.js";
import { ParseMenuError } from "./parseMenuErrors.js";
import { sanitizeMenu, validateMenuHasItems } from "./menuValidation.js";
import type { Menu } from "../types/menu.js";

const mockLatencyMs = 900;
const slowMockLatencyMs = 60_000;
const parseEndpoint = "/api/menus/parse";

export type ClientParseMetadata = {
  item_count: number;
  category_count: number;
  parse_detail: string;
  provider: string;
  recovered_from_truncation: boolean;
  retry_used: boolean;
  duration_ms: number | null;
};

let lastClientParseMetadata: ClientParseMetadata | null = null;

export async function parseMenuImages(files: File[]): Promise<Menu> {
  lastClientParseMetadata = null;

  if (files.length === 0) {
    throw new ParseMenuError("no_files", "Please choose at least one menu image before scanning.");
  }

  if (files.some((file) => file.name.toLowerCase().includes("fail"))) {
    await delay(mockLatencyMs);
    throw new ParseMenuError("mock_failure", "Mock menu parsing failed. Please try again.");
  }

  if (files.some((file) => file.name.toLowerCase().includes("slow"))) {
    await delay(slowMockLatencyMs);
  }

  if (files.some((file) => file.name.toLowerCase().includes("empty"))) {
    await delay(mockLatencyMs);
    return ensureMenuCanRender({
      ...mockMenu,
      categories: [],
      metadata: {
        ...mockMenu.metadata,
        source_type: "image_upload",
        image_urls: files.map((file) => file.name),
        created_at: new Date().toISOString(),
        status: "completed",
      },
    });
  }

  if (shouldUseBackendParser()) {
    return parseWithBackend(files);
  }

  await delay(mockLatencyMs);

  const menu = ensureMenuCanRender({
    ...mockMenu,
    metadata: {
      ...mockMenu.metadata,
      source_type: "image_upload",
      image_urls: files.map((file) => file.name),
      created_at: new Date().toISOString(),
      status: "completed",
    },
  });
  lastClientParseMetadata = createClientMetadata(menu, {
    parseDetail: "mock",
    provider: "mock",
  });
  return menu;
}

async function parseWithBackend(files: File[]): Promise<Menu> {
  const formData = new FormData();

  for (const file of files) {
    formData.append("images", file, file.name);
  }

  const response = await fetch(createParseEndpoint(), {
    method: "POST",
    body: formData,
  }).catch((error: unknown) => {
    throw new ParseMenuError(
      "network_error",
      "NETWORK_ERROR: Could not reach the real AI parser. Check your connection or use Mock Demo Mode.",
      { cause: error },
    );
  });

  if (!response.ok) {
    const errorBody = await readOptionalJsonResponse(response);
    const errorMessage = asString(errorBody.error);

    if (errorMessage) {
      const backendCode = asString(errorBody.code);
      throw new ParseMenuError(
        getBackendErrorCode(backendCode, response.status),
        formatBackendErrorMessage(backendCode, errorMessage),
      );
    }

    throw response.status === 404 || response.status === 405 || response.status === 501
      ? new ParseMenuError(
          "missing_backend",
          "Real menu parsing is not available yet because the backend route is not configured.",
        )
      : new ParseMenuError("unknown", "Menu parsing failed. Please try again.");
  }

  const body = await readJsonResponse(response);
  const parsedBody = asRecord(body);

  if (parsedBody.debug) {
    throw new ParseMenuError("invalid_request", formatDebugResponseMessage(asRecord(parsedBody.debug)));
  }

  if (parsedBody.ok === false) {
    const backendCode = asString(parsedBody.code);
    const errorMessage = asString(parsedBody.error) ?? "Menu parsing failed. Please try again.";

    throw new ParseMenuError(
      getBackendErrorCode(backendCode, response.status),
      formatBackendErrorMessage(backendCode, errorMessage),
    );
  }

  const menu = ensureMenuCanRender(
    sanitizeMenu(parsedBody.menu ?? body, {
      imageUrls: files.map((file) => file.name),
    }),
  );
  lastClientParseMetadata = readParseMetadata(parsedBody, menu);
  return menu;
}

function shouldUseBackendParser(): boolean {
  const params = new URLSearchParams(window.location.search);
  return params.get("parse") !== "mock";
}

function createParseEndpoint(): string {
  const params = new URLSearchParams();
  const currentParams = new URLSearchParams(window.location.search);

  if (currentParams.get("debug") === "1") {
    params.set("debug", "1");
  }

  const queryString = params.toString();
  return queryString ? `${parseEndpoint}?${queryString}` : parseEndpoint;
}

function delay(milliseconds: number): Promise<void> {
  return new Promise((resolve) => {
    window.setTimeout(resolve, milliseconds);
  });
}

function asRecord(input: unknown): Record<string, unknown> {
  if (typeof input === "object" && input !== null && !Array.isArray(input)) {
    return input as Record<string, unknown>;
  }

  return {};
}

function asString(input: unknown): string | undefined {
  return typeof input === "string" && input.trim().length > 0 ? input.trim() : undefined;
}

function asNumber(input: unknown): number | undefined {
  return typeof input === "number" && Number.isFinite(input) ? input : undefined;
}

function asStringArray(input: unknown): string[] {
  return Array.isArray(input)
    ? input.flatMap((value) => {
        const stringValue = asString(value);
        return stringValue ? [stringValue] : [];
      })
    : [];
}

async function readOptionalJsonResponse(response: Response): Promise<Record<string, unknown>> {
  if (!response.headers.get("content-type")?.toLowerCase().includes("application/json")) {
    return {};
  }

  return readJsonResponse(response);
}

async function readJsonResponse(response: Response): Promise<Record<string, unknown>> {
  const body = await response.json().catch((error: unknown) => {
    throw new ParseMenuError(
      "invalid_json",
      "The parser returned data we could not read. Please retry the scan.",
      { cause: error },
    );
  }) as unknown;

  return asRecord(body);
}

function getBackendErrorCode(code: string | undefined, status: number): ParseMenuError["code"] {
  if (code === "NO_IMAGES" || code === "no_images") {
    return "no_files";
  }

  if (code === "UNSUPPORTED_FILE_TYPE" || code === "unsupported_file_type") {
    return "unsupported_file_type";
  }

  if (code === "FILE_TOO_LARGE" || code === "file_too_large") {
    return "file_too_large";
  }

  if (code === "MIMO_TIMEOUT") {
    return "mimo_timeout";
  }

  if (code === "MIMO_API_ERROR") {
    return "mimo_api_error";
  }

  if (code === "MIMO_UNSUPPORTED_MODEL") {
    return "unsupported_model";
  }

  if (code === "SERVER_CONFIG") {
    return "server_config";
  }

  if (code === "MIMO_PARSE_FAILED" || code === "mimo_parse_failed") {
    return status === 503 ? "server_config" : "provider_failure";
  }

  if (code === "AI_INVALID_JSON" || code === "ai_invalid_json") {
    return "invalid_json";
  }

  if (code === "EMPTY_MENU_EXTRACTION" || code === "empty_menu_extraction") {
    return "empty_menu";
  }

  if (
    code === "INVALID_CONTENT_TYPE" ||
    code === "INVALID_FORM_DATA" ||
    code === "INVALID_FILE_FIELD" ||
    code === "invalid_content_type" ||
    code === "invalid_form_data" ||
    code === "invalid_file_field"
  ) {
    return "invalid_request";
  }

  return "unknown";
}

function formatBackendErrorMessage(code: string | undefined, message: string): string {
  switch (code) {
    case "SERVER_CONFIG":
      return "SERVER_CONFIG: Real AI mode is not configured in this environment. You can use Mock Demo Mode instead.";
    case "MIMO_TIMEOUT":
      return "MIMO_TIMEOUT: This menu took too long to parse. Try cropping the image, uploading one page at a time, or retrying.";
    case "EMPTY_MENU_EXTRACTION":
      return "EMPTY_MENU_EXTRACTION: We could not find readable menu items. Try a clearer photo with less glare.";
    case "AI_INVALID_JSON":
      return "AI_INVALID_JSON: The AI response was incomplete. Please retry.";
    case "MIMO_API_ERROR":
      return `MIMO_API_ERROR: The AI provider returned an error. ${message}`;
    case "UNSUPPORTED_FILE_TYPE":
      return `UNSUPPORTED_FILE_TYPE: Only JPG, PNG, and WebP images are supported.`;
    case "FILE_TOO_LARGE":
      return `FILE_TOO_LARGE: Each image must be 10MB or smaller.`;
    default:
      return code ? `${code}: ${message}` : message;
  }
}

function formatDebugResponseMessage(debug: Record<string, unknown>): string {
  const imageCount = asNumber(debug.imageCount) ?? 0;
  const totalBytes = asNumber(debug.totalBytes) ?? 0;
  const fileTypes = asStringArray(debug.fileTypes).join(", ") || "unknown";

  return `DEBUG_UPLOAD_OK: ${imageCount} image(s), ${totalBytes} bytes, types: ${fileTypes}`;
}

function ensureMenuCanRender(menu: Menu): Menu {
  const validationError = validateMenuHasItems(menu);

  if (validationError) {
    throw new ParseMenuError("empty_menu", validationError);
  }

  return menu;
}

export function getLastClientParseMetadata(): ClientParseMetadata | null {
  return lastClientParseMetadata;
}

function readParseMetadata(body: Record<string, unknown>, menu: Menu): ClientParseMetadata {
  const metadata = asRecord(body.parse_metadata);

  return createClientMetadata(menu, {
    parseDetail: asString(metadata.parse_detail) ?? "accurate",
    provider: asString(metadata.provider) ?? "mimo",
    recoveredFromTruncation: metadata.recovered_from_truncation === true,
    retryUsed: metadata.retry_used === true,
    durationMs: asNumber(metadata.duration_ms) ?? null,
  });
}

function createClientMetadata(
  menu: Menu,
  options: {
    parseDetail: string;
    provider: string;
    recoveredFromTruncation?: boolean;
    retryUsed?: boolean;
    durationMs?: number | null;
  },
): ClientParseMetadata {
  return {
    item_count: menu.categories.reduce((sum, category) => sum + category.items.length, 0),
    category_count: menu.categories.length,
    parse_detail: options.parseDetail,
    provider: options.provider,
    recovered_from_truncation: options.recoveredFromTruncation ?? false,
    retry_used: options.retryUsed ?? false,
    duration_ms: options.durationMs ?? null,
  };
}
