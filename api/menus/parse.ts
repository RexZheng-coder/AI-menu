import { parseUploadedMenuFilesOnServer } from "../../src/server/menuParseHandler.js";
import type { ServerUploadedImageFile } from "../../src/server/menuImageInput.js";

const maxUploadSizeBytes = 10 * 1024 * 1024;
const maxTotalUploadSizeBytes = 32 * 1024 * 1024;
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
  | "MIMO_PARSE_FAILED"
  | "SERVER_CONFIG";

type ApiErrorBody = {
  ok: false;
  code: ApiErrorCode;
  error: string;
};

type NodeRequest = {
  method?: string;
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
  logInfo(logMeta, "request_start", {
    method: request.method ?? "UNKNOWN",
  });

  if (request.method !== "POST") {
    logWarn(logMeta, "request_rejected", { code: "METHOD_NOT_ALLOWED" });
    writeError(response, "METHOD_NOT_ALLOWED", "Only POST requests are supported for menu parsing.", 405, {
      Allow: "POST",
    });
    return;
  }

  const contentType = getHeader(request, "content-type");

  if (!contentType.toLowerCase().includes("multipart/form-data")) {
    logWarn(logMeta, "request_rejected", { code: "INVALID_CONTENT_TYPE" });
    writeError(
      response,
      "INVALID_CONTENT_TYPE",
      "Menu parsing expects multipart/form-data with image files in the images field.",
      415,
    );
    return;
  }

  const boundary = getMultipartBoundary(contentType);

  if (!boundary) {
    logWarn(logMeta, "request_rejected", { code: "INVALID_FORM_DATA" });
    writeError(response, "INVALID_FORM_DATA", "Could not read the multipart upload boundary.", 400);
    return;
  }

  const bodyResult = await readRequestBody(request, maxTotalUploadSizeBytes);

  if (!bodyResult.ok) {
    logWarn(logMeta, "request_rejected", { code: bodyResult.code });
    writeError(response, bodyResult.code, bodyResult.error, bodyResult.status);
    return;
  }

  const filesResult = getUploadedImageFiles(parseMultipartFiles(bodyResult.body, boundary));

  if (!filesResult.ok) {
    logWarn(logMeta, "request_rejected", { code: filesResult.code });
    writeError(response, filesResult.code, filesResult.error, filesResult.status);
    return;
  }

  logInfo(logMeta, "images_received", {
    imageCount: filesResult.files.length,
    totalBytes: filesResult.files.reduce((sum, file) => sum + file.size, 0),
  });

  const parseResponse = await parseUploadedMenuFilesOnServer(filesResult.files);

  if (!parseResponse.ok) {
    const errorCode = getParserErrorCode(parseResponse.error);
    const status = getParserErrorStatus(errorCode);

    logWarn(logMeta, "parse_failed", {
      code: errorCode,
      elapsedMs: Date.now() - logMeta.startedAt,
    });
    writeError(response, errorCode, getParserErrorMessage(errorCode, parseResponse.error), status);
    return;
  }

  logInfo(logMeta, "parse_completed", {
    elapsedMs: Date.now() - logMeta.startedAt,
    categoryCount: parseResponse.menu.categories.length,
  });

  writeJson(response, {
    ok: true,
    menu: parseResponse.menu,
  });
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
  const imageFiles = files.filter((file) => file.fieldName === "images");

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
        error: "The images field must contain named image files.",
        status: 400,
      };
    }

    if (!isAcceptedImageFile(file)) {
      return {
        ok: false,
        code: "UNSUPPORTED_FILE_TYPE",
        error: `Only JPG, PNG, and WebP images are supported. Rejected: ${file.name || "unnamed file"}.`,
        status: 415,
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

function getHeader(request: NodeRequest, name: string): string {
  const value = request.headers[name] ?? request.headers[name.toLowerCase()];
  return Array.isArray(value) ? value.join(", ") : value ?? "";
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

function getParserErrorCode(error: string): ApiErrorCode {
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
    return "Menu parsing timed out. Please try a clearer or smaller image.";
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

  return 502;
}

function writeError(
  response: NodeResponse,
  code: ApiErrorCode,
  error: string,
  status: number,
  headers: Record<string, string> = {},
): void {
  const body: ApiErrorBody = {
    ok: false,
    code,
    error,
  };

  writeJson(response, body, status, headers);
}

function writeJson(
  response: NodeResponse,
  body: unknown,
  status = 200,
  headers: Record<string, string> = {},
): void {
  response.status(status);
  response.setHeader("Content-Type", "application/json");

  for (const [name, value] of Object.entries(headers)) {
    response.setHeader(name, value);
  }

  response.json(body);
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
