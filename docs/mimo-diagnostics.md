# MiMo Diagnostics

Use these local scripts to isolate Xiaomi MiMo API issues before changing the production menu parser.

## Environment

Create `.env.local` in the project root:

```text
MIMO_API_KEY=sk-your-pay-as-you-go-key
MIMO_BASE_URL=https://api.xiaomimimo.com/v1
MIMO_MODEL=mimo-v2.5
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

If the image test succeeds but `/api/menus/parse` still returns `MIMO_TIMEOUT`, the issue is likely the full menu extraction prompt/schema being too heavy, the uploaded image being difficult to parse, or the production parser timeout being too short.

## Result Guide

- Text fails: key, base URL, model, account permission, or `api-key` header issue.
- Text succeeds, image fails: image understanding model support or `image_url` payload issue.
- Image succeeds, menu parse times out: menu prompt/schema complexity, image clarity, or timeout tuning issue.
- Both diagnostics succeed quickly: inspect `/api/menus/parse` logs for validation, sanitization, or menu-specific prompt failures.
