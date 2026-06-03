import { parseMenuImagesOnServer } from "../../src/server/menuParseHandler.js";
import { createServerMenuImages, type ServerUploadedImageFile } from "../../src/server/menuImageInput.js";

const maxUploadSizeBytes = 10 * 1024 * 1024;
const maxTotalUploadSizeBytes = 32 * 1024 * 1024;
const handlerTimeoutMs = 23_000;
const formDataTimeoutMs = 5_000;
const acceptedImageTypes = new Set(["image/jpeg", "image/png", "image/webp"]);
const acceptedImageExtensions = [".jpg", ".jpeg", ".png", ".webp"];

type ApiErrorCode =
  | "METHOD_NOT_ALLOWED"
  | "INVALID_CONTENT_TYPE"
  | "INVALID_FORM_DATA"
  | "NO_IMAGES"
  | "INVALID_FILE_FIELD"
  | "UNSUPPORTED_FILE_TYPE"
  | "FILE_TOO_LARGE"
  | "MIMO_TIMEOUT"
  | "MIMO_API_ERROR"
  | "MIMO_UNSUPPORTED_MODEL"
  | "MIMO_PARSE_FAILED"
  | "SERVER_CONFIG"
  | "EMPTY_MENU"
  | "FORMDATA_TIMEOUT"
  | "ROUTE_TIMEOUT";

type ApiErrorBody = {
  ok: false;
  code: ApiErrorCode;
  error: string;
};

type NodeRequest = {
  method?: string;
  url?: string;
  headers: Record<string, string | string[] | undefined>;
  on(event: "data", listener: (chunk: Uint8Array | string) => void): void;
  on(event: "end", listener: () => void): void;
  on(event: "error", listener: (error: Error) => void): void;
};

type NodeResponse = {
  status: (statusCode: number) => NodeResponse;
  setHeader: (name: string, value: string) => void;
  json: (body: unknown) => void;
  end: () => void;
};

type UploadedMultipartFile = ServerUploadedImageFile & {
  size: number;
};

type MultipartFile = {
  fieldName: string;
  name: string;
  type: string;
  bytes: Uint8Array;
};

type RequestLogMeta = {
  requestId: string;
  startedAt: number;
};

export default async function handler(request: NodeRequest, response: NodeResponse): Promise<void> {
  const logMeta = createRequestLogMeta();
  const responder = createSafeResponder(response, logMeta);
  const routeTimeoutId = setTimeout(() => {
    responder.sendError(
      "ROUTE_TIMEOUT",
      "Menu parsing took too long. Please try again with a smaller or clearer image.",
      504,
    );
  }, handlerTimeoutMs);

  logInfo(logMeta, "route_start", {
    method: request.method ?? "UNKNOWN",
  });

  try {
    logInfo(logMeta, "method_checked", {
      ok: request.method === "POST",
    });

    if (request.method !== "POST") {
      responder.sendError("METHOD_NOT_ALLOWED", "Only POST requests are supported for menu parsing.", 405, {
        Allow: "POST",
      });
      return;
    }

    const contentType = getHeader(request, "content-type");
    const hasMultipartContentType = contentType.toLowerCase().includes("multipart/form-data");

    logInfo(logMeta, "content_type_checked", {
      ok: hasMultipartContentType,
      hasBoundary: getMultipartBoundary(contentType) !== null,
    });

    if (!hasMultipartContentType) {
      responder.sendError(
        "INVALID_CONTENT_TYPE",
        "Menu parsing expects multipart/form-data with image files in the images field.",
        415,
      );
      return;
    }

    const boundary = getMultipartBoundary(contentType);

    if (!boundary) {
      responder.sendError("INVALID_FORM_DATA", "Could not read the multipart upload boundary.", 400);
      return;
    }

    logInfo(logMeta, "formdata_start", {
      timeoutMs: formDataTimeoutMs,
    });
    const bodyResult = await readRequestBodyWithTimeout(request, maxTotalUploadSizeBytes, formDataTimeoutMs);

    if (!bodyResult.ok) {
      responder.sendError(bodyResult.code, bodyResult.error, bodyResult.status);
      return;
    }

    const parsedFiles = parseMultipartFiles(bodyResult.body, boundary);
    logInfo(logMeta, "formdata_done", {
      filePartCount: parsedFiles.length,
      totalBodyBytes: bodyResult.body.byteLength,
    });

    const filesResult = getUploadedImageFiles(parsedFiles);

    if (!filesResult.ok) {
      responder.sendError(filesResult.code, filesResult.error, filesResult.status);
      return;
    }

    const imageCount = filesResult.files.length;
    const totalBytes = filesResult.files.reduce((sum, file) => sum + file.size, 0);
    const fileTypes = filesResult.files.map((file) => file.type || inferContentType(file.name));

    logInfo(logMeta, "images_extracted", {
      imageCount,
      totalBytes,
      fileTypes,
    });

    if (isDebugRequest(request)) {
      logInfo(logMeta, "route_success", {
        debug: true,
        elapsedMs: Date.now() - logMeta.startedAt,
      });
      responder.sendJson({
        ok: true,
        debug: {
          imageCount,
          totalBytes,
          fileTypes,
        },
      });
      return;
    }

    logInfo(logMeta, "image_conversion_start", {
      imageCount,
      totalBytes,
    });
    const images = await createServerMenuImages(filesResult.files);
    logInfo(logMeta, "image_conversion_done", {
      imageCount: images.length,
    });

    const parseResponse = await parseMenuImagesOnServer({ images });

    if (!parseResponse.ok) {
      const errorCode = normalizeParserErrorCode(parseResponse.code, parseResponse.error);
      const status = parseResponse.status ?? getParserErrorStatus(errorCode);

      responder.sendError(errorCode, getParserErrorMessage(errorCode, parseResponse.error), status);
      return;
    }

    logInfo(logMeta, "route_success", {
      elapsedMs: Date.now() - logMeta.startedAt,
      categoryCount: parseResponse.menu.categories.length,
    });
    responder.sendJson({
      ok: true,
      menu: parseResponse.menu,
    });
  } catch (error) {
    responder.sendError(
      "MIMO_PARSE_FAILED",
      error instanceof Error ? error.message : "Menu parsing failed. Please try again.",
      500,
    );
  } finally {
    clearTimeout(routeTimeoutId);
  }
}

