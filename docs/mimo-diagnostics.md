# MiMo Parser Diagnostics

Isolate MiMo API issues before changing production parser code. These scripts test each layer of the pipeline independently.

## Environment Setup

Create `.env.local` (gitignored):

```text
MIMO_API_KEY=sk-your-pay-as-you-go-key
MIMO_BASE_URL=https://api.xiaomimimo.com/v1
MIMO_MODEL=mimo-v2.5
MENU_AI_PROVIDER=mimo
MENU_PARSE_STRATEGY=vision
MENU_PARSE_DETAIL=accurate
MAX_PARSE_IMAGES=3
```

The scripts also read exported shell variables, which take priority over `.env.local`.

## Diagnostic Scripts

### Text Test

```sh
npm run test:mimo:text
```

Sends a minimal text-only chat completion request. Prints HTTP status, response time, and the first 1000 characters of the response. Use this to verify the API key, base URL, and model configuration.

### Image Test

```sh
npm run test:mimo:image -- ./sample-menu.jpg
```

Converts a local image to a base64 data URL and sends a minimal image-understanding prompt. Prints HTTP status, response time, and the first 1000 characters. Confirms the model supports image input.

### Single-Pass Menu Parse

```sh
npm run test:mimo:menu -- ./sample-menu.jpg
npm run test:mimo:menu:accurate -- ./sample-menu.jpg   # default
npm run test:mimo:menu:fast -- ./sample-menu.jpg         # fast mode
```

Runs the full vision parser locally: image → MiMo vision → bilingual JSON → conversion → sanitization. Prints provider, model, duration, finish reason, content length, truncation recovery status, and item counts.

### OCR Extraction

```sh
npm run test:mimo:ocr -- ./sample-menu.jpg
```

Runs the image-to-text OCR phase through MiMo. Prints status, response time, extracted text length, and the first 1000 characters of extracted text.

### OCR-First Parse

```sh
npm run test:mimo:ocr-parse -- ./sample-menu.jpg
```

Runs the full OCR-first pipeline: image → OCR text → text-only JSON structuring → conversion → sanitization.

### Benchmark Multiple Menus

```sh
npm run benchmark:mimo:menus
```

Runs all available sample images and prints a comparison table. See [benchmarking.md](benchmarking.md) for the regression workflow.

## Results Guide

| Symptom | Likely Cause |
|---|---|
| Text test fails | API key, base URL, model selection, or header format |
| Text works, image fails | Model does not support image input |
| Image works, single-pass parse fails | JSON parsing issue, extraction timeout, or prompt mismatch |
| Image works, OCR fails | Photo clarity, small text, or OCR phase timeout |
| OCR works, OCR-first parse fails | Noisy extracted text or invalid JSON in structuring |
| Both diagnostics succeed, API route fails | Route-specific logs for form-data, validation, or sanitization issues |

## Strategy Reference

| Environment Variable | Values |
|---|---|
| `MENU_AI_PROVIDER` | `mimo` (default) |
| `MENU_PARSE_STRATEGY` | `vision` (default), `ocr_first` |
| `MENU_PARSE_DETAIL` | `accurate` (default), `balanced`, `fast` |
