import { access, readFile } from "node:fs/promises";
import { extname } from "node:path";

const sampleFiles = [
  "sample menu/menu.jpg",
  "sample menu/english-dense-menu.jpg",
  "sample menu/drinks-menu.jpg",
  "sample menu/chinese-menu.jpg",
];

await loadLocalEnv();

if (!process.env.MIMO_API_KEY) {
  console.error("Missing MIMO_API_KEY. Add it to .env.local or export it in your shell.");
  process.exit(1);
}

const detail = readParseDetailArg();
process.env.MENU_PARSE_DETAIL = detail;

const { createServerMenuImage } = await import("../src/server/menuImageInput.js");
const { getLastMiMoChatDiagnostics } = await import("../src/server/mimoChatClient.js");
const { getLastMiMoMenuParseDiagnostics, parseMenuWithMiMo } = await import("../src/server/mimoMenuParser.js");

type BenchmarkRow = {
  file: string;
  detail: string;
  duration_ms: number;
  restaurant: string;
  categories: number | string;
  items: number | string;
  finish_reason: string;
  recovered_from_truncation: string;
  error_code: string;
};

const rows: BenchmarkRow[] = [];

for (const file of sampleFiles) {
  if (!(await fileExists(file))) {
    continue;
  }

  const startedAt = Date.now();

  try {
    const bytes = await readFile(file);
    const image = await createServerMenuImage({
      name: file,
      type: inferMimeType(file, bytes),
      arrayBuffer: async () => toArrayBuffer(bytes),
    });
    const menu = await parseMenuWithMiMo([image]);
    const menuDiagnostics = getLastMiMoMenuParseDiagnostics();
    const chatDiagnostics = getLastMiMoChatDiagnostics();

    rows.push({
      file,
      detail,
      duration_ms: Date.now() - startedAt,
      restaurant: menu.restaurant.name,
      categories: menu.categories.length,
      items: menu.categories.reduce((sum, category) => sum + category.items.length, 0),
      finish_reason: menuDiagnostics?.finishReason ?? chatDiagnostics?.finishReason ?? "unknown",
      recovered_from_truncation: String(menuDiagnostics?.recoveredFromTruncation ?? false),
      error_code: "",
    });
  } catch (error) {
    const chatDiagnostics = getLastMiMoChatDiagnostics();

    rows.push({
      file,
      detail,
      duration_ms: Date.now() - startedAt,
      restaurant: "",
      categories: "",
      items: "",
      finish_reason: chatDiagnostics?.finishReason ?? "unknown",
      recovered_from_truncation: String(getLastMiMoMenuParseDiagnostics()?.recoveredFromTruncation ?? false),
      error_code: readErrorCode(error),
    });
  }
}

console.table(rows);

function readParseDetailArg(): "fast" | "balanced" | "accurate" {
  if (process.argv.includes("--fast")) {
    return "fast";
  }

  if (process.argv.includes("--balanced")) {
    return "balanced";
  }

  return "accurate";
}

async function loadLocalEnv(): Promise<void> {
  try {
    const text = await readFile(".env.local", "utf8");

    for (const line of text.split(/\r?\n/)) {
      const trimmedLine = line.trim();

      if (!trimmedLine || trimmedLine.startsWith("#")) {
        continue;
      }

      const equalsIndex = trimmedLine.indexOf("=");

      if (equalsIndex < 0) {
        continue;
      }

      const key = trimmedLine.slice(0, equalsIndex).trim();
      const value = unquoteEnvValue(trimmedLine.slice(equalsIndex + 1).trim());

      if (key && !process.env[key]) {
        process.env[key] = value;
      }
    }
  } catch (error) {
    if (!isNodeErrorCode(error, "ENOENT")) {
      throw error;
    }
  }
}

async function fileExists(file: string): Promise<boolean> {
  try {
    await access(file);
    return true;
  } catch {
    return false;
  }
}

function inferMimeType(filePath: string, bytes: Buffer): string {
  if (isJpeg(bytes)) {
    return "image/jpeg";
  }

  if (isPng(bytes)) {
    return "image/png";
  }

  if (isWebp(bytes)) {
    return "image/webp";
  }

  const extension = extname(filePath).toLowerCase();

  if (extension === ".jpg" || extension === ".jpeg") {
    return "image/jpeg";
  }

  if (extension === ".png") {
    return "image/png";
  }

  if (extension === ".webp") {
    return "image/webp";
  }

  return "application/octet-stream";
}

function toArrayBuffer(bytes: Buffer): ArrayBuffer {
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
}

function isJpeg(bytes: Buffer): boolean {
  return bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
}

function isPng(bytes: Buffer): boolean {
  return (
    bytes.length >= 8 &&
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47 &&
    bytes[4] === 0x0d &&
    bytes[5] === 0x0a &&
    bytes[6] === 0x1a &&
    bytes[7] === 0x0a
  );
}

function isWebp(bytes: Buffer): boolean {
  return (
    bytes.length >= 12 &&
    bytes.toString("ascii", 0, 4) === "RIFF" &&
    bytes.toString("ascii", 8, 12) === "WEBP"
  );
}

function unquoteEnvValue(value: string): string {
  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    return value.slice(1, -1);
  }

  return value;
}

function readErrorCode(error: unknown): string {
  if (typeof error === "object" && error !== null && "code" in error) {
    return String(error.code);
  }

  return error instanceof Error ? error.name : "ERROR";
}

function isNodeErrorCode(error: unknown, code: string): boolean {
  return typeof error === "object" && error !== null && "code" in error && error.code === code;
}