function getUploadedImageFiles(
  files: MultipartFile[],
):
  | {
      ok: true;
      files: UploadedMultipartFile[];
    }
  | {
      ok: false;
      code: ApiErrorCode;
      error: string;
      status: number;
    } {
  const imageFiles = files.filter((file) => file.fieldName === "images" || file.fieldName === "files");

  if (imageFiles.length === 0) {
    return {
      ok: false,
      code: "NO_IMAGES",
      error: "Please upload at least one menu image.",
      status: 400,
    };
  }

  for (const file of imageFiles) {
    if (!file.name) {
      return {
        ok: false,
        code: "INVALID_FILE_FIELD",
        error: "The images or files field must contain named image files.",
        status: 400,
      };
    }

    if (!isAcceptedImageFile(file)) {
      return {
        ok: false,
        code: "UNSUPPORTED_FILE_TYPE",
        error: `Only JPG, PNG, and WebP images are supported. Rejected: ${file.name || "unnamed file"}.`,
        status: 400,
      };
    }

    if (file.bytes.byteLength > maxUploadSizeBytes) {
      return {
        ok: false,
        code: "FILE_TOO_LARGE",
        error: `Each image must be 10MB or smaller. Rejected: ${file.name || "unnamed file"}.`,
        status: 413,
      };
    }
  }

  return {
    ok: true,
    files: imageFiles.map((file) => ({
      name: file.name,
      type: file.type,
      size: file.bytes.byteLength,
      arrayBuffer: async () => toArrayBuffer(file.bytes),
    })),
  };
}

function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  return copy.buffer as ArrayBuffer;
}

function parseMultipartFiles(body: Uint8Array, boundary: string): MultipartFile[] {
  const bodyBinary = bytesToBinaryString(body);
  const delimiter = `--${boundary}`;
  const files: MultipartFile[] = [];

  for (const rawPart of bodyBinary.split(delimiter)) {
    const part = rawPart.replace(/^\r\n/, "");

    if (!part || part === "--\r\n" || part === "--") {
      continue;
    }

    const headerEndIndex = part.indexOf("\r\n\r\n");

    if (headerEndIndex < 0) {
      continue;
    }

    const rawHeaders = part.slice(0, headerEndIndex);
    const rawBody = trimMultipartBody(part.slice(headerEndIndex + 4));
    const disposition = parseContentDisposition(rawHeaders);

    if (!disposition.fileName) {
      continue;
    }

    files.push({
      fieldName: disposition.name,
      name: disposition.fileName,
      type: getPartContentType(rawHeaders),
      bytes: binaryStringToBytes(rawBody),
    });
  }

  return files;
}

