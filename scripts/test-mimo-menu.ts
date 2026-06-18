import { readFile } from "node:fs/promises";
import { extname } from "node:path";

const imagePath = process.argv.slice(2).find((argument) => !argument.startsWith("--"));
const parseDetail = readParseDetailArg();

if (!imagePath) {
  console.error('Usage: npm run test:mimo:menu -- "sample menu/menu.jpg"');
  process.exit(1);
}

await loadLocalEnv();

if (!process.env.MIMO_API_KEY) {
  console.error("Missing MIMO_API_KEY. Add it to .env.local or export it in your shell.");
  process.exit(1);
}

const { createServerMenuImage } = await import("../src/server/menuImageInput.js");
const { getLastMiMoMenuParseDiagnostics, parseMenuWithMiMo } = await import("../src/server/mimoMenuParser.js");
const { getLastMiMoChatDiagnostics } = await import("../src/server/mimoChatClient.js");

process.env.MENU_PARSE_DETAIL = parseDetail;

const bytes = await readFile(imagePath);
const image = await createServerMenuImage({
  name: imagePath,
  type: inferMimeType(imagePath, bytes),
  arrayBuffer: async () => toArrayBuffer(bytes),
});
const startedAt = Date.now();

try {
  const menu = await parseMenuWithMiMo([image]);
  const itemCount = menu.categories.reduce((sum, category) => sum + category.items.length, 0);
  const items = menu.categories.flatMap((category) => category.items);
  const allergenTaggedItemCount = items.filter((item) => (item.allergens?.length ?? 0) > 0).length;
  const maxSpicyLevel = items.reduce((maximum, item) => Math.max(maximum, item.spicy_level), 0);
  const diagnostics = getLastMiMoChatDiagnostics();

  console.log("status: OK");
  console.log(`mode: ${parseDetail}`);
  console.log("provider: mimo");
  console.log(`model: ${diagnostics?.model ?? process.env.MIMO_MODEL ?? "mimo-v2.5"}`);
  console.log(`original_bytes: ${image.originalByteLength}`);
  console.log(`optimized_bytes: ${image.optimizedByteLength}`);
  console.log(`optimization: ${image.optimization}`);
  console.log(`image_sha256_prefix: ${image.sha256.slice(0, 16)}`);
  console.log(`duration_ms: ${Date.now() - startedAt}`);
  console.log(`finish_reason: ${diagnostics?.finishReason ?? "unknown"}`);
  console.log(`content_length: ${diagnostics?.outputLength ?? 0}`);
  console.log(`recovered_from_truncation: ${getLastMiMoMenuParseDiagnostics()?.recoveredFromTruncation ?? false}`);
  console.log(`retry_count: ${getLastMiMoMenuParseDiagnostics()?.retryCount ?? 0}`);
  console.log(`restaurant: ${menu.restaurant.name}`);
  console.log(`categories: ${menu.categories.length}`);
  console.log(`items: ${itemCount}`);
  console.log(`allergen_tagged_items: ${allergenTaggedItemCount}`);
  console.log(`max_spicy_level: ${maxSpicyLevel}`);
} catch (error) {
  const diagnostics = getLastMiMoChatDiagnostics();

  console.log("status: ERROR");
  console.log(`mode: ${parseDetail}`);
  console.log("provider: mimo");
  console.log(`model: ${diagnostics?.model ?? process.env.MIMO_MODEL ?? "mimo-v2.5"}`);
  console.log(`original_bytes: ${image.originalByteLength}`);
  console.log(`optimized_bytes: ${image.optimizedByteLength}`);
  console.log(`duration_ms: ${Date.now() - startedAt}`);
  console.log(`finish_reason: ${diagnostics?.finishReason ?? "unknown"}`);
  console.log(`content_length: ${diagnostics?.outputLength ?? 0}`);
  console.log(`recovered_from_truncation: ${getLastMiMoMenuParseDiagnostics()?.recoveredFromTruncation ?? false}`);
  console.log(`retry_count: ${getLastMiMoMenuParseDiagnostics()?.retryCount ?? 0}`);
  console.log("error_first_500_chars:");
  console.log((error instanceof Error ? error.message : String(error)).slice(0, 500));
  process.exitCode = 1;
}

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

function isNodeErrorCode(error: unknown, code: string): boolean {
  return typeof error === "object" && error !== null && "code" in error && error.code === code;
}
