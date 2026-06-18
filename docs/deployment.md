# Deployment

This is a static-first MVP with an optional Vercel serverless parser. The deployed root route defaults to real MiMo parsing when the API route and server-side env vars are configured. Use `?parse=mock` for a cost-free sample menu demo.

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
- Environment variables for real MiMo mode: `MIMO_API_KEY`, `MIMO_BASE_URL`, `MIMO_MODEL`, `MENU_AI_PROVIDER`, `MENU_PARSE_STRATEGY`, `MENU_PARSE_DETAIL`, `MAX_PARSE_IMAGES`
- Environment variables: none required only when demonstrating with `?parse=mock`

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
MENU_AI_PROVIDER=mimo
MENU_PARSE_STRATEGY=vision
MENU_PARSE_DETAIL=accurate
MAX_PARSE_IMAGES=2
```

Do not prefix these with frontend/public env names. They must stay server-side only.

Use the Xiaomi MiMo pay-as-you-go API here. Pay-as-you-go keys normally use an `sk-xxxxx` format and the OpenAI-compatible base URL above. Token Plan keys such as `tp-xxxxx` and token-plan base URLs are different products and should not be mixed with this route.

## Deploy To Netlify

Use the included `netlify.toml`.

- Build command: `npm run build`
- Publish directory: `dist`
- Environment variables: none required for `?parse=mock`; real parsing requires an equivalent serverless route and server-side MiMo variables

Recommended flow:

1. Import the repository into Netlify.
2. Confirm the build command is `npm run build`.
3. Confirm the publish directory is `dist`.
4. Deploy.
5. Run the post-deployment smoke test checklist.

## Post-Deployment Smoke Test

Run this against the deployed URL:

- App loads without console errors.
- Upload screen shows `Real AI Mode` at `/` and `Mock Demo Mode` at `/?parse=mock`.
- Selecting a JPG, PNG, or WebP image creates a preview.
- `Scan Menu` returns a MiMo-parsed menu in real mode, or the sample parsed menu at `?parse=mock`.
- Restaurant header, bilingual categories, dish cards, tags, AI-estimated spice levels, and prices render.
- `+` buttons add dishes to the cart.
- Quantity controls update totals.
- Item notes are retained in the cart.
- Order summary generates bilingual display text.
- Recent menu history appears after parsing and can reload a saved menu.
- Opening `/` or `?parse=real` without `MIMO_API_KEY` shows a friendly configuration failure and offers Mock Demo Mode.
- Opening `/` or `?parse=real` with MiMo env vars configured can parse a real menu image through `/api/menus/parse`.
- Opening `?parse=mock` returns the sample menu without calling MiMo.
- Opening `?debug=1` posts the image to `/api/menus/parse?debug=1` and returns upload metadata without calling MiMo.
- Desktop and mobile widths do not show broken layout or horizontal overflow.

Real parsing sends uploaded images to MiMo and may incur provider cost. Use non-sensitive test images unless your deployment and provider account are approved for the image content you upload.

## What Works In The Static MVP

- Upload-first menu flow
- Explicit mock menu parsing with `?parse=mock` or `Use Sample Menu`
- Parsed bilingual menu rendering
- Cart quantities, notes, totals, and order summary
- Local menu history with `localStorage`
- Friendly errors and retry states
- Default Vercel serverless MiMo parser at `/` and `?parse=real`

## Real MiMo Parser

The browser accepts JPG, PNG, and WebP source images up to 25MB each, then creates temporary upload copies before calling the API. Large photos are resized to at most 2200px on the longest side and adaptively encoded as JPEG, targeting about 900KB per image and no more than roughly 3.4MB for the complete multipart request. The original file stays in the browser for preview/comparison and is not uploaded or stored by the app.

The Vercel route `POST /api/menus/parse` accepts these optimized multipart uploads from the `images` field. During debugging it also accepts `files` as a temporary compatibility field. It rejects non-image files, retains a defensive 10MB per-file limit, converts images to data URLs, calls MiMo server-side, and sanitizes the model output into the app's `Menu` type.

API keys must stay server-side only in `MIMO_API_KEY`. Real image parsing requires a MiMo model that supports image understanding; the default is `mimo-v2.5`. Mock mode is still available explicitly with `?parse=mock`.

Real parsing defaults to `MENU_AI_PROVIDER=mimo`, `MENU_PARSE_STRATEGY=vision`, and `MENU_PARSE_DETAIL=accurate`. This single-pass MiMo vision parser reads uploaded images and prioritizes complete visible item coverage, meaning-based Chinese item names, categories, prices, five-level spicy estimates, and conservative allergen categories. Descriptions and tags are sanitized into the existing `Menu` contract; dense menus may leave optional descriptive fields empty so more visible items are preserved. OCR-first remains available only when explicitly selected with `MENU_PARSE_STRATEGY=ocr_first`.

Allergen labels are AI-generated ordering aids, not medical guarantees. The UI explicitly tells users to confirm ingredients and cross-contamination risks with the restaurant.

`MENU_PARSE_DETAIL=fast | balanced | accurate` controls the speed/completeness tradeoff. Accurate is the default and may be slower; fast is useful for demos but can be less complete on dense menus.

DeepSeek is not used for vision parsing because the current DeepSeek API/model rejected OpenAI-style `image_url` input in diagnostics.

The route processes only the first `MAX_PARSE_IMAGES` uploads, defaulting to 2, to keep latency and provider cost predictable. Server-side preprocessing logs original bytes, optimized bytes, and a SHA-256 hash prefix. If optional `sharp` is not available, preprocessing is a safe no-op fallback.

Client-side compression is required because Vercel applies its Function request-body limit before server-side code can run. Server-side `sharp` preprocessing remains a second defensive optimization, not the primary solution for oversized uploads.

The parser is implemented as a Vercel Node.js Serverless Function, not an Edge Function. `vercel.json` sets `/api/menus/parse` to a 60-second maximum duration. Direct MiMo requests may run for up to 55 seconds regardless of image count. The route keeps the final few seconds for validation and a structured JSON response before Vercel stops the function; the browser waits slightly longer so it can display that backend error instead of masking it with a client timeout:

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
- Check Vercel function logs for `route_start`, `method_checked`, `content_type_checked`, `formdata_start`, `formdata_done`, `images_extracted`, `images_limited`, `image_conversion_start`, `image_conversion_done`, `parse_strategy`, `mimo_input_summary`, `mimo_request_start`, `mimo_response_status`, `mimo_response_summary`, `sanitize_start`, `sanitize_done`, `route_success`, or `route_error`.
- For upload parsing specifically, open the app with `?debug=1` and confirm `/api/menus/parse?debug=1` returns `imageCount`, `totalBytes`, and `fileTypes`.
- Check MiMo service latency and model availability.
- Confirm the selected `MIMO_MODEL` supports image understanding.
- Confirm you are using a pay-as-you-go `sk-xxxxx` key with `https://api.xiaomimimo.com/v1`, not Token Plan credentials/base URLs.
- Try a faster/smaller model through `MIMO_MODEL` if available.
- Try a smaller/clearer image, reduce `MAX_PARSE_IMAGES`, compare `MENU_PARSE_DETAIL=fast|balanced|accurate`, or temporarily test `MENU_PARSE_STRATEGY=ocr_first` if single-pass vision repeatedly fails on a specific menu.
- Confirm the deployed build includes the latest Node function changes.

## Netlify Limitation

The current real parser route is implemented for Vercel serverless functions. Netlify deployment remains suitable for the mock/static MVP unless an equivalent Netlify function is added later.