function trimMultipartBody(value: string): string {
  return value.endsWith("\r\n") ? value.slice(0, -2) : value;
}

function parseContentDisposition(headers: string): { name: string; fileName: string | null } {
  const contentDisposition = headers
    .split("\r\n")
    .find((header) => header.toLowerCase().startsWith("content-disposition:")) ?? "";

  return {
    name: parseHeaderParameter(contentDisposition, "name") ?? "",
    fileName: parseHeaderParameter(contentDisposition, "filename"),
  };
}

function parseHeaderParameter(header: string, parameterName: string): string | null {
  const match = header.match(new RegExp(`${parameterName}="([^"]*)"`, "i"));
  return match?.[1] ?? null;
}

function getPartContentType(headers: string): string {
  const contentTypeHeader = headers
    .split("\r\n")
    .find((header) => header.toLowerCase().startsWith("content-type:"));

  return contentTypeHeader?.split(":").slice(1).join(":").trim() ?? "";
}

function getMultipartBoundary(contentType: string): string | null {
  return parseHeaderParameter(contentType, "boundary") ?? contentType.match(/boundary=([^;]+)/i)?.[1]?.trim() ?? null;
}

function isAcceptedImageFile(file: MultipartFile): boolean {
  const lowerName = file.name.toLowerCase();

  return (
    acceptedImageTypes.has(file.type) ||
    acceptedImageExtensions.some((extension) => lowerName.endsWith(extension))
  );
}

function inferContentType(fileName: string): string {
  const lowerName = fileName.toLowerCase();

  if (lowerName.endsWith(".jpg") || lowerName.endsWith(".jpeg")) {
    return "image/jpeg";
  }

  if (lowerName.endsWith(".webp")) {
    return "image/webp";
  }

  return "image/png";
}

function getHeader(request: NodeRequest, name: string): string {
  const value = request.headers[name] ?? request.headers[name.toLowerCase()];
  return Array.isArray(value) ? value.join(", ") : value ?? "";
}

function readRequestBodyWithTimeout(
  request: NodeRequest,
  maxSizeBytes: number,
  timeoutMs: number,
): Promise<
  | {
      ok: true;
      body: Uint8Array;
    }
  | {
      ok: false;
      code: ApiErrorCode;
      error: string;
      status: number;
    }
> {
  return new Promise((resolve) => {
    const timeoutId = setTimeout(() => {
      resolve({
        ok: false,
        code: "FORMDATA_TIMEOUT",
        error: "Reading uploaded images timed out. Please try fewer or smaller images.",
        status: 408,
      });
    }, timeoutMs);

    readRequestBody(request, maxSizeBytes)
      .then(resolve)
      .finally(() => clearTimeout(timeoutId));
  });
}

function readRequestBody(
  request: NodeRequest,
  maxSizeBytes: number,
): Promise<
  | {
      ok: true;
      body: Uint8Array;
    }
  | {
      ok: false;
      code: ApiErrorCode;
      error: string;
      status: number;
    }
> {
  return new Promise((resolve) => {
    const chunks: Uint8Array[] = [];
    let totalBytes = 0;
    let settled = false;

    request.on("data", (chunk) => {
      if (settled) {
        return;
      }

      const bytes = typeof chunk === "string" ? new TextEncoder().encode(chunk) : chunk;
      totalBytes += bytes.byteLength;

      if (totalBytes > maxSizeBytes) {
        settled = true;
        resolve({
          ok: false,
          code: "FILE_TOO_LARGE",
          error: "Uploaded images are too large. Please upload fewer or smaller images.",
          status: 413,
        });
        return;
      }

      chunks.push(bytes);
    });

    request.on("end", () => {
      if (settled) {
        return;
      }

      resolve({
        ok: true,
        body: concatBytes(chunks, totalBytes),
      });
    });

    request.on("error", () => {
      if (settled) {
        return;
      }

      settled = true;
      resolve({
        ok: false,
        code: "INVALID_FORM_DATA",
        error: "Could not read uploaded image files.",
        status: 400,
      });
    });
  });
}

