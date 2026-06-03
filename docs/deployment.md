# Deployment

This is a static-first MVP. The deployed app defaults to mock parsing mode and does not require API keys unless real MiMo parsing is enabled with `?parse=real`.

## Deployment Checklist

```bash
npm install
npm run typecheck
npm run build
npm run start
```

Open `http://127.0.0.1:4173/` and run the smoke test checklist below before deploying.

The production-ready static output is written to `dist/`.

## Deploy To Vercel

Use the included `vercel.json`.

- Build command: `npm run build`
- Output directory: `dist`
- Framework preset: Other/static
- Environment variables: none required for mock mode
- Environment variables for real MiMo mode: `MIMO_API_KEY`, `MIMO_BASE_URL`, `MIMO_MODEL`

Recommended flow:

1. Import the repository into Vercel.
2. Confirm the build command is `npm run build`.
3. Confirm the output directory is `dist`.
4. For real parsing, add the MiMo environment variables below in Vercel Project Settings.
5. Deploy.
6. Run the post-deployment smoke test checklist.

Server-side MiMo variables:

```text
MIMO_API_KEY=sk-your-pay-as-you-go-key
MIMO_BASE_URL=https://api.xiaomimimo.com/v1
MIMO_MODEL=mimo-v2.5
```

Do not prefix these with frontend/public env names. They must stay server-side only.

Use the Xiaomi MiMo pay-as-you-go API here. Pay-as-you-go keys normally use an `sk-xxxxx` format and the OpenAI-compatible base URL above. Token Plan keys such as `tp-xxxxx` and token-plan base URLs are different products and should not be mixed with this route.

## Deploy To Netlify

Use the included `netlify.toml`.

- Build command: `npm run build`
- Publish directory: `dist`
- Environment variables: none required for the current mock/static MVP

Recommended flow:

1. Import the repository into Netlify.
2. Confirm the build command is `npm run build`.
3. Confirm the publish directory is `dist`.
4. Deploy.
5. Run the post-deployment smoke test checklist.

## Post-Deployment Smoke Test

Run this against the deployed URL:

- App loads without console errors.
- Upload screen shows `Mock Demo Mode`.
- Selecting a JPG, PNG, or WebP image creates a preview.
- `Scan Menu` returns the sample parsed menu in static mode.
- Restaurant header, bilingual categories, dish cards, tags, spice levels, confidence, and prices render.
- `+` buttons add dishes to the cart.
- Quantity controls update totals.
- Item notes are retained in the cart.
- Order summary generates bilingual display text.
- Recent menu history appears after parsing and can reload a saved menu.
- Opening `?parse=real` without `MIMO_API_KEY` shows a friendly configuration failure.
- Opening `?parse=real` with MiMo env vars configured can parse a real menu image through `/api/menus/parse`.
- Opening `?parse=real&debug=1` posts the image to `/api/menus/parse?debug=1` and returns upload metadata without calling MiMo.
- Desktop and mobile widths do not show broken layout or horizontal overflow.

Real parsing sends uploaded images to MiMo and may incur provider cost. Use non-sensitive test images unless your deployment and provider account are approved for the image content you upload.

## What Works In The Static MVP

- Upload-first menu flow
- Mock menu parsing
- Parsed bilingual menu rendering
- Cart quantities, notes, totals, and order summary
- Local menu history with `localStorage`
- Friendly errors and retry states
- Optional Vercel serverless MiMo parser via `?parse=real`

## Real MiMo Parser

The Vercel route `POST /api/menus/parse` accepts multipart image uploads from the `images` field. During debugging it also accepts `files` as a temporary compatibility field. It rejects non-image files, enforces the same 10MB per-file limit as the frontend, converts images to data URLs, calls MiMo server-side, and sanitizes the model output into the app's `Menu` type.

API keys must stay server-side only in `MIMO_API_KEY`. Mock mode remains the default even when MiMo is configured. Real image parsing requires a MiMo model that supports image understanding; the default is `mimo-v2.5`.

The parser is implemented as a Vercel Node.js Serverless Function, not an Edge Function. `vercel.json` sets `/api/menus/parse` to a 30-second maximum duration, and the MiMo provider call has an app-level timeout of about 20 seconds so the API can return structured JSON before Vercel stops the function:

```json
{
  "ok": false,
  "code": "MIMO_TIMEOUT",
  "error": "Menu parsing timed out. Please try again with a clearer image."
}
```

Debug mode is safe to keep temporarily because it returns only upload metadata:

```json
{
  "ok": true,
  "debug": {
    "imageCount": 1,
    "totalBytes": 12345,
    "fileTypes": ["image/jpeg"]
  }
}
```

## Troubleshooting

### 504 FUNCTION_INVOCATION_TIMEOUT

This means Vercel stopped the function because it did not return in time. For real menu parsing, the usual causes are slow MiMo latency, very large or unclear images, too many uploaded images, or a model/provider issue.

The app now uses a Node.js function plus an app-level MiMo timeout so slow provider responses should return `MIMO_TIMEOUT` JSON before Vercel's platform timeout. If you still see a platform 504:

- Upload one smaller, clearer image and retry.
- Check Vercel function logs for `route_start`, `method_checked`, `content_type_checked`, `formdata_start`, `formdata_done`, `images_extracted`, `image_conversion_start`, `image_conversion_done`, `mimo_request_start`, `mimo_response_status`, `sanitize_start`, `sanitize_done`, `route_success`, or `route_error`.
- For upload parsing specifically, open the app with `?parse=real&debug=1` and confirm `/api/menus/parse?debug=1` returns `imageCount`, `totalBytes`, and `fileTypes`.
- Check MiMo service latency and model availability.
- Confirm the selected `MIMO_MODEL` supports image understanding.
- Confirm you are using a pay-as-you-go `sk-xxxxx` key with `https://api.xiaomimimo.com/v1`, not Token Plan credentials/base URLs.
- Try a faster/smaller model through `MIMO_MODEL` if available.
- Confirm the deployed build includes the latest Node function changes.

## Netlify Limitation

The current real parser route is implemented for Vercel serverless functions. Netlify deployment remains suitable for the mock/static MVP unless an equivalent Netlify function is added later.
