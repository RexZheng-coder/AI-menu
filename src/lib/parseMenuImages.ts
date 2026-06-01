import { mockMenu } from "../mock/menuMock.js";
import { ParseMenuError } from "./parseMenuErrors.js";
import { sanitizeMenu, validateMenuHasItems } from "./menuValidation.js";
import type { Menu } from "../types/menu.js";

const mockLatencyMs = 900;
const slowMockLatencyMs = 60_000;
const parseEndpoint = "/api/menus/parse";

export async function parseMenuImages(files: File[]): Promise<Menu> {
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

  return ensureMenuCanRender({
    ...mockMenu,
    metadata: {
      ...mockMenu.metadata,
      source_type: "image_upload",
      image_urls: files.map((file) => file.name),
      created_at: new Date().toISOString(),
      status: "completed",
    },
  });
}

async function parseWithBackend(files: File[]): Promise<Menu> {
  const formData = new FormData();

  for (const file of files) {
    formData.append("images", file, file.name);
  }

  const response = await fetch(parseEndpoint, {
    method: "POST",
    body: formData,
  }).catch((error: unknown) => {
    throw new ParseMenuError(
      "missing_backend",
      "Real menu parsing is not available yet because the backend route is not configured.",
      { cause: error },
    );
  });

  if (!response.ok) {
    throw response.status === 404 || response.status === 405 || response.status === 501
      ? new ParseMenuError(
          "missing_backend",
          "Real menu parsing is not available yet because the backend route is not configured.",
        )
      : new ParseMenuError("unknown", "Menu parsing failed. Please try again.");
  }

  const body = await response.json().catch((error: unknown) => {
    throw new ParseMenuError(
      "invalid_json",
      "The parser returned data we could not read. Please retry the scan.",
      { cause: error },
    );
  }) as unknown;
  const parsedBody = asRecord(body);

  if (parsedBody.ok === false) {
    throw new ParseMenuError("unknown", asString(parsedBody.error) ?? "Menu parsing failed. Please try again.");
  }

  return ensureMenuCanRender(
    sanitizeMenu(parsedBody.menu ?? body, {
      imageUrls: files.map((file) => file.name),
    }),
  );
}

function shouldUseBackendParser(): boolean {
  const params = new URLSearchParams(window.location.search);
  return params.get("parse") === "real" || params.get("ai") === "1";
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

function ensureMenuCanRender(menu: Menu): Menu {
  const validationError = validateMenuHasItems(menu);

  if (validationError) {
    throw new ParseMenuError("empty_menu", validationError);
  }

  return menu;
}
