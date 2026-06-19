# MiMo Diagnostics

Use these local scripts to isolate Xiaomi MiMo API issues before changing the production menu parser.

## Environment

Create `.env.local` in the project root:

```text
MIMO_API_KEY=sk-your-pay-as-you-go-key
MIMO_BASE_URL=https://api.xiaomimimo.com/v1
MIMO_MODEL=mimo-v2.5
MENU_AI_PROVIDER=mimo
MENU_PARSE_STRATEGY=vision
MENU_PARSE_DETAIL=accurate
MAX_PARSE_IMAGES=3
```

`.env.local` is ignored by Git. Do not commit real API keys or sample menu images.

The scripts also read exported shell variables. Shell variables take priority over `.env.local`.

## Text Test

Run:

```sh
npm run test:mimo:text
```

This sends a minimal text-only `POST /chat/completions` request with the `api-key` header. It prints the HTTP status, response time, and the first 1000 characters of the response body.

If the text test fails, check the API key, base URL, selected model, and header format first.

## Image Test

Run:

```sh
npm run test:mimo:image -- ./sample-menu.jpg
```

This converts the local image into a base64 data URL and sends a minimal image-understanding prompt:

```text
Describe this image in one sentence.
```

It prints the HTTP status, response time, and the first 1000 characters of the response body. It never prints the API key or image base64.

If the text test succeeds but the image test fails, the issue is likely model image support, the selected model, or the image payload format.

## Single-Pass Menu Parse Test

Run:

```sh
npm run test:mimo:menu -- ./sample-menu.jpg
```

This runs the current default real parser locally:

```text
image -> MiMo vision -> accuracy-first bilingual JSON -> Menu conversion -> sanitizeMenu
```

It prints provider, model, original bytes, optimized bytes, duration, finish reason, content length, truncation recovery status, restaurant name, category count, and item count.

Accurate mode is the default:

```sh
npm run test:mimo:menu:accurate -- ./sample-menu.jpg
```

## Fast Path / Preprocessing Test

Run:

```sh
npm run test:mimo:menu:fast -- ./sample-menu.jpg
```

This uses the same parser path while highlighting preprocessing metadata. If optional `sharp` is not installed in the runtime, preprocessing safely falls back to no-op and reports identical original/optimized byte counts.

Fast mode is useful for demos and latency checks, but it may be less complete on dense menus than the default accurate mode.

## Benchmark Multiple Menus

Run:

```sh
npm run benchmark:mimo:menus
```

This checks available local sample images and prints a table with file, parse detail, duration, restaurant name, category count, item count, price coverage, Chinese-name coverage, finish reason, truncation recovery status, retry usage, dense fallback usage, and error code if parsing fails. It never prints API keys or image base64.

See `docs/benchmarking.md` for the regression workflow and quality interpretation.

## OCR Text Test

Run:

```sh
npm run test:mimo:ocr -- ./sample-menu.jpg
```

This runs the first phase of the real parser: image-to-text OCR extraction through MiMo. It prints status, response time, extracted text length, and the first 1000 characters of extracted menu text. It never prints the API key or image base64.

If text and image diagnostics succeed but OCR text is empty or incomplete, the issue is likely photo clarity, small text, crop quality, or model OCR behavior.

## OCR-First Parse Test

Run:

```sh
npm run test:mimo:ocr-parse -- ./sample-menu.jpg
```

This runs the full local OCR-first server pipeline:

```text
image -> OCR text extraction -> text-only structuring -> Menu conversion -> sanitizeMenu
```

It prints status, response time, restaurant name, category count, and item count.

If OCR text succeeds but OCR-first parsing fails, inspect whether the extracted text is too noisy or whether the text-only JSON structuring response is truncated or invalid.

If OCR-first parsing succeeds but `/api/menus/parse` fails, inspect route logs and upload/form-data handling.

## Strategy Selection

Real mode uses `MENU_AI_PROVIDER` and `MENU_PARSE_STRATEGY`:

- `MENU_AI_PROVIDER=mimo`: default and currently supported vision provider.
- `MENU_PARSE_STRATEGY=vision`: default single-pass MiMo image parser.
- `MENU_PARSE_STRATEGY=ocr_first`: optional legacy pipeline that reads visible text first, then structures text into compact JSON.
- `MENU_PARSE_DETAIL=accurate`: default completeness-first mode.
- `MENU_PARSE_DETAIL=balanced`: middle ground between completion budget and item coverage.
- `MENU_PARSE_DETAIL=fast`: quicker mode for demos and latency checks.

DeepSeek is not used for vision parsing in this app because `deepseek-v4-flash` rejected OpenAI-style `image_url` input during diagnostics.

## Result Guide

- Text fails: key, base URL, model, account permission, or `api-key` header issue.
- Text succeeds, image fails: image understanding model support or `image_url` payload issue.
- Image succeeds, single-pass menu parse fails: inspect `AI_INVALID_JSON`, `EMPTY_MENU_EXTRACTION`, or MiMo timeout logs.
- Image succeeds, OCR fails: photo clarity, small text, crop quality, model OCR behavior, or OCR phase timeout.
- OCR succeeds, OCR-first parse fails: noisy extracted text, invalid/truncated JSON in text structuring, or structuring phase timeout.
- OCR-first fails but vision succeeds: keep `MENU_PARSE_STRATEGY=vision` and compare logs.
- Both diagnostics succeed quickly: inspect `/api/menus/parse` logs for validation, sanitization, or menu-specific prompt failures.

## Limitations

- OCR may miss small, blurred, cropped, or low-contrast text.
- MiMo-generated Chinese translation, tags, allergen categories, and 0–5 spicy level may need correction. Allergy-sensitive users must confirm with the restaurant.
- Complex menus may still need retries, clearer photos, fewer uploaded pages, detail-mode comparison, or temporary OCR-first comparison.
