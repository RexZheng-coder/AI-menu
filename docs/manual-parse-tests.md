# Parse Flow Tests

Manual test suite covering the full parse flow. Run these after any parser, prompt, or UI change.

## Setup

```bash
npm run build
npm run start
```

Open the app at `http://127.0.0.1:4173/` (real mode with Vercel API route) or `http://127.0.0.1:4173/?parse=mock` (mock mode).

## Mock Success

1. Open `?parse=mock`.
2. Upload a `.jpg`, `.jpeg`, `.png`, or `.webp` file.
3. Confirm the "Scan Menu" button is enabled.
4. Click "Scan Menu" — confirm the status moves through uploading/parsing and the sample menu renders.
5. Add a dish, generate an order summary, and confirm the cart works.

## Mock Failure

1. Open `?parse=mock`.
2. Upload a file named `fail-menu.png` (any name containing "fail").
3. Click "Scan Menu" — confirm a friendly error appears.
4. Click "Retry" or "Clear".

## Missing Backend

1. Open `/` or `?parse=real` without MiMo environment variables configured.
2. Upload a valid image and click "Scan Menu".
3. Confirm the app reports real parsing is unavailable and offers mock demo mode.

## Invalid File Type

1. Upload a non-image file such as `.txt`.
2. Confirm the app rejects it and keeps "Scan Menu" disabled.

## Large Image

1. Upload a JPG, PNG, or WebP image between 5 MB and 25 MB.
2. Confirm the app shows original and optimized sizes.
3. Confirm the optimized image is within the request budget.
4. Upload an image larger than 25 MB and confirm rejection with the size limit message.

## Parse Timeout

1. Open `?parseTimeoutMs=100`.
2. Upload a file named `slow-menu.png` (any name containing "slow").
3. Click "Scan Menu" — confirm the timeout error appears with retry options.

## Empty Parsed Menu

1. Upload a file named `empty-menu.png` (any name containing "empty").
2. Click "Scan Menu" — confirm the empty-menu error is shown instead of a blank menu.
