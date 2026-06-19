# Deployment

The application is a static TypeScript app with an optional Vercel serverless parser. The production URL defaults to real MiMo parsing when the API route and environment variables are configured. Use `?parse=mock` for a cost-free sample menu demo on any deployment.

## Build

```bash
npm install
npm run typecheck
npm run build
npm run start
```

The production-ready static output is written to `dist/`.

## Deploy to Vercel

Configuration is provided in `vercel.json`.

1. Import the repository into Vercel.
2. Confirm the build command is `npm run build`.
3. Confirm the output directory is `dist`.
4. For real parsing, add the server-side environment variables in Vercel Project Settings:

```text
MIMO_API_KEY=sk-your-pay-as-you-go-key
MIMO_BASE_URL=https://api.xiaomimimo.com/v1
MIMO_MODEL=mimo-v2.5
MENU_AI_PROVIDER=mimo
MENU_PARSE_STRATEGY=vision
MENU_PARSE_DETAIL=accurate
MAX_PARSE_IMAGES=3
```

API keys must stay server-side. Do not prefix these with `NEXT_PUBLIC_` or similar frontend-exposed variable names.

Use a MiMo pay-as-you-go API key (`sk-xxxxx`) with the OpenAI-compatible base URL above. Token Plan keys (`tp-xxxxx`) and their base URLs are a different product.

5. Deploy.
6. Run the post-deployment smoke test.

## Deploy to Netlify

Configuration is provided in `netlify.toml`.

1. Import the repository into Netlify.
2. Confirm the build command is `npm run build`.
3. Confirm the publish directory is `dist`.
4. Deploy.
5. Run the post-deployment smoke test.

Real parsing requires an equivalent serverless route with the MiMo environment variables configured. The current serverless route is implemented for Vercel functions only; Netlify deployment is ideal for mock/static mode.

## Post-Deployment Smoke Test

Verify the following against the deployed URL:

- App loads without console errors.
- Upload screen shows "Real AI Mode" at `/` and "Mock Demo Mode" at `/?parse=mock`.
- Selecting a JPG, PNG, or WebP image creates a preview.
- "Scan Menu" returns a parsed menu (AI-parsed in real mode, sample menu in mock mode).
- Restaurant header, bilingual categories, dish cards, tags, spice levels, and prices render.
- Cart operations work: add items, adjust quantities, edit notes, generate summary.
- "Recent Menus" shows after parsing and can reload a saved menu.
- Opening `/` without `MIMO_API_KEY` configured shows a friendly configuration error and offers mock mode.
- Desktop and mobile widths show no layout breaks or horizontal overflow.

## Serverless Function Details

- The Vercel function has a 60-second maximum duration (set in `vercel.json`).
- Direct MiMo requests may run for up to 55 seconds.
- The browser queues images in batches of three with two concurrent batches.
- Client-side image compression is required because Vercel applies its request-body limit before server-side code runs.
- Server-side `sharp` preprocessing is a secondary optimization; if `sharp` is unavailable, processing falls back to a safe no-op.

## Troubleshooting

### 504 FUNCTION_INVOCATION_TIMEOUT

Vercel stopped the function before it returned. Common causes:

- Slow MiMo latency
- Very large or unclear images
- Too many uploaded pages
- Model or provider issue

Steps:

1. Upload one smaller, clearer image and retry.
2. Check Vercel function logs for structured events (`route_start`, `mimo_request_start`, `route_error`, etc.).
3. Open the app with `?debug=1` and confirm `POST /api/menus/parse?debug=1` returns image metadata.
4. Confirm the MiMo model supports image understanding.
5. Verify you are using a pay-as-you-go key (`sk-xxxxx`) with `https://api.xiaomimimo.com/v1`.
6. Try `MENU_PARSE_DETAIL=fast` for quicker responses, or reduce `MAX_PARSE_IMAGES`.