function concatBytes(chunks: Uint8Array[], totalBytes: number): Uint8Array {
  const output = new Uint8Array(totalBytes);
  let offset = 0;

  for (const chunk of chunks) {
    output.set(chunk, offset);
    offset += chunk.byteLength;
  }

  return output;
}

function bytesToBinaryString(bytes: Uint8Array): string {
  const chunkSize = 0x8000;
  let output = "";

  for (let offset = 0; offset < bytes.byteLength; offset += chunkSize) {
    output += String.fromCharCode(...bytes.subarray(offset, offset + chunkSize));
  }

  return output;
}

function binaryStringToBytes(value: string): Uint8Array {
  const bytes = new Uint8Array(value.length);

  for (let index = 0; index < value.length; index += 1) {
    bytes[index] = value.charCodeAt(index) & 0xff;
  }

  return bytes;
}

function normalizeParserErrorCode(code: string | undefined, error: string): ApiErrorCode {
  switch (code) {
    case "SERVER_CONFIG":
    case "MIMO_TIMEOUT":
    case "MIMO_API_ERROR":
    case "MIMO_UNSUPPORTED_MODEL":
    case "MIMO_PARSE_FAILED":
    case "EMPTY_MENU":
      return code;
    default:
      break;
  }

  if (error.includes("MIMO_TIMEOUT")) {
    return "MIMO_TIMEOUT";
  }

  if (error.includes("MIMO_API_KEY") || error.includes("MiMo API key is not configured")) {
    return "SERVER_CONFIG";
  }

  return "MIMO_PARSE_FAILED";
}

function getParserErrorMessage(code: ApiErrorCode, fallback: string): string {
  if (code === "MIMO_TIMEOUT") {
    return "Menu parsing timed out. Please try again with a clearer image.";
  }

  return fallback;
}

function getParserErrorStatus(code: ApiErrorCode): number {
  if (code === "MIMO_TIMEOUT") {
    return 504;
  }

  if (code === "SERVER_CONFIG") {
    return 503;
  }

  if (code === "MIMO_UNSUPPORTED_MODEL") {
    return 400;
  }

  if (code === "MIMO_API_ERROR") {
    return 502;
  }

  if (code === "EMPTY_MENU") {
    return 422;
  }

  return 502;
}

function isDebugRequest(request: NodeRequest): boolean {
  const url = new URL(request.url ?? "/api/menus/parse", "https://ai-menu.local");
  return url.searchParams.get("debug") === "1";
}

function createSafeResponder(response: NodeResponse, logMeta: RequestLogMeta): {
  sendJson: (body: unknown, status?: number, headers?: Record<string, string>) => boolean;
  sendError: (code: ApiErrorCode, error: string, status: number, headers?: Record<string, string>) => boolean;
} {
  let hasResponded = false;

  function sendJson(body: unknown, status = 200, headers: Record<string, string> = {}): boolean {
    if (hasResponded) {
      return false;
    }

    hasResponded = true;
    response.status(status);
    response.setHeader("Content-Type", "application/json");

    for (const [name, value] of Object.entries(headers)) {
      response.setHeader(name, value);
    }

    response.json(body);
    return true;
  }

  function sendError(
    code: ApiErrorCode,
    error: string,
    status: number,
    headers: Record<string, string> = {},
  ): boolean {
    if (hasResponded) {
      return false;
    }

    logWarn(logMeta, "route_error", {
      code,
      status,
      elapsedMs: Date.now() - logMeta.startedAt,
    });

    const body: ApiErrorBody = {
      ok: false,
      code,
      error,
    };

    return sendJson(body, status, headers);
  }

  return {
    sendJson,
    sendError,
  };
}

function createRequestLogMeta(): RequestLogMeta {
  return {
    requestId: `parse_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
    startedAt: Date.now(),
  };
}

function logInfo(meta: RequestLogMeta, event: string, details: Record<string, unknown>): void {
  console.info("[menu-parse]", {
    requestId: meta.requestId,
    event,
    ...details,
  });
}

function logWarn(meta: RequestLogMeta, event: string, details: Record<string, unknown>): void {
  console.warn("[menu-parse]", {
    requestId: meta.requestId,
    event,
    ...details,
  });
}
