import { readFile } from "node:fs/promises";
import { extname } from "node:path";

const defaultBaseUrl = "https://api.xiaomimimo.com/v1";
const defaultModel = "mimo-v2.5";
const timeoutMs = 30_000;
const imagePath = process.argv[2];

if (!imagePath) {
  console.error("Usage: node scripts/test-mimo-image.mjs ./sample-menu.jpg");
  process.exit(1);
}

const env = await readLocalEnv();
const apiKey = readEnvValue(env, "MIMO_API_KEY");
const baseUrl = readEnvValue(env, "MIMO_BASE_URL") ?? defaultBaseUrl;
const model = readEnvValue(env, "MIMO_MODEL") ?? defaultModel;

if (!apiKey) {
  console.error("Missing MIMO_API_KEY. Add it to .env.local or export it in your shell.");
  process.exit(1);
}

const imageBytes = await readFile(imagePath);
const dataUrl = `data:${inferMimeType(imagePath, imageBytes)};base64,${imageBytes.toString("base64")}`;
const endpoint = createChatCompletionsUrl(baseUrl);
const startedAt = Date.now();
const abortController = new AbortController();
const timeoutId = setTimeout(() => abortController.abort(), timeoutMs);

try {
  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "api-key": apiKey,
    },
    body: JSON.stringify({
      model,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: "Describe this image in one sentence.",
            },
            {
              type: "image_url",
              image_url: {
                url: dataUrl,
              },
            },
          ],
        },
      ],
      max_completion_tokens: 512,
      temperature: 0.7,
      stream: false,
    }),
    signal: abortController.signal,
  });
  const responseBody = await response.text();

  printResult({
    status: `${response.status} ${response.statusText}`.trim(),
    elapsedMs: Date.now() - startedAt,
    body: responseBody,
  });
} catch (error) {
  printResult({
    status: isAbortError(error) ? "TIMEOUT" : "REQUEST_ERROR",
    elapsedMs: Date.now() - startedAt,
    body: error instanceof Error ? error.message : String(error),
  });
  process.exitCode = 1;
} finally {
  clearTimeout(timeoutId);
}

async function readLocalEnv() {
  const values = {};

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

      if (key) {
        values[key] = value;
      }
    }
  } catch (error) {
    if (error?.code !== "ENOENT") {
      throw error;
    }
  }

  return values;
}

function readEnvValue(localEnv, name) {
  const value = process.env[name] ?? localEnv[name];
  return value && value.trim().length > 0 ? value.trim() : undefined;
}

function unquoteEnvValue(value) {
  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    return value.slice(1, -1);
  }

  return value;
}

function createChatCompletionsUrl(baseUrl) {
  const trimmedBaseUrl = baseUrl.trim().replace(/\/+$/, "");

  return trimmedBaseUrl.endsWith("/chat/completions")
    ? trimmedBaseUrl
    : `${trimmedBaseUrl}/chat/completions`;
}

function inferMimeType(filePath, bytes) {
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

function isJpeg(bytes) {
  return bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
}

function isPng(bytes) {
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

function isWebp(bytes) {
  return (
    bytes.length >= 12 &&
    bytes.toString("ascii", 0, 4) === "RIFF" &&
    bytes.toString("ascii", 8, 12) === "WEBP"
  );
}

function printResult(result) {
  console.log(`status: ${result.status}`);
  console.log(`response_time_ms: ${result.elapsedMs}`);
  console.log("response_body_first_1000_chars:");
  console.log(result.body.slice(0, 1000));
}

function isAbortError(error) {
  return error instanceof DOMException && error.name === "AbortError";
}
