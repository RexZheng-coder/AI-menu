import { parseUploadedMenuFilesOnServer } from "../../src/server/menuParseHandler.js";
import type { ServerUploadedImageFile } from "../../src/server/menuImageInput.js";

export const config = {
  runtime: "edge",
};

const maxUploadSizeBytes = 10 * 1024 * 1024;
const acceptedImageTypes = new Set(["image/jpeg", "image/png", "image/webp"]);
const acceptedImageExtensions = [".jpg", ".jpeg", ".png", ".webp"];

type ApiErrorCode =
  | "method_not_allowed"
  | "invalid_content_type"
  | "invalid_form_data"
  | "no_images"
  | "invalid_file_field"
  | "unsupported_file_type"
  | "file_too_large"
  | "mimo_parse_failed";

type ApiErrorBody = {
  ok: false;
  code: ApiErrorCode;
  error: string;
};

export default async function handler(request: Request): Promise<Response> {
  if (request.method !== "POST") {
    return errorResponse(
      "method_not_allowed",
      "Only POST requests are supported for menu parsing.",
      405,
      { Allow: "POST" },
    );
  }

  if (!isMultipartRequest(request)) {
    return errorResponse(
      "invalid_content_type",
      "Menu parsing expects multipart/form-data with image files in the images field.",
      415,
    );
  }

  const formData = await request.formData().catch(() => null);

  if (!formData) {
    return errorResponse("invalid_form_data", "Could not read uploaded image files.", 400);
  }

  const filesResult = getUploadedImageFiles(formData);

  if (!filesResult.ok) {
    return errorResponse(filesResult.code, filesResult.error, filesResult.status);
  }

  const parseResponse = await parseUploadedMenuFilesOnServer(filesResult.files);

  if (!parseResponse.ok) {
    return errorResponse("mimo_parse_failed", parseResponse.error, getParserErrorStatus(parseResponse.error));
  }

  return jsonResponse({
    ok: true,
    menu: parseResponse.menu,
  });
}

function getUploadedImageFiles(
  formData: FormData,
):
  | {
      ok: true;
      files: ServerUploadedImageFile[];
    }
  | {
      ok: false;
      code: ApiErrorCode;
      error: string;
      status: number;
    } {
  const values = formData.getAll("images");

  if (values.length === 0) {
    return {
      ok: false,
      code: "no_images",
      error: "Please upload at least one menu image.",
      status: 400,
    };
  }

  const files: File[] = [];

  for (const value of values) {
    if (!isFile(value)) {
      return {
        ok: false,
        code: "invalid_file_field",
        error: "The images field must contain image files.",
        status: 400,
      };
    }

    files.push(value);
  }

  for (const file of files) {
    if (!isAcceptedImageFile(file)) {
      return {
        ok: false,
        code: "unsupported_file_type",
        error: `Only JPG, PNG, and WebP images are supported. Rejected: ${file.name || "unnamed file"}.`,
        status: 415,
      };
    }

    if (file.size > maxUploadSizeBytes) {
      return {
        ok: false,
        code: "file_too_large",
        error: `Each image must be 10MB or smaller. Rejected: ${file.name || "unnamed file"}.`,
        status: 413,
      };
    }
  }

  return {
    ok: true,
    files,
  };
}

function isMultipartRequest(request: Request): boolean {
  return request.headers.get("content-type")?.toLowerCase().includes("multipart/form-data") ?? false;
}

function isFile(value: FormDataEntryValue): value is File {
  return typeof File !== "undefined" && value instanceof File;
}

function isAcceptedImageFile(file: File): boolean {
  const lowerName = file.name.toLowerCase();

  return (
    acceptedImageTypes.has(file.type) ||
    acceptedImageExtensions.some((extension) => lowerName.endsWith(extension))
  );
}

function getParserErrorStatus(error: string): number {
  return error.includes("MIMO_API_KEY") || error.includes("MiMo API key is not configured") ? 503 : 502;
}

function errorResponse(
  code: ApiErrorCode,
  error: string,
  status: number,
  headers: Record<string, string> = {},
): Response {
  const body: ApiErrorBody = {
    ok: false,
    code,
    error,
  };

  return jsonResponse(body, status, headers);
}

function jsonResponse(body: unknown, status = 200, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
      ...headers,
    },
  });
}
