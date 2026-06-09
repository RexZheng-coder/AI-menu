import { readFile } from "node:fs/promises";
import { extname } from "node:path";

const imagePath = process.argv[2];

if (!imagePath) {
  console.error("Usage: npm run test:mimo:ocr-parse -- ./sample-menu.jpg");
  process.exit(1);
}

await loadLocalEnv();

if (!process.env.MIMO_API_KEY) {
  console.error("Missing MIMO_API_KEY. Add it to .env.local or export it in your shell.");
  process.exit(1);
}

const { parseMenuWithMiMoOcrFirst } = await import("../src/server/mimoOcrMenuParser.js");
const image = await createServerMenuImage(imagePath);
const startedAt = Date.now();

try {
  const menu = await parseMenuWithMiMoOcrFirst([image]);
  const itemCount = menu.categories.reduce((sum, category) => sum + category.items.length, 0);

  console.log("status: OK");
  console.log(`response_time_ms: ${Date.now() - startedAt}`);
  console.log(`restaurant: ${menu.restaurant.name}`);
  console.log(`categories: ${menu.categories.length}`);
  console.log(`items: ${itemCount}`);
} catch (error) {
  console.log("status: ERROR");
  console.log(`response_time_ms: ${Date.now() - startedAt}`);
  console.log(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}

async function createServerMenuImage(filePath: string): Promise<{
  name: string;
  mimeType: string;
  dataUrl: string;
}> {
  const bytes = await readFile(filePath);
  const mimeType = inferMimeType(filePath, bytes);

  return {
    name: filePath,
    mimeType,
    dataUrl: `data:${mimeType};base64,${bytes.toString("base64")}`,
  };
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

function unquoteEnvValue(value: string): string {
  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    return value.slice(1, -1);
  }

  return value;
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

function isNodeErrorCode(error: unknown, code: string): boolean {
  return typeof error === "object" && error !== null && "code" in error && error.code === code;
}
