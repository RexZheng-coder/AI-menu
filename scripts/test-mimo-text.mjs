import { readFile } from "node:fs/promises";

const defaultBaseUrl = "https://api.xiaomimimo.com/v1";
const defaultModel = "mimo-v2.5";
const timeoutMs = 30_000;

const env = await readLocalEnv();
const apiKey = readEnvValue(env, "MIMO_API_KEY");
const baseUrl = readEnvValue(env, "MIMO_BASE_URL") ?? defaultBaseUrl;
const model = readEnvValue(env, "MIMO_MODEL") ?? defaultModel;

if (!apiKey) {
  console.error("Missing MIMO_API_KEY. Add it to .env.local or export it in your shell.");
  process.exit(1);
}

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
          role: "system",
          content: "You are MiMo, an AI assistant developed by Xiaomi.",
        },
        {
          role: "user",
          content: "please introduce yourself",
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

function printResult(result) {
  console.log(`status: ${result.status}`);
  console.log(`response_time_ms: ${result.elapsedMs}`);
  console.log("response_body_first_1000_chars:");
  console.log(result.body.slice(0, 1000));
}

function isAbortError(error) {
  return error instanceof DOMException && error.name === "AbortError";
}
