# MiMo Diagnostics

Use these local scripts to isolate Xiaomi MiMo API issues before changing the production menu parser.

## Environment

Create `.env.local` in the project root:

```text
MIMO_API_KEY=sk-your-pay-as-you-go-key
MIMO_BASE_URL=https://api.xiaomimimo.com/v1
MIMO_MODEL=mimo-v2.5
MIMO_PARSE_STRATEGY=ocr_first
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

Real mode uses `MIMO_PARSE_STRATEGY`:

- `ocr_first`: default. Reads visible text first, then structures text into compact JSON.
- `vision`: uses the previous direct image-to-menu parser.

OCR-first is usually faster and more stable because image understanding and menu structuring are separated into smaller prompts. If OCR-first fails at runtime, the API logs `fallback_to_vision` and attempts the direct vision parser for non-timeout parser/provider failures. Configuration errors, unsupported-model errors, and OCR-first timeouts return directly so the route does not overrun the serverless budget.

## Result Guide

- Text fails: key, base URL, model, account permission, or `api-key` header issue.
- Text succeeds, image fails: image understanding model support or `image_url` payload issue.
- Image succeeds, OCR fails: photo clarity, small text, crop quality, model OCR behavior, or OCR phase timeout.
- OCR succeeds, OCR-first parse fails: noisy extracted text, invalid/truncated JSON in text structuring, or structuring phase timeout.
- OCR-first fails but vision succeeds: keep `MIMO_PARSE_STRATEGY=vision` temporarily and compare logs.
- Both diagnostics succeed quickly: inspect `/api/menus/parse` logs for validation, sanitization, or menu-specific prompt failures.

## Limitations

- OCR may miss small, blurred, cropped, or low-contrast text.
- Chinese translation, tags, allergens, and spicy levels remain basic placeholders in real parsed menus.
- Complex menus may still need retries, clearer photos, or the `vision` strategy.
